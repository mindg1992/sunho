import Link from 'next/link';
import Image from 'next/image';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LogoutButton from './LogoutButton';
import ExcelButton from './ExcelButton';

const CloudIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.77 1.54A4 4 0 0 0 6.5 19Z" />
  </svg>
);

const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default function Home() {
  const s = getSession();
  if (!s) redirect('/login');
  return (
    <main className="home">
      <div className="home-title-row">
        <h1>선호피엔에스</h1>
        <div className="home-logo">
          <Image src="/logo.png" alt="선호피엔에스 로고" width={64} height={64} priority />
        </div>
      </div>
      <div className="sub">설비보전일지 · {s.name} ({s.role === 'admin' ? '관리자' : '입력자'})</div>
      <div className="btn-row">
        <Link href="/factory/1">
          <button className="big-btn">1공장</button>
        </Link>
        <Link href="/factory/2">
          <button className="big-btn alt">2공장</button>
        </Link>
        <Link href="/weather">
          <button className="big-btn alt2">
            <span className="btn-icon"><CloudIcon /></span>
            <span>날씨입력</span>
          </button>
        </Link>
        <ExcelButton />
      </div>
      <div style={{ marginTop: 24 }}>
        {s.role === 'admin' && (
          <Link href="/admin">
            <button className="big-btn admin-btn">
              <span className="btn-icon"><GearIcon /></span>
              <span>계정 관리</span>
            </button>
          </Link>
        )}
      </div>
      <LogoutButton />
    </main>
  );
}
