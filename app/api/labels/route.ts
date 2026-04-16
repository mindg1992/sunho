import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const fid = new URL(req.url).searchParams.get('factory');
  if (!fid) return NextResponse.json({ error: 'factory required' }, { status: 400 });
  const { data } = await supabaseAdmin.from('column_labels').select('col_key,label').eq('factory_id', fid);
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.col_key] = r.label; });
  return NextResponse.json({ labels: map });
}

export async function POST(req: Request) {
  const s = getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  const { factory_id, col_key, label } = await req.json();
  if (!factory_id || !col_key || !label) return NextResponse.json({ error: '입력값 확인' }, { status: 400 });
  const { error } = await supabaseAdmin.from('column_labels').upsert({ factory_id, col_key, label });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
