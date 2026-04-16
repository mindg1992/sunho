'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatKDate } from '@/lib/columns';

type Row = {
  log_date: string;
  weather_text: string | null;
  factory1_workers: number | null;
  factory2_workers: number | null;
  updated_by?: string | null;
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
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  const [rows, setRows] = useState<Row[]>(() => mergeYearRows(initialRows as Row[], currentYear));
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
    router.refresh();
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
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
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

  const updateCell = async (date: string, key: ColKey, raw: string) => {
    let value: string | number | null;
    if (key === 'weather_text') {
      value = raw === '' ? null : raw;
    } else {
      const trimmed = raw.replace(/\D/g, '').slice(0, 4);
      value = trimmed === '' ? null : Number(trimmed);
    }
    const row = rows.find((r) => r.log_date === date);
    const prev = row ? row[key] : null;
    const prevEmpty = prev === null || prev === undefined || prev === '';
    if (!prevEmpty && !isAdmin && value !== prev) {
      alert('이미 입력된 값은 수정 권한이 없습니다');
      return;
    }
    if (prev === value) return;

    const res = await fetch('/api/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_date: date, values: { [key]: value } }),
    });
    if (!res.ok) { alert((await res.json()).error || '저장 실패'); return; }
    setRows(rows.map((r) => r.log_date === date ? { ...r, [key]: value, updated_by: session.name } : r));
  };

  const removeRow = async (date: string) => {
    if (!isAdmin) return;
    if (!confirm(`${date} 행을 삭제할까요?`)) return;
    const res = await fetch(`/api/weather?log_date=${encodeURIComponent(date)}`, { method: 'DELETE' });
    if (!res.ok) { alert((await res.json()).error || '삭제 실패'); return; }
    setRows(rows.map((r) => r.log_date === date ? blankRow(date) : r));
  };

  const cellValue = (r: Row, key: ColKey) => {
    const v = r[key];
    return v === null || v === undefined ? '' : String(v);
  };

  const isLocked = (r: Row, key: ColKey) => {
    if (isAdmin) return false;
    const v = r[key];
    return v !== null && v !== undefined && v !== '';
  };

  const moveFocus = (cur: HTMLInputElement) => {
    const all = Array.from(cur.closest('table')!.querySelectorAll<HTMLInputElement>('td input:not(:disabled)'));
    const idx = all.indexOf(cur);
    if (idx >= 0 && idx < all.length - 1) all[idx + 1].focus();
  };

  return (
    <div>
      <div className="topbar">
        <h2>날씨 입력</h2>
        <div className="right">
          <span className="user">{session.name}</span>
          <div className="year-slider" role="listbox" aria-label="년도 선택">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className={`year-chip${selectedYear === y ? ' selected' : ''}`}
                onClick={() => fillYear(y)}
              >{y}</button>
            ))}
          </div>
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
            {rows.map((r) => (
              <tr key={r.log_date} data-date={r.log_date}>
                <th className="date-cell">
                  <div className="date-cell-inner">
                    {isAdmin && (
                      <button type="button" className="row-del-btn" onClick={() => removeRow(r.log_date)} title="행 삭제" aria-label="행 삭제">✕</button>
                    )}
                    <button type="button">{formatKDate(r.log_date)}</button>
                  </div>
                </th>
                {(['factory1_workers', 'factory2_workers'] as ColKey[]).map((k) => {
                  const v = cellValue(r, k);
                  const locked = isLocked(r, k);
                  return (
                    <td key={k}>
                      <input
                        defaultValue={v}
                        disabled={locked}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        enterKeyHint="next"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            const cur = e.currentTarget;
                            cur.blur();
                            moveFocus(cur);
                          }
                        }}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
                          if (cleaned !== e.target.value) e.target.value = cleaned;
                        }}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (v === val) return;
                          updateCell(r.log_date, k, val);
                        }}
                      />
                    </td>
                  );
                })}
                {(() => {
                  const v = cellValue(r, 'weather_text');
                  const locked = isLocked(r, 'weather_text');
                  return (
                    <td>
                      <input
                        type="text"
                        defaultValue={v}
                        disabled={locked}
                        enterKeyHint="next"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            const cur = e.currentTarget;
                            cur.blur();
                            moveFocus(cur);
                          }
                        }}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (v === val) return;
                          updateCell(r.log_date, 'weather_text', val);
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
