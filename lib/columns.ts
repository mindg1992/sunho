export type ColDef = { key: string; label: string; tint?: 'green' | 'orange' | string; custom?: boolean };

export const FACTORY1_COLS: ColDef[] = [
  { key: 'jungbuha', label: '중부하' },
  { key: 'choedae_buha', label: '최대부하' },
  { key: 'gyeongbuha', label: '경부하' },
  { key: 'muhyo_power', label: '무효전력' },
  { key: 'peak', label: '최대 피크치' },
  { key: 'yeokryul', label: '역률(%)' },
  { key: 'heup1', label: '흡수에 의한 시설(1)', tint: 'green' },
  { key: 'heup2', label: '흡수에 의한 시설(2)', tint: 'green' },
  { key: 'bag_acf', label: 'BAG FILTER ACF FILTER(3)', tint: 'green' },
  { key: 'water_main', label: '상수도(메인)' },
  { key: 'water_env', label: '상수도(환경)' },
  { key: 'gas', label: '가스검침', tint: 'orange' },
  { key: 'blower', label: '브로워압력(지하)' },
  { key: 'temp', label: '온도' },
  { key: 'ro_press', label: '로압' },
  { key: 'jungap', label: '정압기압력' },
  { key: 'comp50', label: '콤프(50hp)' },
  { key: 'baekfilter', label: '백필터' },
  { key: 'baekrpm', label: '백rpm' },
];

export const FACTORY2_COLS: ColDef[] = [
  { key: 'jung_choedae', label: '중부하+최대부하' },
  { key: 'gyeongbuha', label: '경부화' },
  { key: 'muhyo_power', label: '무효전력' },
  { key: 'peak', label: '최대 피크치' },
  { key: 'yeokryul', label: '역률(%)' },
  { key: 'heup1', label: '흡수에 의한 시설(1)', tint: 'green' },
  { key: 'heup2', label: '흡수에 의한 시설(2)', tint: 'green' },
  { key: 'bag_acf', label: 'BAG FILTER ACF FILTER(3)', tint: 'green' },
  { key: 'water_index', label: '상수도지침' },
  { key: 'sw1', label: 'S/W 1' },
  { key: 'sw2', label: 'S/W 2' },
  { key: 'gas', label: '가스검침', tint: 'orange' },
  { key: 'blower', label: '브로워압력(지하)' },
  { key: 'temp', label: '온도' },
  { key: 'ro_press', label: '로압' },
  { key: 'jungap', label: '정압기압력' },
  { key: 'comp50', label: '콤프(50hp)' },
  { key: 'baekfilter', label: '백필터' },
  { key: 'baekrpm', label: '백rpm' },
];

export function tableName(id: string) {
  if (id === '1') return 'factory1_logs';
  if (id === '2') return 'factory2_logs';
  throw new Error('invalid factory id');
}

export function colsFor(id: string): ColDef[] {
  return id === '1' ? FACTORY1_COLS : FACTORY2_COLS;
}

export function formatKDate(d: string) {
  const dt = new Date(d + 'T00:00:00');
  const yy = String(dt.getFullYear()).slice(2);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}/${mm}/${dd}`;
}

export function weekendClass(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  const w = dt.getDay();
  if (w === 6) return 'date-cell-sat';
  if (w === 0) return 'date-cell-sun';
  return '';
}
