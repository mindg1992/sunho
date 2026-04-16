import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { log_date, weather_text } = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(log_date || '')) return NextResponse.json({ error: 'bad date' }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from('weather_logs').select('*').eq('log_date', log_date).maybeSingle();
  if (existing && s.role !== 'admin') {
    return NextResponse.json({ error: '이미 입력된 날짜 · 수정은 관리자만 가능' }, { status: 403 });
  }
  const { error } = await supabaseAdmin.from('weather_logs').upsert({
    log_date, weather_text, updated_by: s.name, updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const s = getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: '관리자만 수정 가능' }, { status: 403 });
  const { log_date, weather_text } = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(log_date || '')) return NextResponse.json({ error: 'bad date' }, { status: 400 });
  const { error } = await supabaseAdmin.from('weather_logs').update({
    weather_text, updated_by: s.name, updated_at: new Date().toISOString(),
  }).eq('log_date', log_date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: '관리자만 삭제 가능' }, { status: 403 });
  const log_date = new URL(req.url).searchParams.get('log_date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(log_date || '')) return NextResponse.json({ error: 'bad date' }, { status: 400 });
  const { error } = await supabaseAdmin.from('weather_logs').delete().eq('log_date', log_date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
