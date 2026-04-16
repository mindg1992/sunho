import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPin } from '@/lib/auth';

export async function POST() {
  const { count } = await supabaseAdmin.from('users').select('*', { count: 'exact', head: true });
  if ((count || 0) > 0) return NextResponse.json({ message: '이미 사용자가 존재합니다' });
  const name = '박유신';
  const pin_hash = hashPin(name, '1234');
  const { error } = await supabaseAdmin.from('users').insert({ name, pin_hash, role: 'admin' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: '관리자 박유신 / PIN 1234 생성됨' });
}
