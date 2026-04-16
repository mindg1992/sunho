import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPin, makeToken } from '@/lib/auth';

export async function POST(req: Request) {
  const { name, pin } = await req.json();
  if (!name || !/^\d{4}$/.test(pin || '')) {
    return NextResponse.json({ error: '이름/PIN 확인' }, { status: 400 });
  }
  const { data: user } = await supabaseAdmin.from('users').select('*').eq('name', name).maybeSingle();
  if (!user || user.pin_hash !== hashPin(name, pin)) {
    return NextResponse.json({ error: 'PIN이 올바르지 않습니다' }, { status: 401 });
  }
  const token = makeToken(user.name, user.role);
  cookies().set('sunho_session', token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
  });
  return NextResponse.json({ ok: true });
}
