import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { FACTORY1_COLS, FACTORY2_COLS } from '@/lib/columns';

export const dynamic = 'force-dynamic';

function parseDate(v: any): string | null {
  if (v instanceof Date) {
    const yyyy = v.getUTCFullYear();
    const mm = String(v.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(v.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m = /^(\d{2})[\/-](\d{1,2})[\/-](\d{1,2})$/.exec(s);
  if (m) {
    const yy = Number(m[1]);
    const fullYear = yy + (yy >= 70 ? 1900 : 2000);
    return `${fullYear}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  m = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/.exec(s);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  return null;
}

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'object' && 'result' in v) v = (v as any).result;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n;
}

function cellText(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v !== null) {
    if ('richText' in v) return (v as any).richText.map((p: any) => p.text).join('');
    if ('text' in v) return String((v as any).text);
    if ('result' in v) return String((v as any).result ?? '');
  }
  return String(v);
}

async function processFactorySheet(
  ws: ExcelJS.Worksheet,
  factoryId: '1' | '2',
  userName: string,
): Promise<{ processed: number; skipped: number }> {
  const baseCols = factoryId === '1' ? FACTORY1_COLS : FACTORY2_COLS;
  const table = factoryId === '1' ? 'factory1_logs' : 'factory2_logs';

  const [{ data: labelRows }, { data: customCols }] = await Promise.all([
    supabaseAdmin.from('column_labels').select('col_key,label').eq('factory_id', factoryId),
    supabaseAdmin.from('custom_columns').select('col_key,label').eq('factory_id', factoryId),
  ]);

  const labelOverrides: Record<string, string> = {};
  (labelRows || []).forEach((r: any) => (labelOverrides[r.col_key] = r.label));

  const labelToKey = new Map<string, { key: string; custom: boolean }>();
  baseCols.forEach((c) => {
    const label = labelOverrides[c.key] || c.label;
    labelToKey.set(label.trim(), { key: c.key, custom: false });
  });
  (customCols || []).forEach((c: any) => {
    labelToKey.set(String(c.label).trim(), { key: c.col_key, custom: true });
  });

  const headerRow = ws.getRow(1);
  const colMap = new Map<number, { key: string; custom: boolean }>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber === 1) return;
    const headerText = cellText(cell.value).trim();
    if (!headerText) return;
    const info = labelToKey.get(headerText);
    if (info) colMap.set(colNumber, info);
  });

  type Update = { log_date: string; staticPatch: Record<string, any>; customPatch: Record<string, any> };
  const updates: Update[] = [];
  let skipped = 0;
  const lastRow = ws.actualRowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const dateStr = parseDate(row.getCell(1).value);
    if (!dateStr) { skipped++; continue; }
    const staticPatch: Record<string, any> = {};
    const customPatch: Record<string, any> = {};
    let hasValue = false;
    colMap.forEach((info, colNum) => {
      const v = parseNum(row.getCell(colNum).value);
      if (v === null) return;
      hasValue = true;
      if (info.custom) customPatch[info.key] = v;
      else staticPatch[info.key] = v;
    });
    if (!hasValue) { skipped++; continue; }
    updates.push({ log_date: dateStr, staticPatch, customPatch });
  }

  if (updates.length === 0) return { processed: 0, skipped };

  const dates = updates.map((u) => u.log_date);
  const { data: existingRows } = await supabaseAdmin
    .from(table)
    .select('log_date, custom_values')
    .in('log_date', dates);
  const existingMap = new Map((existingRows || []).map((r: any) => [r.log_date, r.custom_values || {}]));

  const upsertRows = updates.map((u) => ({
    log_date: u.log_date,
    ...u.staticPatch,
    custom_values: { ...(existingMap.get(u.log_date) || {}), ...u.customPatch },
    updated_by: userName,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin.from(table).upsert(upsertRows, { onConflict: 'log_date' });
  if (error) throw new Error(error.message);
  return { processed: updates.length, skipped };
}

async function processWeatherSheet(ws: ExcelJS.Worksheet, userName: string): Promise<{ processed: number; skipped: number }> {
  const headerRow = ws.getRow(1);
  const headerByCol = new Map<number, string>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headerByCol.set(colNumber, cellText(cell.value).trim());
  });

  let f1Col = 0, f2Col = 0, txtCol = 0;
  headerByCol.forEach((label, col) => {
    if (col === 1) return;
    if (label.includes('1공장')) f1Col = col;
    else if (label.includes('2공장')) f2Col = col;
    else if (label.includes('날씨')) txtCol = col;
  });

  const upsertRows: any[] = [];
  let skipped = 0;
  const lastRow = ws.actualRowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const dateStr = parseDate(row.getCell(1).value);
    if (!dateStr) { skipped++; continue; }
    const f1 = f1Col ? parseNum(row.getCell(f1Col).value) : null;
    const f2 = f2Col ? parseNum(row.getCell(f2Col).value) : null;
    const txt = txtCol ? cellText(row.getCell(txtCol).value).trim() : '';
    if (f1 === null && f2 === null && !txt) { skipped++; continue; }
    upsertRows.push({
      log_date: dateStr,
      factory1_workers: f1,
      factory2_workers: f2,
      weather_text: txt || null,
      updated_by: userName,
      updated_at: new Date().toISOString(),
    });
  }

  if (upsertRows.length === 0) return { processed: 0, skipped };
  const { error } = await supabaseAdmin.from('weather_logs').upsert(upsertRows, { onConflict: 'log_date' });
  if (error) throw new Error(error.message);
  return { processed: upsertRows.length, skipped };
}

export async function POST(req: Request) {
  const s = getSession();
  if (!s || s.role !== 'admin') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });

  let formData: FormData;
  try { formData = await req.formData(); } catch { return NextResponse.json({ error: '잘못된 요청' }, { status: 400 }); }
  const file = formData.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf as any); } catch { return NextResponse.json({ error: '엑셀 파일을 읽을 수 없습니다' }, { status: 400 }); }

  const result: { sheet: string; processed: number; skipped: number }[] = [];
  try {
    for (const fid of ['1', '2'] as const) {
      const ws = wb.getWorksheet(`${fid}공장`);
      if (!ws) continue;
      const r = await processFactorySheet(ws, fid, s.name);
      result.push({ sheet: `${fid}공장`, ...r });
    }
    const wsW = wb.getWorksheet('날씨');
    if (wsW) {
      const r = await processWeatherSheet(wsW, s.name);
      result.push({ sheet: '날씨', ...r });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '처리 중 오류' }, { status: 500 });
  }

  if (result.length === 0) {
    return NextResponse.json({ error: '엑셀에 1공장/2공장/날씨 탭이 없습니다' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, result });
}
