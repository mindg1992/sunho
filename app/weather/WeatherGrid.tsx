'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatKDate } from '@/lib/columns';
import YearSelect from '@/app/YearSelect';
import { getBrowserSupabase } from '@/lib/supabaseBrowser';

type Row = {
  log_date: string;
  weather_text: string | null;
  factory1_workers: number | null;
  factory2_workers: number | null;
  updated_by?: string | null;
  cell_meta?: Record<string, { by: string; at: string }> | null;
};

type ColKey = 'factory1_workers' | 'factory2_workers' | 'weather_text';

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

function blankRow(d: string): Row {
  return { log_date: d, weather_text: null, factory1_workers: null, factory2_workers: null };
}

function mergeYearRows(prev: Row[], year: number): Row[] {
  const dates = generateYearDates(year);
  const existing = new Map(prev.map((r) => [r.log_date, r]));
  const yearRows = dates.map((d) => existing.get(d) ?? blankRow(d));
  const otherRows = prev.filter((r) => !r.log_date.startsWith(`${year}-`));
  return [...otherRows, ...yearRows].sort((a, b) => a.log_date.localeCompare(b.log_date));
}

export default function WeatherGrid({ session, initialRows }: { session: { name: string; role: string }; initialRows: Row[] }) {
  const router = useRouter();
  const isAdmin = session.role === 'admin';
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  const [rows, setRows] = useState<Row[]>(() => mergeYearRows(initialRows as Row[], currentYear));
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const saveQueuesByDateRef = useRef<Map<string, Promise<void>>>(new Map());
  const pendingDatesRef = useRef<Map<string, number>>(new Map());
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const dragAnchorRef = useRef<{ date: string; colKey: ColKey } | null>(null);
  const isDraggingRef = useRef(false);
  const mouseDownRef = useRef(false);

  const WEATHER_COLS: ColKey[] = ['factory1_workers', 'factory2_workers', 'weather_text'];
  const cellId = (date: string, colKey: ColKey) => `${date}|${colKey}`;

  const enqueueForDate = (date: string, body: () => Promise<void>): Promise<void> => {
    const prev = saveQueuesByDateRef.current.get(date) || Promise.resolve();
    const run = prev.then(body);
    const next = run.catch(() => {});
    saveQueuesByDateRef.current.set(date, next);
    next.then(() => {
      if (saveQueuesByDateRef.current.get(date) === next) {
        saveQueuesByDateRef.current.delete(date);
      }
    });
    return run;
  };

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
    setRows((prev) => mergeYearRows(prev, year));
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
  }, [rows, todayStr]);

  useEffect(() => {
    let channel: any = null;
    let supabase: any = null;
    try {
      supabase = getBrowserSupabase();
      if (!supabase) return;
      channel = supabase
        .channel('rt-weather_logs')
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table: 'weather_logs' },
          (payload: any) => {
            const newRec: any = payload.new;
            if (!newRec?.log_date) return;
            if ((pendingDatesRef.current.get(newRec.log_date) || 0) > 0) return;
            setRows((prev) => prev.map((r) => {
              if (r.log_date !== newRec.log_date) return r;
              return { ...r, ...newRec };
            }));
          },
        )
        .subscribe();
    } catch {}
    return () => {
      try { if (supabase && channel) supabase.removeChannel(channel); } catch {}
    };
  }, []);

  const computeRange = (anchor: { date: string; colKey: ColKey }, target: { date: string; colKey: ColKey }): Set<string> => {
    const visibleDates = rows.filter((r) => r.log_date.startsWith(`${selectedYear}-`)).map((r) => r.log_date);
    const a1 = visibleDates.indexOf(anchor.date);
    const a2 = visibleDates.indexOf(target.date);
    const c1 = WEATHER_COLS.indexOf(anchor.colKey);
    const c2 = WEATHER_COLS.indexOf(target.colKey);
    if (a1 < 0 || a2 < 0 || c1 < 0 || c2 < 0) return new Set();
    const r0 = Math.min(a1, a2);
    const r1 = Math.max(a1, a2);
    const cc0 = Math.min(c1, c2);
    const cc1 = Math.max(c1, c2);
    const set = new Set<string>();
    for (let i = r0; i <= r1; i++) {
      for (let j = cc0; j <= cc1; j++) {
        set.add(cellId(visibleDates[i], WEATHER_COLS[j]));
      }
    }
    return set;
  };

  const onCellMouseDown = (date: string, colKey: ColKey) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    mouseDownRef.current = true;
    isDraggingRef.current = false;
    dragAnchorRef.current = { date, colKey };
    setSelection(new Set());
  };

  const onCellMouseEnter = (date: string, colKey: ColKey) => () => {
    if (!mouseDownRef.current || !dragAnchorRef.current) return;
    const anchor = dragAnchorRef.current;
    if (!isDraggingRef.current && anchor.date === date && anchor.colKey === colKey) return;
    if (!isDraggingRef.current) {
      isDraggingRef.current = true;
      if (document.activeElement instanceof HTMLInputElement) {
        (document.activeElement as HTMLInputElement).blur();
      }
    }
    setSelection(computeRange(anchor, { date, colKey }));
  };

  useEffect(() => {
    const onUp = () => {
      mouseDownRef.current = false;
      if (!isDraggingRef.current) dragAnchorRef.current = null;
      isDraggingRef.current = false;
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  const canEditCell = (row: Row | undefined, key: ColKey): boolean => {
    if (isAdmin) return true;
    if (!row) return true;
    const v = row[key];
    if (v === null || v === undefined || v === '') return true;
    const meta = (row.cell_meta || {})[key];
    return !!meta && meta.by === session.name && meta.at === todayStr;
  };

  const updateCell = async (date: string, key: ColKey, raw: string, inputEl?: HTMLInputElement) => {
    let value: string | number | null;
    if (key === 'weather_text') {
      value = raw === '' ? null : raw;
    } else {
      const trimmed = raw.replace(/\D/g, '').slice(0, 4);
      value = trimmed === '' ? null : Number(trimmed);
    }
    const row = rows.find((r) => r.log_date === date);
    const prevValue = row ? row[key] : null;
    const prevMeta = row?.cell_meta || {};
    const resetInput = () => { if (inputEl) inputEl.value = prevValue == null ? '' : String(prevValue); };
    if (!canEditCell(row, key)) {
      alert('이미 입력된 값은 수정 권한이 없습니다 (당일 본인이 입력한 값만 수정 가능)');
      resetInput();
      return;
    }
    if ((prevValue ?? null) === (value ?? null)) return;

    const stamp = { by: session.name, at: todayStr };
    setRows((prev) => prev.map((r) => {
      if (r.log_date !== date) return r;
      const nextMeta = { ...(r.cell_meta || {}), [key]: stamp };
      return { ...r, [key]: value as any, cell_meta: nextMeta };
    }));
    pendingDatesRef.current.set(date, (pendingDatesRef.current.get(date) || 0) + 1);
    const revert = () => {
      setRows((prev) => prev.map((r) => {
        if (r.log_date !== date) return r;
        const newMeta = { ...(r.cell_meta || {}) };
        if (prevMeta[key]) newMeta[key] = prevMeta[key];
        else delete newMeta[key];
        return { ...r, [key]: prevValue as any, cell_meta: newMeta };
      }));
    };
    const run = enqueueForDate(date, async () => {
      const maxAttempts = 4;
      let lastErr = '';
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await fetch('/api/weather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log_date: date, values: { [key]: value } }),
          });
          const body = await res.json().catch(() => ({} as any));
          if (res.ok) {
            if (body.cell_meta) {
              setRows((prev) => prev.map((r) => {
                if (r.log_date !== date) return r;
                const serverEntry = body.cell_meta?.[key];
                return { ...r, cell_meta: { ...(r.cell_meta || {}), [key]: serverEntry || stamp }, updated_by: session.name };
              }));
            }
            return;
          }
          if (res.status >= 400 && res.status < 500) {
            alert(body.error || '저장 실패');
            revert();
            return;
          }
          lastErr = body.error || `서버 오류 ${res.status}`;
        } catch (err: any) {
          lastErr = err?.message || '네트워크 오류';
        }
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 300 * attempt));
      }
      alert(`저장 실패: ${lastErr}`);
      revert();
    });
    try { await run; } finally {
      const n = (pendingDatesRef.current.get(date) || 1) - 1;
      if (n <= 0) pendingDatesRef.current.delete(date); else pendingDatesRef.current.set(date, n);
    }
  };

  const cellValue = (r: Row, key: ColKey) => {
    const v = r[key];
    return v === null || v === undefined ? '' : String(v);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selection.size > 0) setSelection(new Set());
        return;
      }
      if (selection.size === 0) return;
      const active = document.activeElement;
      const inputFocused = active instanceof HTMLInputElement && !active.disabled && active.closest('table.grid');
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inputFocused) {
        e.preventDefault();
        for (const id of Array.from(selection)) {
          const sep = id.indexOf('|');
          const d = id.slice(0, sep);
          const k = id.slice(sep + 1) as ColKey;
          const r = rows.find((x) => x.log_date === d);
          if (!r) continue;
          if (!canEditCell(r, k)) continue;
          const curVal = r[k];
          if (curVal === null || curVal === undefined || curVal === '') continue;
          updateCell(d, k, '');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, rows, isAdmin, session.name, todayStr]);

  const findNeighborInput = (cur: HTMLInputElement, dRow: number, dCol: number): HTMLInputElement | null => {
    const curDate = cur.getAttribute('data-row') || '';
    const curKey = cur.getAttribute('data-col') as ColKey;
    const visibleDates = rows.filter((r) => r.log_date.startsWith(`${selectedYear}-`)).map((r) => r.log_date);
    const dateIdx = visibleDates.indexOf(curDate);
    const colIdx = WEATHER_COLS.indexOf(curKey);
    if (dateIdx === -1 || colIdx === -1) return null;
    let ri = dateIdx;
    let ci = colIdx;
    for (let step = 0; step < visibleDates.length * WEATHER_COLS.length + 2; step++) {
      ri += dRow;
      ci += dCol;
      if (ri < 0 || ri >= visibleDates.length || ci < 0 || ci >= WEATHER_COLS.length) return null;
      const sel = `input[data-row="${visibleDates[ri]}"][data-col="${WEATHER_COLS[ci]}"]`;
      const el = document.querySelector<HTMLInputElement>(sel);
      if (el && !el.disabled) return el;
    }
    return null;
  };

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const navKeys = ['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!navKeys.includes(e.key)) return;
    e.preventDefault();
    const cur = e.currentTarget;
    let dRow = 0;
    let dCol = 0;
    if (e.key === 'Enter') {
      const isTouch = typeof window !== 'undefined' && (
        navigator.maxTouchPoints > 0
        || 'ontouchstart' in window
        || window.matchMedia('(pointer: coarse)').matches
      );
      if (isTouch) dCol = 1;
      else dRow = 1;
    } else if (e.key === 'Tab') dCol = e.shiftKey ? -1 : 1;
    else if (e.key === 'ArrowUp') dRow = -1;
    else if (e.key === 'ArrowDown') dRow = 1;
    else if (e.key === 'ArrowLeft') dCol = -1;
    else if (e.key === 'ArrowRight') dCol = 1;
    const target = findNeighborInput(cur, dRow, dCol);
    if (!target) return;
    cur.blur();
    target.focus();
    target.select();
  };

  return (
    <div>
      <div className="topbar">
        <h2>날씨 입력</h2>
        <div className="right">
          <span className="user">{session.name}</span>
          <YearSelect years={years} value={selectedYear} onChange={fillYear} />
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
              <th>1공장 종업</th>
              <th>2공장 종업</th>
              <th>날씨</th>
            </tr>
          </thead>
          <tbody>
            {rows.filter((r) => r.log_date.startsWith(`${selectedYear}-`)).map((r) => (
              <tr key={r.log_date} data-date={r.log_date}>
                <th className="date-cell">
                  <div className="date-cell-inner">
                    <button type="button">{formatKDate(r.log_date)}</button>
                  </div>
                </th>
                {(['factory1_workers', 'factory2_workers'] as ColKey[]).map((k) => {
                  const v = cellValue(r, k);
                  const locked = !canEditCell(r, k);
                  const meta = (r.cell_meta || {})[k];
                  const isSelected = selection.has(cellId(r.log_date, k));
                  const onLockedClick = () => {
                    if (!locked) return;
                    alert(`[수정 불가 진단]\n저장된 입력자: ${meta?.by ?? '(없음)'}\n저장된 입력일: ${meta?.at ?? '(없음)'}\n현재 사용자: ${session.name}\n오늘 날짜: ${todayStr}`);
                  };
                  return (
                    <td
                      key={k}
                      className={isSelected ? 'cell-selected' : ''}
                      onClick={onLockedClick}
                      onMouseDown={onCellMouseDown(r.log_date, k)}
                      onMouseEnter={onCellMouseEnter(r.log_date, k)}
                      style={locked ? { cursor: 'not-allowed', background: '#f5f5f5' } : undefined}
                    >
                      <input
                        key={`${r.log_date}-${k}-${v}`}
                        defaultValue={v}
                        disabled={locked}
                        autoComplete="off"
                        draggable={false}
                        data-row={r.log_date}
                        data-col={k}
                        style={locked ? { pointerEvents: 'none' } : undefined}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        enterKeyHint="next"
                        onDragStart={(e) => e.preventDefault()}
                        onDrop={(e) => e.preventDefault()}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={handleCellKeyDown}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
                          if (cleaned !== e.target.value) e.target.value = cleaned;
                        }}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (v === val) return;
                          updateCell(r.log_date, k, val, e.target);
                        }}
                      />
                    </td>
                  );
                })}
                {(() => {
                  const v = cellValue(r, 'weather_text');
                  const locked = !canEditCell(r, 'weather_text');
                  const meta = (r.cell_meta || {})['weather_text'];
                  const isSelected = selection.has(cellId(r.log_date, 'weather_text'));
                  const onLockedClick = () => {
                    if (!locked) return;
                    alert(`[수정 불가 진단]\n저장된 입력자: ${meta?.by ?? '(없음)'}\n저장된 입력일: ${meta?.at ?? '(없음)'}\n현재 사용자: ${session.name}\n오늘 날짜: ${todayStr}`);
                  };
                  return (
                    <td
                      className={isSelected ? 'cell-selected' : ''}
                      onClick={onLockedClick}
                      onMouseDown={onCellMouseDown(r.log_date, 'weather_text')}
                      onMouseEnter={onCellMouseEnter(r.log_date, 'weather_text')}
                      style={locked ? { cursor: 'not-allowed', background: '#f5f5f5' } : undefined}
                    >
                      <input
                        key={`${r.log_date}-weather_text-${v}`}
                        type="text"
                        defaultValue={v}
                        disabled={locked}
                        autoComplete="off"
                        draggable={false}
                        data-row={r.log_date}
                        data-col="weather_text"
                        style={locked ? { pointerEvents: 'none' } : undefined}
                        enterKeyHint="next"
                        onDragStart={(e) => e.preventDefault()}
                        onDrop={(e) => e.preventDefault()}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={handleCellKeyDown}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (v === val) return;
                          updateCell(r.log_date, 'weather_text', val, e.target);
                        }}
                      />
                    </td>
                  );
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
