'use client';
import { useState } from 'react';

export default function LoginForm({ names }: { names: string[] }) {
  const [name, setName] = useState(names[0] || '');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr('');
    setLoading(true);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin }),
    });
    if (!res.ok) {
      setErr((await res.json()).error || '로그인 실패');
      setLoading(false);
      return;
    }
    location.href = '/';
  };

  if (names.length === 0) {
    return (
      <div className="seed-box">
        <p className="seed-msg">등록된 사용자가 없습니다.<br />최초 관리자를 생성해주세요.</p>
        <button className="seed-btn" onClick={async () => {
          const r = await fetch('/api/seed', { method: 'POST' });
          const j = await r.json();
          alert(j.message || JSON.stringify(j));
          location.reload();
        }}>관리자 시드 생성<span className="seed-sub">박유신 / PIN 1234</span></button>
      </div>
    );
  }

  return (
    <div className="login-form">
      <div className="field">
        <label htmlFor="login-name">이름</label>
        <div className="select-wrap">
          <select id="login-name" value={name} onChange={(e) => setName(e.target.value)}>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="select-caret">▾</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="login-pin">PIN (4자리)</label>
        <input
          id="login-pin"
          className="pin-input"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete="one-time-code"
          name="sunho-pin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => e.key === 'Enter' && pin.length === 4 && submit()}
          placeholder="● ● ● ●"
          autoFocus
        />
      </div>

      {err && <div className="err-box">{err}</div>}

      <button className="login-submit" disabled={loading || pin.length !== 4} onClick={submit}>
        {loading ? '확인 중...' : '로그인'}
      </button>
    </div>
  );
}
