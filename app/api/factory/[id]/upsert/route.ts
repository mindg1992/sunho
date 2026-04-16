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

  // 사용자 정의 컬럼 키 조회
  const { data: customCols } = await supabaseAdmin
    .from('custom_columns').select('col_key').eq('factory_id', params.id);
  const customKeys = new Set((customCols || []).map((c: any) => c.col_key));

  const staticPatch: Record<string, any> = {};
  const customPatch: Record<string, any> = {};
  for (const k of Object.keys(values || {})) {
    if (staticKeys.has(k)) staticPatch[k] = values[k];
    else if (customKeys.has(k)) customPatch[k] = values[k];
  }

  const { data: existing } = await supabaseAdmin.from(table).select('*').eq('log_date', log_date).maybeSingle();

  if (!existing) {
    const insertRow: any = { log_date, ...staticPatch, created_by: s.name, updated_by: s.name };
    if (Object.keys(customPatch).length > 0) insertRow.custom_values = customPatch;
    const { error } = await supabaseAdmin.from(table).insert(insertRow);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, created: true });
  }

  // 권한 체크: 빈 값은 누구나 입력 가능, 기존 값 덮어쓰기는 관리자만
  if (s.role !== 'admin') {
    for (const k of Object.keys(staticPatch)) {
      if (existing[k] !== null && existing[k] !== undefined && staticPatch[k] !== existing[k]) {
        return NextResponse.json({ error: '이미 입력된 값은 수정 권한이 없습니다' }, { status: 403 });
      }
    }
    const existingCustom = existing.custom_values || {};
    for (const k of Object.keys(customPatch)) {
      const prev = existingCustom[k];
      if (prev !== null && prev !== undefined && customPatch[k] !== prev) {
        return NextResponse.json({ error: '이미 입력된 값은 수정 권한이 없습니다' }, { status: 403 });
      }
    }
  }

  const patch: Record<string, any> = { ...staticPatch, updated_by: s.name, updated_at: new Date().toISOString() };
  if (Object.keys(customPatch).length > 0) {
    patch.custom_values = { ...(existing.custom_values || {}), ...customPatch };
  }
  const { error } = await supabaseAdmin.from(table).update(patch).eq('log_date', log_date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
