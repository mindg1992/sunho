'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminClient({ users, session }: { users: any[]; session: { name: string } }) {
  const router = useRouter();
  const [list, setList] = useState(users);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [msg, setMsg] = useState('');

  const create = async () => {
    setMsg('');
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin, role }),
    });
    const j = await res.json();
    if (!res.ok) { setMsg(j.error || '실패'); return; }
    setList([...list, j.user]);
    setName(''); setPin(''); setRole('user');
    setMsg('생성됨');
  };

  const resetPin = async (userName: string) => {
    const oldPin = prompt(`${userName}의 기존 PIN (4자리)`);
    if (!oldPin || !/^\d{4}$/.test(oldPin)) return;
    const newPin = prompt(`${userName}의 새 PIN (4자리)`);
    if (!newPin || !/^\d{4}$/.test(newPin)) return;
    const res = await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName, pin: newPin, old_pin: oldPin }),
    });
    alert(res.ok ? 'PIN 변경됨' : (await res.json()).error);
  };

  const remove = async (userName: string) => {
    if (userName === session.name) { alert('본인은 삭제 불가'); return; }
    if (!confirm(`${userName} 삭제?`)) return;
    const res = await fetch(`/api/admin/users?name=${encodeURIComponent(userName)}`, { method: 'DELETE' });
    if (res.ok) setList(list.filter((u) => u.name !== userName));
    else alert((await res.json()).error);
  };

  const persistOrder = async (next: any[]) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next.map((u) => u.name) }),
    });
    if (!res.ok) {
      alert((await res.json()).error || '순서 저장 실패');
      router.refresh();
    } else {
      setMsg('순서 저장됨');
      setTimeout(() => setMsg(''), 1500);
    }
  };

  // 드래그/스와이프 재정렬
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);

  const onPointerDown = (e: React.PointerEvent, idx: number) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragIdx(idx);
    setOverIdx(idx);
    startY.current = e.clientY;
    setDragY(0);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    const delta = e.clientY - startY.current;
    setDragY(delta);
    // 어느 행 위에 있는지 탐색
    const y = e.clientY;
    let target = dragIdx;
    for (let i = 0; i < rowRefs.current.length; i++) {
      const el = rowRefs.current[i];
      if (!el || i === dragIdx) continue;
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) { target = i; break; }
    }
    setOverIdx(target);
  };

  const onPointerUp = () => {
    if (dragIdx === null) { return; }
    const from = dragIdx;
    const to = overIdx ?? dragIdx;
    setDragIdx(null);
    setOverIdx(null);
    setDragY(0);
    if (from === to) return;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setList(next);
    persistOrder(next);
  };

  return (
    <div>
      <div className="topbar">
        <h2>계정 관리</h2>
        <div className="right">
          <button className="back-btn" onClick={() => router.push('/')} aria-label="뒤로가기">←</button>
        </div>
      </div>
      <div className="admin-wrap">
        <h3 className="admin-h">새 계정 추가</h3>
        <div className="admin-create">
          <input placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="PIN 4자리" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          <select value={role} onChange={(e) => setRole(e.target.value as any)}>
            <option value="user">입력자</option>
            <option value="admin">관리자</option>
          </select>
          <button onClick={create} disabled={!name || pin.length !== 4} className="row-btn save admin-add">추가</button>
        </div>
        {msg && <div className="ok">{msg}</div>}

        <h3 className="admin-h" style={{ marginTop: 28 }}>사용자 목록</h3>
        <p className="admin-hint">≡ 핸들을 꾹 눌러서 위/아래로 드래그하면 로그인 화면 순서가 바뀝니다. 놓으면 자동 저장됩니다.</p>

        <ul
          className="user-list"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {list.map((u, i) => {
            const isDragging = dragIdx === i;
            return (
              <li
                key={u.name}
                ref={(el) => { rowRefs.current[i] = el; }}
                className={`user-row${isDragging ? ' dragging' : ''}${overIdx === i && !isDragging ? ' drop-target' : ''}`}
                style={isDragging ? { transform: `translateY(${dragY}px)` } : undefined}
              >
                <span
                  className="drag-handle"
                  onPointerDown={(e) => onPointerDown(e, i)}
                  title="드래그하여 순서 변경"
                >≡</span>
                <span className="user-name">
                  {u.name}
                  <span className={`user-role ${u.role === 'admin' ? 'admin' : ''}`}>
                    {u.role === 'admin' ? '관리자' : '입력자'}
                  </span>
                </span>
                <span className="user-actions">
                  <button onClick={() => resetPin(u.name)} className="icon-btn edit" title="PIN 변경" aria-label="PIN 변경">✎</button>
                  <button onClick={() => remove(u.name)} disabled={u.name === session.name} className="icon-btn del" title="삭제" aria-label="삭제">✕</button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
