'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColDef, formatKDate } from '@/lib/columns';

type Row = Record<string, any>;
type Props = {
  factoryId: string;
  cols: ColDef[];
  initialRows: Row[];
  weather: Record<string, string>;
  session: { name: string; role: string };
};

export default function FactoryGrid({ factoryId, cols: initialCols, initialRows, weather, session }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [cols, setCols] = useState<ColDef[]>(initialCols);
  const [wx] = useState(weather);
  const [saving, setSaving] = useState('');
  const [showAddCol, setShowAddCol] = useState(false);
  const isAdmin = session.role === 'admin';

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

  const removeRow = async (logDate: string) => {
    if (!isAdmin) return;
    if (!confirm(`${logDate} 행을 삭제할까요? 해당 날짜의 모든 값이 삭제됩니다.`)) return;
    const res = await fetch(`/api/factory/${factoryId}/delete-row?log_date=${logDate}`, { method: 'DELETE' });
    if (!res.ok) { alert((await res.json()).error || '삭제 실패'); return; }
    setRows(rows.filter((r) => r.log_date !== logDate));
  };

  // 행 추가: 날짜 선택
  const addRow = (dateStr: string) => {
    if (!dateStr) return;
    if (rows.some((r) => r.log_date === dateStr)) return;
    const blank: Row = { log_date: dateStr };
    cols.forEach((c) => (blank[c.key] = null));
    const next = [...rows, blank].sort((a, b) => a.log_date.localeCompare(b.log_date));
    setRows(next);
    // 서버에 빈 행 생성
    fetch(`/api/factory/${factoryId}/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_date: dateStr, values: {} }),
    });
  };

  const changeDate = async (oldDate: string, newDate: string) => {
    if (!newDate || oldDate === newDate) return;
    if (!isAdmin) { alert('날짜 수정은 관리자만 가능합니다'); return; }
    if (rows.some((r) => r.log_date === newDate)) { alert('이미 존재하는 날짜입니다'); return; }
    const res = await fetch(`/api/factory/${factoryId}/change-date`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldDate, newDate }),
    });
    if (!res.ok) { alert((await res.json()).error || '실패'); return; }
    setRows(rows.map((r) => r.log_date === oldDate ? { ...r, log_date: newDate } : r).sort((a, b) => a.log_date.localeCompare(b.log_date)));
  };

  const updateCell = async (date: string, key: string, value: string) => {
    const num = value === '' ? null : Number(value);
    if (value !== '' && Number.isNaN(num)) { alert('숫자만 입력'); return; }
    const row = rows.find((r) => r.log_date === date);
    const isNewValue = row && (row[key] === null || row[key] === undefined);
    if (!isNewValue && !isAdmin) {
      alert('이미 입력된 값의 수정은 관리자만 가능합니다');
      return;
    }
    setSaving(date + key);
    const res = await fetch(`/api/factory/${factoryId}/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_date: date, values: { [key]: num } }),
    });
    setSaving('');
    if (!res.ok) { alert((await res.json()).error || '저장 실패'); return; }
    setRows(rows.map((r) => r.log_date === date ? { ...r, [key]: num } : r));
  };

  const dateRef = { current: null as HTMLInputElement | null };

  return (
    <div>
      <div className="topbar">
        <h2>{factoryId}공장 설비보전일지</h2>
        <div className="right">
          <span className="user">{session.name} ({isAdmin ? '관리자' : '입력자'})</span>
          <button className="add-row-btn" onClick={() => {
            const input = dateRef.current;
            if (input) { input.showPicker ? input.showPicker() : input.click(); }
          }}>+ 행추가</button>
          {isAdmin && (
            <button className="add-col-btn" onClick={() => setShowAddCol(true)}>+ 열추가</button>
          )}
          <button className="back-btn" onClick={() => router.push('/')} aria-label="뒤로가기">←</button>
          <input
            ref={(el) => { dateRef.current = el; }}
            type="date"
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
            onChange={(e) => { if (e.target.value) { addRow(e.target.value); e.target.value = ''; } }}
          />
        </div>
      </div>
      <div className="grid-wrap">
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
              <tr><td colSpan={cols.length + 2} style={{ padding: 20, color: '#888' }}>상단의 "+ 추가"로 날짜를 추가하세요.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.log_date}>
                <th className="date-cell">
                  <DateCell
                    date={r.log_date}
                    isAdmin={isAdmin}
                    onChange={(nd) => changeDate(r.log_date, nd)}
                    onDelete={isAdmin ? () => removeRow(r.log_date) : undefined}
                  />
                </th>
                {cols.map((c) => {
                  const v = r[c.key];
                  const locked = !isAdmin && v !== null && v !== undefined;
                  return (
                    <td key={c.key} className={c.tint ? `tint-${c.tint}` : ''}>
                      <input
                        defaultValue={v ?? ''}
                        disabled={locked}
                        inputMode="decimal"
                        enterKeyHint="next"
                        data-row={r.log_date}
                        data-col={c.key}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            const cur = e.currentTarget;
                            cur.blur();
                            const allInputs = Array.from(
                              cur.closest('table')!.querySelectorAll<HTMLInputElement>('td input:not(:disabled)')
                            );
                            const idx = allInputs.indexOf(cur);
                            if (idx >= 0 && idx < allInputs.length - 1) {
                              allInputs[idx + 1].focus();
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if ((v ?? '') === val) return;
                          if ((v ?? '') === '' && val === '') return;
                          updateCell(r.log_date, c.key, val);
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

function DateCell({ date, isAdmin, onChange, onDelete }: { date: string; isAdmin: boolean; onChange: (v: string) => void; onDelete?: () => void }) {
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
      {onDelete && (
        <button
          type="button"
          className="row-del-btn"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
          title="행 삭제"
          aria-label="행 삭제"
        >✕</button>
      )}
      <button type="button" onClick={() => isAdmin && setEditing(true)} title={isAdmin ? '클릭해서 날짜 변경' : '날짜 변경은 관리자만 가능'}>
        {formatKDate(date)}
      </button>
    </div>
  );
}
