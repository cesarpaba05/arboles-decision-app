import { CategoricalStats, ColumnMeta, CrossTabRow, DataRow, NumericStats } from '../types';
import { formatDec } from '../utils/formatters';

function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function computeNumericStats(rows: DataRow[], colName: string): NumericStats | null {
  const vals: number[] = [];
  let missing = 0;

  for (const row of rows) {
    const v = row[colName];
    if (typeof v === 'number' && Number.isFinite(v)) {
      vals.push(v);
    } else if (v === null || v === undefined || v === '') {
      missing++;
    } else {
      const parsed = Number(String(v).replace(',', '.'));
      if (Number.isFinite(parsed)) vals.push(parsed);
      else missing++;
    }
  }

  const n = vals.length;
  if (n === 0) return null;

  const sorted = [...vals].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const median = quantileSorted(sorted, 0.5);
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;

  const variance =
    n > 1 ? vals.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const cv = mean !== 0 ? (sd / Math.abs(mean)) * 100 : 0;

  // Asimetría y curtosis muestral (estilo psych::describe)
  let skewness = 0;
  let kurtosis = 0;
  if (n >= 3 && sd > 0) {
    const m3 = vals.reduce((acc, x) => acc + ((x - mean) / sd) ** 3, 0) / n;
    skewness = (Math.sqrt(n * (n - 1)) / (n - 2)) * m3;
  }
  if (n >= 4 && sd > 0) {
    const m4 = vals.reduce((acc, x) => acc + ((x - mean) / sd) ** 4, 0) / n;
    kurtosis = m4 - 3;
  }

  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const inliers = sorted.filter((v) => v >= lowerFence && v <= upperFence);
  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);
  const whiskerLow = inliers.length > 0 ? inliers[0] : min;
  const whiskerHigh = inliers.length > 0 ? inliers[inliers.length - 1] : max;

  // Histograma (Sturges / 8-12 bins)
  const binCount = Math.max(5, Math.min(12, Math.ceil(Math.log2(n) + 1)));
  const span = max - min;
  const histogram: NumericStats['histogram'] = [];

  if (span === 0) {
    histogram.push({
      label: formatDec(min, 1),
      from: min,
      to: max,
      count: n,
      pct: 100,
    });
  } else {
    const step = span / binCount;
    for (let b = 0; b < binCount; b++) {
      const from = min + b * step;
      const to = b === binCount - 1 ? max : min + (b + 1) * step;
      const count = vals.filter((v) =>
        b === binCount - 1 ? v >= from && v <= to : v >= from && v < to
      ).length;
      const decs = span < 10 ? 2 : span < 100 ? 1 : 0;
      histogram.push({
        label: `${formatDec(from, decs)}–${formatDec(to, decs)}`,
        from,
        to,
        count,
        pct: (count / n) * 100,
      });
    }
  }

  return {
    column: colName,
    n,
    missing,
    mean,
    median,
    sd,
    min,
    max,
    q1,
    q3,
    iqr,
    cv,
    skewness,
    kurtosis,
    outliers,
    whiskerLow,
    whiskerHigh,
    histogram,
  };
}

export function computeCategoricalStats(
  rows: DataRow[],
  col: ColumnMeta,
  targetColName?: string
): CategoricalStats {
  const counts = new Map<string, number>();
  let validN = 0;

  for (const row of rows) {
    const raw = row[col.name];
    if (raw === null || raw === undefined || raw === '') continue;
    const key = String(raw);
    counts.set(key, (counts.get(key) || 0) + 1);
    validN++;
  }

  const levels = Array.from(counts.entries())
    .map(([level, count]) => ({
      level,
      count,
      pct: validN > 0 ? (count / validN) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  let crossTab: CrossTabRow[] | undefined;
  let cramersV: number | undefined;

  if (targetColName && targetColName !== col.name) {
    const targetLevelsSet = new Set<string>();
    const joint = new Map<string, Map<string, number>>();
    const predTotals = new Map<string, number>();
    const targetTotals = new Map<string, number>();
    let jointN = 0;

    for (const row of rows) {
      const pRaw = row[col.name];
      const tRaw = row[targetColName];
      if (pRaw === null || pRaw === undefined || pRaw === '' || tRaw === null || tRaw === undefined || tRaw === '') {
        continue;
      }
      const p = String(pRaw);
      const t = String(tRaw);
      targetLevelsSet.add(t);
      if (!joint.has(p)) joint.set(p, new Map());
      const inner = joint.get(p)!;
      inner.set(t, (inner.get(t) || 0) + 1);
      predTotals.set(p, (predTotals.get(p) || 0) + 1);
      targetTotals.set(t, (targetTotals.get(t) || 0) + 1);
      jointN++;
    }

    const targetLevels = Array.from(targetLevelsSet).sort((a, b) => a.localeCompare(b, 'es'));

    crossTab = levels.map((lvl) => {
      const inner = joint.get(lvl.level) || new Map<string, number>();
      const rowTotal = predTotals.get(lvl.level) || 0;
      const rowCounts: Record<string, number> = {};
      const rowPcts: Record<string, number> = {};
      for (const t of targetLevels) {
        const c = inner.get(t) || 0;
        rowCounts[t] = c;
        rowPcts[t] = rowTotal > 0 ? (c / rowTotal) * 100 : 0;
      }
      return {
        predictorLevel: lvl.level,
        total: rowTotal,
        counts: rowCounts,
        rowPcts,
      };
    });

    // Calcular V de Cramér para medir fuerza de asociación con la variable objetivo
    if (jointN > 0 && levels.length >= 2 && targetLevels.length >= 2) {
      let chi2 = 0;
      for (const lvl of levels) {
        const rTot = predTotals.get(lvl.level) || 0;
        const inner = joint.get(lvl.level) || new Map<string, number>();
        for (const t of targetLevels) {
          const cTot = targetTotals.get(t) || 0;
          const expected = (rTot * cTot) / jointN;
          if (expected > 0) {
            const obs = inner.get(t) || 0;
            chi2 += (obs - expected) ** 2 / expected;
          }
        }
      }
      const kMin = Math.min(levels.length - 1, targetLevels.length - 1);
      cramersV = kMin > 0 ? Math.sqrt(chi2 / (jointN * kMin)) : 0;
    }
  }

  return {
    column: col.name,
    n: validN,
    levels,
    crossTab,
    cramersV,
  };
}
