import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function guard() {
  const s = getSession();
  if (!s || s.role !== 'admin') return null;
  return s;
}

export async function POST(req: Request) {
  if (!guard()) return NextResponse.json({ error: '관리자만 가능' }, { status: 403 });
  const { factory_id, label, tint } = await req.json();
  if (!['1', '2'].includes(factory_id)) return NextResponse.json({ error: 'bad factory' }, { status: 400 });
  if (!label || !String(label).trim()) return NextResponse.json({ error: '컬럼명 필요' }, { status: 400 });

  const col_key = `cc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabaseAdmin
    .from('custom_columns')
    .insert({ factory_id, col_key, label: String(label).trim(), tint: tint || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ column: data });
}

export async function PATCH(req: Request) {
  if (!guard()) return NextResponse.json({ error: '관리자만 가능' }, { status: 403 });
  const { factory_id, col_key, label } = await req.json();
  if (!factory_id || !col_key || !label) return NextResponse.json({ error: '입력값 확인' }, { status: 400 });
  const { error } = await supabaseAdmin
    .from('custom_columns')
    .update({ label: String(label).trim() })
    .eq('factory_id', factory_id)
    .eq('col_key', col_key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!guard()) return NextResponse.json({ error: '관리자만 가능' }, { status: 403 });
  const u = new URL(req.url);
  const factory_id = u.searchParams.get('factory_id');
  const col_key = u.searchParams.get('col_key');
  if (!factory_id || !col_key) return NextResponse.json({ error: 'bad params' }, { status: 400 });

  // 커스텀 컬럼이면 실제 삭제, 기본 컬럼이면 hidden_columns로 숨김
  const { data: custom } = await supabaseAdmin
    .from('custom_columns').select('id')
    .eq('factory_id', factory_id).eq('col_key', col_key).maybeSingle();

  if (custom) {
    const { error } = await supabaseAdmin
      .from('custom_columns').delete()
      .eq('factory_id', factory_id).eq('col_key', col_key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, mode: 'deleted' });
  }

  const { error } = await supabaseAdmin
    .from('hidden_columns').upsert({ factory_id, col_key });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mode: 'hidden' });
}
