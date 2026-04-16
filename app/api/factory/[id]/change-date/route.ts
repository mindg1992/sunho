import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { tableName } from '@/lib/columns';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: '관리자만 가능' }, { status: 403 });
  const { oldDate, newDate } = await req.json();
  let table: string;
  try { table = tableName(params.id); } catch { return NextResponse.json({ error: 'bad factory' }, { status: 400 }); }
  const { error } = await supabaseAdmin.from(table).update({ log_date: newDate, updated_by: s.name }).eq('log_date', oldDate);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
