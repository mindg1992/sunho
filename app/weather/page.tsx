import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WeatherForm from './WeatherForm';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function WeatherPage() {
  const s = getSession();
  if (!s) redirect('/login');
  const { data } = await supabaseAdmin.from('weather_logs').select('*').order('log_date', { ascending: false }).limit(30);
  return <WeatherForm session={s} recent={data || []} />;
}
