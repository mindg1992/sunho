import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { tableName, colsFor, formatKDate } from '@/lib/columns';

function textWidth(s: string): number {
  let w = 0;
  for (const ch of String(s ?? '')) {
    w += /[\u3131-\uD79D\uAC00-\uD7A3]/.test(ch) ? 2.2 : 1.1;
  }
  return w;
}
function fitWidth(label: string, values: any[] = [], min = 8, max = 40): number {
  const candidates = [textWidth(label), ...values.map((v) => textWidth(String(v ?? '')))];
  return Math.min(max, Math.max(min, Math.max(...candidates) + 2));
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let table: string;
  try { table = tableName(params.id); } catch { return NextResponse.json({ error: 'bad factory' }, { status: 400 }); }

  const [{ data: rows }, { data: wx }, { data: customCols }, { data: labelRows }] = await Promise.all([
    supabaseAdmin.from(table).select('*').order('log_date'),
    supabaseAdmin.from('weather_logs').select('log_date,weather_text'),
    supabaseAdmin.from('custom_columns').select('col_key,label,tint,sort_order,created_at')
      .eq('factory_id', params.id).order('sort_order').order('created_at'),
    supabaseAdmin.from('column_labels').select('col_key,label').eq('factory_id', params.id),
  ]);

  const labelMap: Record<string, string> = {};
  (labelRows || []).forEach((r: any) => { labelMap[r.col_key] = r.label; });

  const cols = [
    ...colsFor(params.id).map((c) => ({ ...c, label: labelMap[c.key] || c.label })),
    ...((customCols || []).map((c: any) => ({ key: c.col_key, label: c.label, tint: c.tint || undefined }))),
  ];

  // custom_values를 row 최상위로 병합
  const flatRows = (rows || []).map((r: any) => ({ ...r, ...(r.custom_values || {}) }));
  const wmap: Record<string, string> = {};
  (wx || []).forEach((w: any) => (wmap[w.log_date] = w.weather_text || ''));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${params.id}공장`);

  // 헤더
  const headers = ['날짜', ...cols.map((c) => c.label), '날씨'];
  ws.addRow(headers);
  const headerRow = ws.getRow(1);
  headerRow.height = 40;
  headerRow.eachCell((cell, col) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
    const colDef = cols[col - 2];
    if (colDef?.tint === 'green') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9ECD7' } };
    else if (colDef?.tint === 'orange') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBDCC5' } };
    else if (colDef?.tint === 'pink') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8C8DC' } };
    else if (colDef?.tint === 'blue') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBBDEFB' } };
    else if (colDef?.tint === 'purple') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE1BEE7' } };
    else cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    if (col === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9ECEF' } };
    if (col === headers.length) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0FF' } };
  });

  // 열 너비 (헤더/데이터 글자수 기준 자동)
  const dateValues = flatRows.map((r: any) => formatKDate(r.log_date));
  ws.getColumn(1).width = fitWidth('날짜', dateValues, 10);
  cols.forEach((c, i) => {
    const values = flatRows.map((r: any) => r[c.key]);
    ws.getColumn(i + 2).width = fitWidth(c.label, values, 8);
  });
  const wxValues = flatRows.map((r: any) => wmap[r.log_date] || '');
  ws.getColumn(headers.length).width = fitWidth('날씨', wxValues, 12);

  // 데이터
  flatRows.forEach((r: any) => {
    const row = [formatKDate(r.log_date), ...cols.map((c) => r[c.key]), wmap[r.log_date] || ''];
    const added = ws.addRow(row);
    added.eachCell((cell, col) => {
      cell.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
      const colDef = cols[col - 2];
      if (colDef?.tint === 'green') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF6E9' } };
      else if (colDef?.tint === 'orange') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDECE0' } };
      else if (colDef?.tint === 'pink') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
      else if (colDef?.tint === 'blue') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
      else if (colDef?.tint === 'purple') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };
    });
  });

  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  const today = new Date().toISOString().slice(0, 10);
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="factory${params.id}_${today}.xlsx"`,
    },
  });
}
