import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { tableName } from '@/lib/columns';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const s = getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });

  let table: string;
  try { table = tableName(params.id); } catch { return NextResponse.json({ error: 'bad factory' }, { status: 400 }); }

  const log_date = new URL(req.url).searchParams.get('log_date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(log_date || '')) return NextResponse.json({ error: 'bad date' }, { status: 400 });

  const { error } = await supabaseAdmin.from(table).delete().eq('log_date', log_date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
