import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ColumnMeta, DataRow, VariableType } from '../types';

export interface DetectedDelimInfo {
  separator: ',' | ';' | '\t';
  decimal: '.' | ',';
}

export function detectTextFormatting(text: string): DetectedDelimInfo {
  const sampleLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 25);

  const candidates: (',' | ';' | '\t')[] = [',', ';', '\t'];
  let bestSep: ',' | ';' | '\t' = ',';
  let bestScore = -1;

  for (const sep of candidates) {
    const counts = sampleLines.map((line) => line.split(sep).length - 1);
    const nonZero = counts.filter((c) => c > 0);
    if (nonZero.length === 0) continue;
    const avg = nonZero.reduce((a, b) => a + b, 0) / sampleLines.length;
    const firstCount = counts[0] ?? 0;
    const consistency =
      counts.filter((c) => c === firstCount && c > 0).length / sampleLines.length;
    const score = avg * (0.5 + consistency);
    if (score > bestScore) {
      bestScore = score;
      bestSep = sep;
    }
  }

  // Detectar separador decimal mirando valores con patrón numérico
  let commaDecimalHits = 0;
  let dotDecimalHits = 0;
  for (const line of sampleLines.slice(1)) {
    const cells = line.split(bestSep);
    for (const raw of cells) {
      const cell = raw.trim().replace(/^["']|["']$/g, '');
      if (/^-?\d+,\d+$/.test(cell) && bestSep !== ',') {
        commaDecimalHits++;
      } else if (/^-?\d+\.\d+$/.test(cell)) {
        dotDecimalHits++;
      }
    }
  }

  const decimal: '.' | ',' =
    commaDecimalHits > dotDecimalHits && bestSep !== ',' ? ',' : '.';

  return { separator: bestSep, decimal };
}

function parseCellValue(raw: unknown, decimal: '.' | ','): string | number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  const str = String(raw).trim();
  if (str === '' || str.toUpperCase() === 'NA' || str.toUpperCase() === 'NULL' || str === 'N/A') {
    return null;
  }

  // Verificar si es número válido según el separador decimal elegido
  let normalized = str;
  if (decimal === ',') {
    // Formato europeo/latino: 1.234,56 -> 1234.56
    if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(str) || /^-?\d+,\d+$/.test(str)) {
      normalized = str.replace(/\./g, '').replace(',', '.');
    }
  } else {
    // Formato punto decimal: 1,234.56 -> 1234.56
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(str)) {
      normalized = str.replace(/,/g, '');
    }
  }

  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    const num = Number(normalized);
    if (Number.isFinite(num)) return num;
  }
  return str;
}

export function inferColumns(rows: DataRow[]): ColumnMeta[] {
  if (rows.length === 0) return [];
  const colNames = Object.keys(rows[0]).filter((c) => c.trim() !== '');

  return colNames.map((name) => {
    let missingCount = 0;
    let numericCount = 0;
    let nonMissingCount = 0;
    let allIntegers = true;
    const uniqueValues = new Set<string>();
    const samples: string[] = [];

    for (const row of rows) {
      const val = row[name];
      if (val === null || val === undefined || val === '') {
        missingCount++;
        continue;
      }
      nonMissingCount++;
      const strVal = String(val);
      uniqueValues.add(strVal);
      if (samples.length < 5 && !samples.includes(strVal)) {
        samples.push(strVal);
      }
      if (typeof val === 'number' && Number.isFinite(val)) {
        numericCount++;
        if (!Number.isInteger(val)) allIntegers = false;
      } else {
        allIntegers = false;
      }
    }

    const isNumeric = nonMissingCount > 0 && numericCount === nonMissingCount;
    const uniqueCount = uniqueValues.size;
    // Si tiene pocos enteros consecutivos (ej. 1, 2, 3), marcarlo como posible código categórico
    const isIntegerCoded = isNumeric && allIntegers && uniqueCount <= 6;
    const detectedType: VariableType = isNumeric ? 'numeric' : 'factor';

    const meta: ColumnMeta = {
      name,
      detectedType,
      type: detectedType,
      uniqueCount,
      missingCount,
      sampleValues: samples,
      isIntegerCoded,
    };

    if (detectedType === 'factor') {
      meta.levels = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b, 'es'));
    }
    return meta;
  });
}

export function applyColumnTypes(rows: DataRow[], columns: ColumnMeta[]): DataRow[] {
  const typeMap = new Map<string, VariableType>(columns.map((c) => [c.name, c.type]));

  return rows.map((row) => {
    const next: DataRow = {};
    for (const col of columns) {
      const val = row[col.name];
      const targetType = typeMap.get(col.name) || col.type;
      if (val === null || val === undefined || val === '') {
        next[col.name] = null;
      } else if (targetType === 'factor') {
        next[col.name] = String(val);
      } else {
        if (typeof val === 'number') {
          next[col.name] = Number.isFinite(val) ? val : null;
        } else {
          const parsed = Number(String(val).replace(',', '.'));
          next[col.name] = Number.isFinite(parsed) ? parsed : null;
        }
      }
    }
    return next;
  });
}

export function parseDelimitedText(
  rawText: string,
  separator: ',' | ';' | '\t',
  decimal: '.' | ','
): { rows: DataRow[]; columns: ColumnMeta[] } {
  const result = Papa.parse<Record<string, unknown>>(rawText, {
    delimiter: separator,
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const rawRows = result.data || [];
  const rows: DataRow[] = rawRows
    .filter((r) => Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== ''))
    .map((r) => {
      const clean: DataRow = {};
      for (const [k, v] of Object.entries(r)) {
        if (!k) continue;
        clean[k] = parseCellValue(v, decimal);
      }
      return clean;
    });

  const columns = inferColumns(rows);
  return { rows, columns };
}

export async function parseExcelBuffer(
  buffer: ArrayBuffer,
  decimal: '.' | ','
): Promise<{ rows: DataRow[]; columns: ColumnMeta[]; sheetName: string }> {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const rows: DataRow[] = jsonRows
    .filter((r) => Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== ''))
    .map((r) => {
      const clean: DataRow = {};
      for (const [k, v] of Object.entries(r)) {
        const key = k.trim();
        if (!key) continue;
        clean[key] = parseCellValue(v, decimal);
      }
      return clean;
    });

  const columns = inferColumns(rows);
  return { rows, columns, sheetName };
}

export function suggestTargetColumn(columns: ColumnMeta[]): {
  suggested: string;
  reason: string;
} {
  const factorCols = columns.filter((c) => c.type === 'factor' && c.uniqueCount >= 2);
  const priorityNames = [
    'desayuno',
    'abandono',
    'churn',
    'compra',
    'aprobacion',
    'adherencia',
    'desercion',
    'clase',
    'target',
    'objetivo',
    'resultado',
    'preferencia',
  ];

  for (const col of factorCols) {
    const lower = col.name.toLowerCase();
    if (priorityNames.some((p) => lower.includes(p)) && col.uniqueCount <= 10) {
      return {
        suggested: col.name,
        reason: `Es una variable categórica con ${col.uniqueCount} clases claras (${col.sampleValues.slice(0, 4).join(', ')}) y su nombre corresponde directamente a una decisión o resultado de negocio.`,
      };
    }
  }

  // Preferir una categórica con 2 a 6 clases, especialmente al final de la tabla
  const ideal = [...factorCols]
    .reverse()
    .find((c) => c.uniqueCount >= 2 && c.uniqueCount <= 6);
  if (ideal) {
    return {
      suggested: ideal.name,
      reason: `Es una variable categórica con ${ideal.uniqueCount} categorías bien definidas y ubicada como resultado en la tabla, ideal para clasificación con árboles CART.`,
    };
  }

  if (factorCols.length > 0) {
    const fallback = factorCols[factorCols.length - 1];
    return {
      suggested: fallback.name,
      reason: `Es la variable categórica disponible con menor ambigüedad (${fallback.uniqueCount} categorías).`,
    };
  }

  return {
    suggested: columns[columns.length - 1]?.name || '',
    reason: 'No se detectaron variables categóricas; convierte una variable a categórica (factor) en el Paso 5 para clasificar.',
  };
}
