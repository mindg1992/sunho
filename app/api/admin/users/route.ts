import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession, hashPin } from '@/lib/auth';

function guard() {
  const s = getSession();
  if (!s || s.role !== 'admin') return null;
  return s;
}

export async function POST(req: Request) {
  if (!guard()) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { name, pin, role } = await req.json();
  if (!name || !/^\d{4}$/.test(pin || '') || !['user', 'admin'].includes(role)) {
    return NextResponse.json({ error: '입력값 확인' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.from('users').insert({
    name, pin_hash: hashPin(name, pin), role,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

export async function PATCH(req: Request) {
  if (!guard()) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();

  // 정렬 순서 일괄 업데이트: { order: ['홍길동', '박유신', ...] }
  if (Array.isArray(body.order)) {
    const updates = body.order.map((name: string, idx: number) =>
      supabaseAdmin.from('users').update({ sort_order: (idx + 1) * 10 }).eq('name', name)
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // PIN 변경 (기존 PIN 확인 필수)
  const { name, pin, old_pin } = body;
  if (!name || !/^\d{4}$/.test(pin || '')) return NextResponse.json({ error: '입력값 확인' }, { status: 400 });
  if (!/^\d{4}$/.test(old_pin || '')) return NextResponse.json({ error: '기존 PIN 확인' }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from('users').select('pin_hash').eq('name', name).maybeSingle();
  if (!existing) return NextResponse.json({ error: '사용자 없음' }, { status: 404 });
  if (existing.pin_hash !== hashPin(name, old_pin)) {
    return NextResponse.json({ error: '기존 PIN이 올바르지 않습니다' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('users').update({ pin_hash: hashPin(name, pin) }).eq('name', name);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = guard();
  if (!s) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'name 필요' }, { status: 400 });
  if (name === s.name) return NextResponse.json({ error: '본인 삭제 불가' }, { status: 400 });
  const { error } = await supabaseAdmin.from('users').delete().eq('name', name);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
