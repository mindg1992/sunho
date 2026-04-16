import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WeatherGrid from './WeatherGrid';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function WeatherPage() {
  const s = getSession();
  if (!s) redirect('/login');
  const { data } = await supabaseAdmin
    .from('weather_logs')
    .select('*')
    .order('log_date', { ascending: true });
  return <WeatherGrid session={s} initialRows={data || []} />;
}
