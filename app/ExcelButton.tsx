'use client';
import { useState } from 'react';
import YearSelect from './YearSelect';

const ExcelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
);

export default function ExcelButton() {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  const download = (factory: '1' | '2' | 'weather') => {
    window.location.href = `/api/excel?factory=${factory}&year=${year}`;
    setOpen(false);
  };

  return (
    <>
      <button className="big-btn excel" onClick={() => setOpen(true)}>
        <span className="btn-icon"><ExcelIcon /></span>
        <span>엑셀 다운로드</span>
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>엑셀 다운로드</h3>
            <div className="excel-section-label">년도</div>
            <div className="excel-year-row">
              <YearSelect years={years} value={year} onChange={setYear} />
            </div>
            <div className="excel-section-label">다운로드 대상</div>
            <div className="excel-dl-row">
              <button type="button" className="excel-dl-btn f1" onClick={() => download('1')}>1공장</button>
              <button type="button" className="excel-dl-btn f2" onClick={() => download('2')}>2공장</button>
              <button type="button" className="excel-dl-btn wx" onClick={() => download('weather')}>날씨</button>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
