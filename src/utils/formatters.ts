const intFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
});

export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return intFormatter.format(Math.round(value));
}

export function formatDec(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPct(ratio: number | null | undefined, decimals = 1): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '—';
  return `${formatDec(ratio * 100, decimals)}%`;
}

export function formatPctVal(pctValue: number | null | undefined, decimals = 1): string {
  if (pctValue === null || pctValue === undefined || Number.isNaN(pctValue)) return '—';
  return `${formatDec(pctValue, decimals)}%`;
}

export function formatCp(cp: number | null | undefined): string {
  if (cp === null || cp === undefined || Number.isNaN(cp)) return '—';
  if (cp === 0) return '0,0000';
  if (cp < 0.0001) return formatDec(cp, 6);
  return formatDec(cp, 4);
}

export function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const CLASS_PALETTE = [
  { bg: '#0F766E', light: '#CCFBF1', text: '#115E59', border: '#5EEAD4', name: 'Teal' },
  { bg: '#2563EB', light: '#DBEAFE', text: '#1E40AF', border: '#93C5FD', name: 'Azul' },
  { bg: '#D97706', light: '#FEF3C7', text: '#92400E', border: '#FCD34D', name: 'Ámbar' },
  { bg: '#7C3AED', light: '#EDE9FE', text: '#5B21B6', border: '#C4B5FD', name: 'Violeta' },
  { bg: '#DC2626', light: '#FEE2E2', text: '#991B1B', border: '#FCA5A5', name: 'Carmesí' },
  { bg: '#059669', light: '#D1FAE5', text: '#065F46', border: '#6EE7B7', name: 'Esmeralda' },
  { bg: '#DB2777', light: '#FCE7F3', text: '#9D174D', border: '#F9A8D4', name: 'Rosa' },
  { bg: '#475569', light: '#F1F5F9', text: '#1E293B', border: '#CBD5E1', name: 'Pizarra' },
];

export function getClassColor(classIndex: number) {
  return CLASS_PALETTE[((classIndex % CLASS_PALETTE.length) + CLASS_PALETTE.length) % CLASS_PALETTE.length];
}
