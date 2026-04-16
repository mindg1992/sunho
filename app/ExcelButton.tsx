'use client';

const ExcelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
);

export default function ExcelButton() {
  return (
    <button
      className="big-btn excel"
      onClick={() => { window.location.href = '/api/excel'; }}
    >
      <span className="btn-icon"><ExcelIcon /></span>
      <span>엑셀 다운로드</span>
    </button>
  );
}
