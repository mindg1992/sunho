'use client';
export default function LogoutButton() {
  return (
    <button
      style={{ marginTop: 16, padding: '8px 16px', background: 'transparent', border: '1px solid #999', borderRadius: 6 }}
      onClick={async () => {
        await fetch('/api/logout', { method: 'POST' });
        location.href = '/login';
      }}
    >
      로그아웃
    </button>
  );
}
