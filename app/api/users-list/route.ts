import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data } = await supabaseAdmin.from('users').select('name').order('name');
  return NextResponse.json({ names: (data || []).map((r: any) => r.name) });
}
