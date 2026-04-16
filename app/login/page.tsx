'use client';
import LoginForm from './LoginForm';
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const [names, setNames] = useState<string[] | null>(null);

  useEffect(() => {
    fetch('/api/health?t=' + Date.now(), { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const users = j.users || [];
        setNames(users.map((u: any) => u.name));
      })
      .catch(() => setNames([]));
  }, []);

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <Image src="/logo.png" alt="선호피엔에스" width={88} height={88} priority />
        </div>
        <h1 className="login-title">선호피엔에스</h1>
        <p className="login-sub">설비보전일지</p>
        {names === null ? (
          <div className="login-loading">
            <div className="spinner" />
            <span>불러오는 중...</span>
          </div>
        ) : (
          <LoginForm names={names} />
        )}
      </div>
      <div className="login-footer">© 선호피엔에스</div>
    </div>
  );
}
