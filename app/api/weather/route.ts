import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

const FIELDS = ['weather_text', 'factory1_workers', 'factory2_workers'] as const;
type Field = (typeof FIELDS)[number];

function pickPatch(values: Record<string, any>): Record<string, any> {
  const patch: Record<string, any> = {};
  for (const k of FIELDS) {
    if (k in values) patch[k] = values[k];
  }
  return patch;
}

export async function POST(req: Request) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const { log_date } = body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(log_date || '')) return NextResponse.json({ error: 'bad date' }, { status: 400 });

  const patch = pickPatch(body.values || body);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: '저장할 값이 없습니다' }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from('weather_logs').select('*').eq('log_date', log_date).maybeSingle();

  if (existing && s.role !== 'admin') {
    for (const k of Object.keys(patch) as Field[]) {
      const prev = existing[k];
      const next = patch[k];
      const prevEmpty = prev === null || prev === undefined || prev === '';
      if (!prevEmpty && next !== prev) {
        return NextResponse.json({ error: '이미 입력된 값은 수정 권한이 없습니다' }, { status: 403 });
      }
    }
  }

  const { error } = await supabaseAdmin.from('weather_logs').upsert({
    log_date, ...patch, updated_by: s.name, updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const s = getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: '수정 권한이 없습니다' }, { status: 403 });
  const body = await req.json();
  const { log_date } = body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(log_date || '')) return NextResponse.json({ error: 'bad date' }, { status: 400 });
  const patch = pickPatch(body.values || body);
  const { error } = await supabaseAdmin.from('weather_logs').update({
    ...patch, updated_by: s.name, updated_at: new Date().toISOString(),
  }).eq('log_date', log_date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: '삭제 권한이 없습니다' }, { status: 403 });
  const log_date = new URL(req.url).searchParams.get('log_date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(log_date || '')) return NextResponse.json({ error: 'bad date' }, { status: 400 });
  const { error } = await supabaseAdmin.from('weather_logs').delete().eq('log_date', log_date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
