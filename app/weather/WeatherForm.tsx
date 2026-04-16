'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = { log_date: string; weather_text: string; updated_by?: string };

export default function WeatherForm({ session, recent }: { session: { name: string; role: string }; recent: Row[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [list, setList] = useState<Row[]>(recent);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const isAdmin = session.role === 'admin';
  const existing = list.find((r) => r.log_date === date);

  const save = async () => {
    setMsg('');
    const res = await fetch('/api/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_date: date, weather_text: text }),
    });
    const j = await res.json();
    if (!res.ok) { setMsg(j.error || '실패'); return; }
    setMsg('저장 완료');
    setList([{ log_date: date, weather_text: text, updated_by: session.name }, ...list.filter((r) => r.log_date !== date)]);
    setText('');
  };

  const startEdit = (r: Row) => {
    setEditingDate(r.log_date);
    setEditingText(r.weather_text || '');
  };

  const cancelEdit = () => {
    setEditingDate(null);
    setEditingText('');
  };

  const saveEdit = async (log_date: string) => {
    const res = await fetch('/api/weather', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_date, weather_text: editingText }),
    });
    const j = await res.json();
    if (!res.ok) { alert(j.error || '수정 실패'); return; }
    setList(list.map((r) => r.log_date === log_date ? { ...r, weather_text: editingText, updated_by: session.name } : r));
    cancelEdit();
  };

  const remove = async (log_date: string) => {
    if (!confirm(`${log_date} 날씨 기록을 삭제할까요?`)) return;
    const res = await fetch(`/api/weather?log_date=${encodeURIComponent(log_date)}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json();
      alert(j.error || '삭제 실패');
      return;
    }
    setList(list.filter((r) => r.log_date !== log_date));
  };

  return (
    <div>
      <div className="topbar">
        <h2>날씨 입력</h2>
        <div className="right">
          <span className="user">{session.name}</span>
          <button className="back-btn" onClick={() => router.push('/')} aria-label="뒤로가기">←</button>
        </div>
      </div>
      <div className="weather-wrap">
        <label>날짜</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label>날씨 (예: 맑음, 흐림, 비)</label>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
        <button onClick={save} disabled={!text || (!!existing && !isAdmin)}>저장</button>
        {msg && <div className="ok">{msg}</div>}

        <h3 style={{ marginTop: 28, color: 'var(--blue-700)' }}>최근 30일</h3>
        <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--blue-pale)', color: 'var(--blue-deep)' }}>
              <th style={{ padding: 8, border: '1px solid var(--line)' }}>날짜</th>
              <th style={{ padding: 8, border: '1px solid var(--line)' }}>날씨</th>
              <th style={{ padding: 8, border: '1px solid var(--line)' }}>작성자</th>
              {isAdmin && <th style={{ padding: 8, border: '1px solid var(--line)', width: 40 }}></th>}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.log_date}>
                <td style={{ padding: 8, border: '1px solid var(--line)', textAlign: 'center', fontWeight: 600 }}>{r.log_date}</td>
                <td style={{ padding: 4, border: '1px solid var(--line)' }}>
                  {editingDate === r.log_date ? (
                    <input
                      autoFocus
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onBlur={() => saveEdit(r.log_date)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(r.log_date); if (e.key === 'Escape') cancelEdit(); }}
                      style={{ width: '100%', padding: 6, border: '1.5px solid var(--blue-mid)', borderRadius: 6 }}
                    />
                  ) : (
                    isAdmin ? (
                      <span
                        onClick={() => startEdit(r)}
                        style={{ cursor: 'pointer', display: 'inline-block', padding: '4px 6px', borderRadius: 4 }}
                        title="클릭하여 수정"
                      >{r.weather_text || <span style={{ color: 'var(--ink-soft)', fontStyle: 'italic' }}>(빈 값 - 클릭하여 입력)</span>}</span>
                    ) : r.weather_text
                  )}
                </td>
                <td style={{ padding: 8, border: '1px solid var(--line)', textAlign: 'center', color: 'var(--ink-soft)' }}>{r.updated_by}</td>
                {isAdmin && (
                  <td style={{ padding: 2, border: '1px solid var(--line)', textAlign: 'center' }}>
                    <button onClick={() => remove(r.log_date)} className="flat-x" title="삭제" aria-label="삭제">✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
