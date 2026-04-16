import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { FACTORY1_COLS, FACTORY2_COLS, formatKDate, ColDef } from '@/lib/columns';

// 한글은 폭 2배, ASCII는 1배로 가정해 헤더/데이터 글자 길이로 컬럼 너비 산정
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

export const dynamic = 'force-dynamic';

function buildSheet(wb: ExcelJS.Workbook, name: string, cols: ColDef[], rows: any[]) {
  const ws = wb.addWorksheet(name);

  const headers = ['날짜', ...cols.map((c) => c.label)];
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
  });

  const dateValues = (rows || []).map((r: any) => formatKDate(r.log_date));
  ws.getColumn(1).width = fitWidth('날짜', dateValues, 10);
  cols.forEach((c, i) => {
    const values = (rows || []).map((r: any) => r[c.key]);
    ws.getColumn(i + 2).width = fitWidth(c.label, values, 8);
  });

  (rows || []).forEach((r: any) => {
    const row = [formatKDate(r.log_date), ...cols.map((c) => r[c.key])];
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
}

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [{ data: rows1 }, { data: rows2 }, { data: wx }, { data: labelRows }, { data: customCols }] = await Promise.all([
    supabaseAdmin.from('factory1_logs').select('*').order('log_date'),
    supabaseAdmin.from('factory2_logs').select('*').order('log_date'),
    supabaseAdmin.from('weather_logs').select('log_date,weather_text'),
    supabaseAdmin.from('column_labels').select('factory_id,col_key,label'),
    supabaseAdmin.from('custom_columns').select('factory_id,col_key,label,tint,sort_order,created_at')
      .order('sort_order').order('created_at'),
  ]);

  const wmap: Record<string, string> = {};
  (wx || []).forEach((w: any) => (wmap[w.log_date] = w.weather_text || ''));

  const labels: Record<string, Record<string, string>> = {};
  (labelRows || []).forEach((r: any) => {
    if (!labels[r.factory_id]) labels[r.factory_id] = {};
    labels[r.factory_id][r.col_key] = r.label;
  });

  const customByFactory: Record<string, ColDef[]> = {};
  (customCols || []).forEach((c: any) => {
    if (!customByFactory[c.factory_id]) customByFactory[c.factory_id] = [];
    customByFactory[c.factory_id].push({ key: c.col_key, label: c.label, tint: c.tint || undefined });
  });

  const applyCols = (cols: ColDef[], fid: string): ColDef[] => [
    ...cols.map((c) => ({ ...c, label: labels[fid]?.[c.key] || c.label })),
    ...(customByFactory[fid] || []),
  ];

  const flat = (r: any) => ({ ...r, ...(r.custom_values || {}) });

  const wb = new ExcelJS.Workbook();
  buildSheet(wb, '1공장', applyCols(FACTORY1_COLS, '1'), (rows1 || []).map(flat));
  buildSheet(wb, '2공장', applyCols(FACTORY2_COLS, '2'), (rows2 || []).map(flat));

  // 날씨 탭
  const wsW = wb.addWorksheet('날씨');
  wsW.addRow(['날짜', '날씨']);
  const wHeader = wsW.getRow(1);
  wHeader.height = 36;
  wHeader.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0FF' } };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
  });
  const sortedWx = (wx || []).sort((a: any, b: any) => a.log_date.localeCompare(b.log_date));
  wsW.getColumn(1).width = fitWidth('날짜', sortedWx.map((w: any) => formatKDate(w.log_date)), 10);
  wsW.getColumn(2).width = fitWidth('날씨', sortedWx.map((w: any) => w.weather_text || ''), 12);
  sortedWx.forEach((w: any) => {
    const added = wsW.addRow([formatKDate(w.log_date), w.weather_text || '']);
    added.eachCell((cell, col) => {
      cell.alignment = { horizontal: col === 1 ? 'center' : 'left', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
    });
  });
  wsW.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  const today = new Date().toISOString().slice(0, 10);
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="sunho_${today}.xlsx"`,
    },
  });
}
