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

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const buildMetaEntries = (keys: string[]) => {
    const m: Record<string, { by: string; at: string }> = {};
    for (const k of keys) m[k] = { by: s.name, at: todayStr };
    return m;
  };

  const { data: existing } = await supabaseAdmin.from('weather_logs').select('*').eq('log_date', log_date).maybeSingle();

  if (!existing) {
    const newMeta = buildMetaEntries(Object.keys(patch));
    const { error } = await supabaseAdmin.from('weather_logs').insert({
      log_date, ...patch, updated_by: s.name, updated_at: new Date().toISOString(),
      cell_meta: newMeta,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, created: true, cell_meta: newMeta });
  }

  const existingMeta: Record<string, { by?: string; at?: string }> = existing.cell_meta || {};

  if (s.role !== 'admin') {
    for (const k of Object.keys(patch) as Field[]) {
      const prev = existing[k];
      const next = patch[k];
      const prevEmpty = prev === null || prev === undefined || prev === '';
      if (!prevEmpty && next !== prev) {
        const m = existingMeta[k];
        if (!m || m.by !== s.name || m.at !== todayStr) {
          return NextResponse.json({ error: '이미 입력된 값은 수정 권한이 없습니다 (당일 본인이 입력한 값만 수정 가능)' }, { status: 403 });
        }
      }
    }
  }

  const mergedMeta = { ...existingMeta, ...buildMetaEntries(Object.keys(patch)) };
  const { error } = await supabaseAdmin.from('weather_logs').update({
    ...patch,
    updated_by: s.name,
    updated_at: new Date().toISOString(),
    cell_meta: mergedMeta,
  }).eq('log_date', log_date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cell_meta: mergedMeta });
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
