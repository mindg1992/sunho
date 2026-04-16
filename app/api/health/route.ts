import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('name, role, sort_order')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name');

    return NextResponse.json(
      { users: data || [], db_error: error?.message || null },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { users: [], error: e.message },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
