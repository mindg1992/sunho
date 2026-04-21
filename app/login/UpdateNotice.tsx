'use client';
import { useEffect, useState } from 'react';

const NOTICE_VERSION = '2026-04-21';
const STORAGE_KEY = 'sunho_update_notice_seen';

const items: (string | string[])[] = [
  ['입력자는 입력 후 수정 불가', '→ 당일 수정 가능'],
  'PC 모드 데이터 입력 UI/UX 개선',
  '저장 속도 및 반응 속도 개선',
  '1·2공장/날씨 표 토요일 파랑·일요일 빨강 음영',
];

export default function UpdateNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen !== NOTICE_VERSION) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, NOTICE_VERSION);
    } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="update-overlay" onClick={close}>
      <div className="update-modal" onClick={(e) => e.stopPropagation()}>
        <div className="update-header">
          <span className="update-badge">UPDATE</span>
          <h2 className="update-title">업데이트 안내</h2>
          <p className="update-date">{NOTICE_VERSION}</p>
        </div>
        <ul className="update-list">
          {items.map((t, i) => (
            <li key={i}>
              <span className="update-dot">•</span>
              <span>
                {Array.isArray(t)
                  ? t.map((line, j) => (
                      <span key={j} style={{ display: 'block' }}>
                        {line}
                      </span>
                    ))
                  : t}
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className="update-close" onClick={close}>
          확인
        </button>
      </div>
    </div>
  );
}
