import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { colsFor, ColDef } from '@/lib/columns';
import { supabaseAdmin } from '@/lib/supabase';
import FactoryGrid from './FactoryGrid';

export const dynamic = 'force-dynamic';

export default async function FactoryPage({ params }: { params: { id: string } }) {
  const s = getSession();
  if (!s) redirect('/login');
  if (params.id !== '1' && params.id !== '2') notFound();

  const table = params.id === '1' ? 'factory1_logs' : 'factory2_logs';
  const [{ data: rows }, { data: wx }, { data: labelRows }, { data: customCols }, { data: hiddenRows }] = await Promise.all([
    supabaseAdmin.from(table).select('*').order('log_date', { ascending: true }),
    supabaseAdmin.from('weather_logs').select('log_date,weather_text'),
    supabaseAdmin.from('column_labels').select('col_key,label').eq('factory_id', params.id),
    supabaseAdmin.from('custom_columns').select('col_key,label,tint,sort_order,created_at')
      .eq('factory_id', params.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('hidden_columns').select('col_key').eq('factory_id', params.id),
  ]);

  const hiddenSet = new Set((hiddenRows || []).map((r: any) => r.col_key));

  const weatherMap: Record<string, string> = {};
  (wx || []).forEach((w: any) => { weatherMap[w.log_date] = w.weather_text || ''; });

  const customLabels: Record<string, string> = {};
  (labelRows || []).forEach((r: any) => { customLabels[r.col_key] = r.label; });

  const staticCols: ColDef[] = colsFor(params.id)
    .filter((c) => !hiddenSet.has(c.key))
    .map((c) => ({ ...c, label: customLabels[c.key] || c.label }));

  const customColDefs: ColDef[] = (customCols || []).map((c: any) => ({
    key: c.col_key,
    label: c.label,
    tint: c.tint || undefined,
    custom: true,
  }));

  const cols = [...staticCols, ...customColDefs];

  // 커스텀 컬럼 값을 row의 최상위 필드로 병합 (UI 단순화)
  const flatRows = (rows || []).map((r: any) => {
    const cv = r.custom_values || {};
    return { ...r, ...cv };
  });

  return (
    <FactoryGrid
      factoryId={params.id}
      cols={cols}
      initialRows={flatRows}
      weather={weatherMap}
      session={s}
    />
  );
}
