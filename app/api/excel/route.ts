import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { FACTORY1_COLS, FACTORY2_COLS, formatKDate, ColDef } from '@/lib/columns';

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

function fillYearDates<T extends { log_date: string }>(
  year: number,
  rows: T[],
  blank: (date: string) => T,
): T[] {
  const map = new Map(rows.map((r) => [r.log_date, r]));
  const filled: T[] = [];
  const end = new Date(Date.UTC(year, 11, 31));
  for (let d = new Date(Date.UTC(year, 0, 1)); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const ds = `${d.getUTCFullYear()}-${m}-${day}`;
    filled.push(map.get(ds) ?? blank(ds));
  }
  return filled;
}

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

function buildWeatherSheet(wb: ExcelJS.Workbook, rows: any[]) {
  const ws = wb.addWorksheet('날씨');
  ws.addRow(['날짜', '1공장 종업', '2공장 종업', '날씨']);
  const header = ws.getRow(1);
  header.height = 36;
  header.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0FF' } };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
  });
  const sorted = (rows || []).sort((a: any, b: any) => a.log_date.localeCompare(b.log_date));
  ws.getColumn(1).width = fitWidth('날짜', sorted.map((w: any) => formatKDate(w.log_date)), 10);
  ws.getColumn(2).width = fitWidth('1공장 종업', sorted.map((w: any) => w.factory1_workers), 10);
  ws.getColumn(3).width = fitWidth('2공장 종업', sorted.map((w: any) => w.factory2_workers), 10);
  ws.getColumn(4).width = fitWidth('날씨', sorted.map((w: any) => w.weather_text || ''), 14);
  sorted.forEach((w: any) => {
    const added = ws.addRow([
      formatKDate(w.log_date),
      w.factory1_workers ?? '',
      w.factory2_workers ?? '',
      w.weather_text || '',
    ]);
    added.eachCell((cell, col) => {
      cell.alignment = { horizontal: col === 1 || col === 4 ? (col === 4 ? 'left' : 'center') : 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
    });
  });
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
}

export async function GET(req: Request) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const target = url.searchParams.get('factory') || '';
  const year = Number(url.searchParams.get('year'));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'bad year' }, { status: 400 });
  }
  if (!['1', '2', 'weather'].includes(target)) {
    return NextResponse.json({ error: 'bad factory' }, { status: 400 });
  }
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const wb = new ExcelJS.Workbook();
  let filename: string;

  if (target === '1' || target === '2') {
    const table = target === '1' ? 'factory1_logs' : 'factory2_logs';
    const baseCols = target === '1' ? FACTORY1_COLS : FACTORY2_COLS;
    const [{ data: rows }, { data: labelRows }, { data: customCols }, { data: hiddenRows }] = await Promise.all([
      supabaseAdmin.from(table).select('*').gte('log_date', start).lte('log_date', end).order('log_date'),
      supabaseAdmin.from('column_labels').select('col_key,label').eq('factory_id', target),
      supabaseAdmin.from('custom_columns').select('col_key,label,tint,sort_order,created_at').eq('factory_id', target).order('sort_order').order('created_at'),
      supabaseAdmin.from('hidden_columns').select('col_key').eq('factory_id', target),
    ]);
    const labels: Record<string, string> = {};
    (labelRows || []).forEach((r: any) => (labels[r.col_key] = r.label));
    const hiddenSet = new Set((hiddenRows || []).map((r: any) => r.col_key));
    const customColDefs: ColDef[] = (customCols || []).map((c: any) => ({ key: c.col_key, label: c.label, tint: c.tint || undefined }));
    const cols: ColDef[] = [
      ...baseCols.filter((c) => !hiddenSet.has(c.key)).map((c) => ({ ...c, label: labels[c.key] || c.label })),
      ...customColDefs,
    ];
    const flat = (rows || []).map((r: any) => ({ ...r, ...(r.custom_values || {}) }));
    const filled = fillYearDates(year, flat, (date) => ({ log_date: date }));
    buildSheet(wb, `${target}공장`, cols, filled);
    filename = `sunho_${target}공장_${year}.xlsx`;
  } else {
    const { data: wx } = await supabaseAdmin
      .from('weather_logs')
      .select('*')
      .gte('log_date', start).lte('log_date', end)
      .order('log_date');
    const filled = fillYearDates(year, wx || [], (date) => ({
      log_date: date, factory1_workers: null, factory2_workers: null, weather_text: null,
    }));
    buildWeatherSheet(wb, filled);
    filename = `sunho_날씨_${year}.xlsx`;
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
