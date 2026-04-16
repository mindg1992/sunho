import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const s = getSession();
  if (!s) redirect('/login');
  if (s.role !== 'admin') redirect('/');
  const { data } = await supabaseAdmin
    .from('users')
    .select('id,name,role,sort_order,created_at')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name');
  return <AdminClient users={data || []} session={s} />;
}
