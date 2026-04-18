'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ColDef, formatKDate } from '@/lib/columns';
import YearSelect from '@/app/YearSelect';

type Row = Record<string, any>;
type Props = {
  factoryId: string;
  cols: ColDef[];
  initialRows: Row[];
  weather: Record<string, string>;
  session: { name: string; role: string };
};

function generateYearDates(year: number): string[] {
  const dates: string[] = [];
  const end = new Date(Date.UTC(year, 11, 31));
  for (let d = new Date(Date.UTC(year, 0, 1)); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    dates.push(`${d.getUTCFullYear()}-${m}-${day}`);
  }
  return dates;
}

function mergeYearRows(prev: Record<string, any>[], year: number, cols: ColDef[]): Record<string, any>[] {
  const dates = generateYearDates(year);
  const existing = new Map(prev.map((r) => [r.log_date, r]));
  const yearRows = dates.map((d) => {
    const found = existing.get(d);
    if (found) return found;
    const blank: Record<string, any> = { log_date: d };
    cols.forEach((c) => (blank[c.key] = null));
    return blank;
  });
  const otherRows = prev.filter((r) => !r.log_date.startsWith(`${year}-`));
  return [...otherRows, ...yearRows].sort((a, b) => a.log_date.localeCompare(b.log_date));
}

export default function FactoryGrid({ factoryId, cols: initialCols, initialRows, weather, session }: Props) {
  const router = useRouter();
  const [cols, setCols] = useState<ColDef[]>(initialCols);
  const [rows, setRows] = useState<Row[]>(() => mergeYearRows(initialRows, new Date().getFullYear(), initialCols));
  const [wx] = useState(weather);
  const [saving, setSaving] = useState('');
  const [showAddCol, setShowAddCol] = useState(false);
  const isAdmin = session.role === 'admin';
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

  const updateLabel = async (colKey: string, newLabel: string) => {
    if (!newLabel.trim()) return;
    const col = cols.find((c) => c.key === colKey);
    const endpoint = col?.custom ? '/api/admin/columns' : '/api/labels';
    const method = col?.custom ? 'PATCH' : 'POST';
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factory_id: factoryId, col_key: colKey, label: newLabel.trim() }),
    });
    if (!res.ok) { alert('저장 실패'); return; }
    setCols(cols.map((c) => c.key === colKey ? { ...c, label: newLabel.trim() } : c));
  };

  const addColumn = async (label: string, tint: string) => {
    if (!label.trim()) return;
    const res = await fetch('/api/admin/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factory_id: factoryId, label: label.trim(), tint: tint || null }),
    });
    const j = await res.json();
    if (!res.ok) { alert(j.error || '실패'); return; }
    setCols([...cols, { key: j.column.col_key, label: j.column.label, tint: j.column.tint || undefined, custom: true }]);
  };

  const removeColumn = async (colKey: string) => {
    const col = cols.find((c) => c.key === colKey);
    if (!col) return;
    const msg = col.custom
      ? `"${col.label}" 컬럼을 삭제할까요? 해당 값도 함께 삭제됩니다.`
      : `"${col.label}" 컬럼을 숨길까요? (기본 컬럼은 값은 보존되고 화면에서만 제외됩니다)`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/admin/columns?factory_id=${factoryId}&col_key=${encodeURIComponent(colKey)}`, { method: 'DELETE' });
    if (!res.ok) { alert((await res.json()).error || '삭제 실패'); return; }
    setCols(cols.filter((c) => c.key !== colKey));
  };

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const onUploadFile = async (file: File) => {
    if (!confirm(`"${file.name}" 파일을 업로드하면 데이터가 채워집니다. 계속할까요?`)) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload-excel', { method: 'POST', body: fd });
    setUploading(false);
    if (!res.ok) { alert((await res.json()).error || '업로드 실패'); return; }
    const j = await res.json();
    const summary = (j.result || []).map((r: any) => `${r.sheet} ${r.processed}행`).join(', ');
    alert(`업로드 완료: ${summary}`);
    window.location.reload();
  };

  const fillYear = (year: number) => {
    setSelectedYear(year);
    setRows((prev) => mergeYearRows(prev, year, cols));
  };

  useEffect(() => {
    if (scrolledRef.current) return;
    if (rows.length === 0) return;
    const wrap = gridWrapRef.current;
    if (!wrap) return;
    const row = wrap.querySelector<HTMLElement>(`tr[data-date="${todayStr}"]`);
    if (!row) return;
    const thead = wrap.querySelector<HTMLElement>('thead');
    const headH = thead?.getBoundingClientRect().height || 0;
    const wrapTop = wrap.getBoundingClientRect().top;
    const rowTop = row.getBoundingClientRect().top;
    const offsetInWrap = rowTop - wrapTop + wrap.scrollTop;
    wrap.scrollTop = Math.max(0, offsetInWrap - headH - row.offsetHeight);
    scrolledRef.current = true;
  }, [rows]);

  const changeDate = async (oldDate: string, newDate: string) => {
    if (!newDate || oldDate === newDate) return;
    if (!isAdmin) { alert('날짜 수정 권한이 없습니다'); return; }
    if (rows.some((r) => r.log_date === newDate)) { alert('이미 존재하는 날짜입니다'); return; }
    const res = await fetch(`/api/factory/${factoryId}/change-date`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldDate, newDate }),
    });
    if (!res.ok) { alert((await res.json()).error || '실패'); return; }
    setRows((prev) => prev.map((r) => r.log_date === oldDate ? { ...r, log_date: newDate } : r).sort((a, b) => a.log_date.localeCompare(b.log_date)));
  };

  const canEditCell = (row: Row | undefined, key: string) => {
    if (isAdmin) return true;
    if (!row) return true;
    const v = row[key];
    if (v === null || v === undefined) return true;
    const meta = (row.cell_meta || {})[key];
    return !!meta && meta.by === session.name && meta.at === todayStr;
  };

  const updateCell = async (date: string, key: string, value: string, inputEl?: HTMLInputElement) => {
    const trimmed = value.trim();
    const num = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && Number.isNaN(num)) {
      alert('숫자만 입력');
      const row = rows.find((r) => r.log_date === date);
      const prev = row ? row[key] : null;
      if (inputEl) inputEl.value = prev == null ? '' : String(prev);
      return;
    }
    const row = rows.find((r) => r.log_date === date);
    if (!canEditCell(row, key)) {
      alert('이미 입력된 값은 수정 권한이 없습니다 (당일 본인이 입력한 값만 수정 가능)');
      const prev = row ? row[key] : null;
      if (inputEl) inputEl.value = prev == null ? '' : String(prev);
      return;
    }
    setSaving(date + key);
    const run = saveQueueRef.current.then(async () => {
      const res = await fetch(`/api/factory/${factoryId}/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_date: date, values: { [key]: num } }),
      });
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        alert(body.error || '저장 실패');
        return;
      }
      const stamp = { by: session.name, at: todayStr };
      setRows((prev) => prev.map((r) => {
        if (r.log_date !== date) return r;
        const baseMeta = body.cell_meta ?? r.cell_meta ?? {};
        const nextMeta = { ...baseMeta, [key]: stamp };
        return { ...r, [key]: num, cell_meta: nextMeta };
      }));
    });
    saveQueueRef.current = run.catch(() => {});
    try { await run; } finally { setSaving(''); }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  const navigate = (cur: HTMLInputElement, dRow: number, dCol: number) => {
    const curDate = cur.getAttribute('data-row') || '';
    const curKey = cur.getAttribute('data-col') || '';
    const visibleDates = rows.filter((r) => r.log_date.startsWith(`${selectedYear}-`)).map((r) => r.log_date);
    const dateIdx = visibleDates.indexOf(curDate);
    const colIdx = cols.findIndex((c) => c.key === curKey);
    if (dateIdx === -1 || colIdx === -1) return;
    let ri = dateIdx;
    let ci = colIdx;
    for (let step = 0; step < visibleDates.length * Math.max(cols.length, 1) + 2; step++) {
      ri += dRow;
      ci += dCol;
      if (ri < 0 || ri >= visibleDates.length || ci < 0 || ci >= cols.length) return;
      const sel = `input[data-row="${visibleDates[ri]}"][data-col="${cols[ci].key}"]`;
      const el = document.querySelector<HTMLInputElement>(sel);
      if (el && !el.disabled) {
        el.focus();
        el.select();
        return;
      }
    }
  };

  return (
    <div>
      <div className="topbar">
        <h2>{factoryId}공장</h2>
        <div className="right">
          <span className="user">{session.name}</span>
          <YearSelect years={years} value={selectedYear} onChange={fillYear} />
          {isAdmin && (
            <button className="add-col-btn" onClick={() => setShowAddCol(true)}>+ 열추가</button>
          )}
          {isAdmin && (
            <button
              type="button"
              className="upload-btn"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >{uploading ? '업로드중…' : '엑셀업로드'}</button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { onUploadFile(f); e.target.value = ''; }
            }}
          />
          <button className="back-btn" onClick={() => router.push('/')} aria-label="뒤로가기">←</button>
        </div>
      </div>
      <div className="grid-wrap" ref={gridWrapRef}>
        <table className="grid">
          <thead>
            <tr>
              <th className="date-head">날짜</th>
              {cols.map((c) => (
                <HeaderCell
                  key={c.key}
                  col={c}
                  isAdmin={isAdmin}
                  onSave={(v) => updateLabel(c.key, v)}
                  onDelete={isAdmin ? () => removeColumn(c.key) : undefined}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + 2} style={{ padding: 20, color: '#888' }}>상단에서 년도를 선택하면 1월 1일부터 12월 31일까지 행이 채워집니다.</td></tr>
            )}
            {rows.filter((r) => r.log_date.startsWith(`${selectedYear}-`)).map((r) => (
              <tr key={r.log_date} data-date={r.log_date}>
                <th className="date-cell">
                  <DateCell
                    date={r.log_date}
                    isAdmin={isAdmin}
                    onChange={(nd) => changeDate(r.log_date, nd)}
                  />
                </th>
                {cols.map((c) => {
                  const v = r[c.key];
                  const locked = !canEditCell(r, c.key);
                  const meta = (r.cell_meta || {})[c.key];
                  const title = `by=${meta?.by ?? '없음'}, at=${meta?.at ?? '없음'}, 현재=${session.name}/${todayStr}`;
                  const onLockedClick = () => {
                    if (!locked) return;
                    alert(`[수정 불가 진단]\n저장된 입력자: ${meta?.by ?? '(없음)'}\n저장된 입력일: ${meta?.at ?? '(없음)'}\n현재 사용자: ${session.name}\n오늘 날짜: ${todayStr}`);
                  };
                  return (
                    <td
                      key={c.key}
                      className={c.tint ? `tint-${c.tint}` : ''}
                      title={title}
                      onClick={onLockedClick}
                      style={locked ? { cursor: 'not-allowed', background: '#f5f5f5' } : undefined}
                    >
                      <input
                        key={`${r.log_date}-${c.key}-${v ?? ''}`}
                        defaultValue={v ?? ''}
                        disabled={locked}
                        autoComplete="off"
                        style={locked ? { pointerEvents: 'none' } : undefined}
                        inputMode="decimal"
                        enterKeyHint="next"
                        data-row={r.log_date}
                        data-col={c.key}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => {
                          const navKeys = ['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
                          if (!navKeys.includes(e.key)) return;
                          e.preventDefault();
                          const cur = e.currentTarget;
                          cur.blur();
                          let dRow = 0;
                          let dCol = 0;
                          if (e.key === 'Enter') dRow = 1;
                          else if (e.key === 'Tab') dCol = e.shiftKey ? -1 : 1;
                          else if (e.key === 'ArrowUp') dRow = -1;
                          else if (e.key === 'ArrowDown') dRow = 1;
                          else if (e.key === 'ArrowLeft') dCol = -1;
                          else if (e.key === 'ArrowRight') dCol = 1;
                          navigate(cur, dRow, dCol);
                        }}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          const newNum = val === '' ? null : Number(val);
                          if (!Number.isNaN(newNum) && (newNum ?? null) === (v ?? null)) return;
                          updateCell(r.log_date, c.key, val, e.target);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAddCol && (
        <AddColumnModal
          onClose={() => setShowAddCol(false)}
          onSubmit={(label, tint) => { setShowAddCol(false); addColumn(label, tint); }}
        />
      )}
    </div>
  );
}

function AddColumnModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (label: string, tint: string) => void }) {
  const [label, setLabel] = useState('');
  const [tint, setTint] = useState('');
  const TINTS = [
    { key: '', cls: 'sw-none', name: '없음' },
    { key: 'green', cls: 'sw-green', name: '녹색' },
    { key: 'orange', cls: 'sw-orange', name: '주황' },
    { key: 'pink', cls: 'sw-pink', name: '분홍' },
    { key: 'blue', cls: 'sw-blue', name: '하늘' },
    { key: 'purple', cls: 'sw-purple', name: '보라' },
  ];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>새 컬럼 추가</h3>
        <input
          type="text"
          placeholder="컬럼명"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && label.trim()) onSubmit(label, tint); }}
        />
        <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>음영색</div>
        <div className="tint-picker">
          {TINTS.map((t) => (
            <button
              key={t.key || 'none'}
              type="button"
              className={`tint-swatch ${t.cls} ${tint === t.key ? 'selected' : ''}`}
              title={t.name}
              onClick={() => setTint(t.key)}
            >{t.key === '' ? '∅' : ''}</button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>취소</button>
          <button type="button" className="btn-ok" onClick={() => label.trim() && onSubmit(label, tint)}>추가</button>
        </div>
      </div>
    </div>
  );
}

function HeaderCell({ col, isAdmin, onSave, onDelete }: { col: ColDef; isAdmin: boolean; onSave: (v: string) => void; onDelete?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(col.label);

  if (editing && isAdmin) {
    return (
      <th className={col.tint ? `tint-${col.tint}` : ''}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          onBlur={() => { setEditing(false); if (value !== col.label) onSave(value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(false); if (value !== col.label) onSave(value); } }}
          style={{ width: '100%', border: '1px solid #2d6cdf', padding: 4, fontSize: 13, textAlign: 'center', background: '#fff7cc' }}
        />
      </th>
    );
  }
  return (
    <th
      className={col.tint ? `tint-${col.tint}` : ''}
      style={isAdmin ? { cursor: 'pointer', position: 'relative' } : { position: 'relative' }}
      title={isAdmin ? '클릭해서 항목명 수정' : ''}
    >
      <span onClick={() => isAdmin && setEditing(true)}>{col.label}</span>
      {isAdmin && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="col-del-btn"
          title="컬럼 삭제"
          aria-label="컬럼 삭제"
        >✕</button>
      )}
    </th>
  );
}

function DateCell({ date, isAdmin, onChange }: { date: string; isAdmin: boolean; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing && isAdmin) {
    return (
      <input
        type="date"
        defaultValue={date}
        autoFocus
        onBlur={(e) => { setEditing(false); if (e.target.value !== date) onChange(e.target.value); }}
        style={{ width: '100%', border: '1px solid #2d6cdf', padding: 4 }}
      />
    );
  }
  return (
    <div className="date-cell-inner">
      <button type="button" onClick={() => isAdmin && setEditing(true)} title={isAdmin ? '클릭해서 날짜 변경' : '날짜 변경 권한이 없습니다'}>
        {formatKDate(date)}
      </button>
    </div>
  );
}
