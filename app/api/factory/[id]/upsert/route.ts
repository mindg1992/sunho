import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { tableName, colsFor } from '@/lib/columns';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { log_date, values } = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(log_date || '')) return NextResponse.json({ error: 'bad date' }, { status: 400 });

  let table: string;
  try { table = tableName(params.id); } catch { return NextResponse.json({ error: 'bad factory' }, { status: 400 }); }
  const staticKeys = new Set(colsFor(params.id).map((c) => c.key));

  const { data: customCols } = await supabaseAdmin
    .from('custom_columns').select('col_key').eq('factory_id', params.id);
  const customKeys = new Set((customCols || []).map((c: any) => c.col_key));

  const staticPatch: Record<string, any> = {};
  const customPatch: Record<string, any> = {};
  for (const k of Object.keys(values || {})) {
    if (staticKeys.has(k)) staticPatch[k] = values[k];
    else if (customKeys.has(k)) customPatch[k] = values[k];
  }

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const buildMetaEntries = (keys: string[]) => {
    const m: Record<string, { by: string; at: string }> = {};
    for (const k of keys) m[k] = { by: s.name, at: todayStr };
    return m;
  };

  const { data: existing } = await supabaseAdmin.from(table).select('*').eq('log_date', log_date).maybeSingle();

  if (!existing) {
    const newMeta = {
      ...buildMetaEntries(Object.keys(staticPatch)),
      ...buildMetaEntries(Object.keys(customPatch)),
    };
    const insertRow: any = {
      log_date,
      ...staticPatch,
      created_by: s.name,
      updated_by: s.name,
      cell_meta: newMeta,
    };
    if (Object.keys(customPatch).length > 0) insertRow.custom_values = customPatch;
    const { data: inserted, error } = await supabaseAdmin.from(table).insert(insertRow).select('cell_meta').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, created: true, cell_meta: inserted?.cell_meta || newMeta });
  }

  // 권한 체크: 비관리자는 본인이 당일 입력한 셀만 수정 가능. 빈 값은 누구나 입력 가능.
  const existingMeta: Record<string, { by?: string; at?: string }> = existing.cell_meta || {};
  const existingCustom = existing.custom_values || {};
  if (s.role !== 'admin') {
    const canOverwrite = (k: string, prev: any, next: any) => {
      if (prev === null || prev === undefined) return true; // 빈 값 새로 입력
      if (next === prev) return true; // 변화 없음
      const m = existingMeta[k];
      return !!m && m.by === s.name && m.at === todayStr;
    };
    for (const k of Object.keys(staticPatch)) {
      if (!canOverwrite(k, existing[k], staticPatch[k])) {
        return NextResponse.json({ error: '이미 입력된 값은 수정 권한이 없습니다 (당일 본인이 입력한 값만 수정 가능)' }, { status: 403 });
      }
    }
    for (const k of Object.keys(customPatch)) {
      if (!canOverwrite(k, existingCustom[k], customPatch[k])) {
        return NextResponse.json({ error: '이미 입력된 값은 수정 권한이 없습니다 (당일 본인이 입력한 값만 수정 가능)' }, { status: 403 });
      }
    }
  }

  const mergedMeta = {
    ...existingMeta,
    ...buildMetaEntries(Object.keys(staticPatch)),
    ...buildMetaEntries(Object.keys(customPatch)),
  };
  const patch: Record<string, any> = {
    ...staticPatch,
    updated_by: s.name,
    updated_at: new Date().toISOString(),
    cell_meta: mergedMeta,
  };
  if (Object.keys(customPatch).length > 0) {
    patch.custom_values = { ...existingCustom, ...customPatch };
  }
  const { data: updated, error } = await supabaseAdmin.from(table).update(patch).eq('log_date', log_date).select('cell_meta').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cell_meta: updated?.cell_meta || mergedMeta });
}
