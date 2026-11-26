import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle2, RefreshCw, Shuffle } from 'lucide-react';
import { ColumnMeta, DataRow, SplitConfig } from '../../types';
import { suggestTargetColumn } from '../../engine/parser';
import { formatDec, formatInt, getClassColor } from '../../utils/formatters';

interface Step8Props {
  rows: DataRow[];
  columns: ColumnMeta[];
  targetCol: string;
  onSelectTarget: (col: string) => void;
}

export const Step08TargetVariable: React.FC<Step8Props> = ({
  rows,
  columns,
  targetCol,
  onSelectTarget,
}) => {
  const factorCols = columns.filter((c) => c.type === 'factor' && c.uniqueCount >= 2);
  const suggestion = suggestTargetColumn(columns);

  const counts = new Map<string, number>();
  let totalValid = 0;
  for (const r of rows) {
    const v = r[targetCol];
    if (v === null || v === undefined || v === '') continue;
    const key = String(v);
    counts.set(key, (counts.get(key) || 0) + 1);
    totalValid++;
  }

  const dist = Array.from(counts.entries())
    .map(([cls, count]) => ({
      cls,
      count,
      pct: totalValid > 0 ? (count / totalValid) * 100 : 0,
      label: `${formatInt(count)} (${formatDec(totalValid > 0 ? (count / totalValid) * 100 : 0, 1)}%)`,
    }))
    .sort((a, b) => b.count - a.count);

  const majorityClass = dist[0];
  const baseAccuracy = majorityClass ? majorityClass.pct / 100 : 0;
  const baseError = 1 - baseAccuracy;
  const minorityClasses = dist.filter((d) => d.pct < 20);

  return (
    <div className="space-y-6">
      {/* Sugerencia automática */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-blue-800">
              Sugerencia automática del asistente
            </div>
            <div className="mt-0.5 text-sm font-bold text-slate-900">
              Variable recomendada: <span className="font-mono text-blue-800">{suggestion.suggested}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">
              {suggestion.reason}
            </p>
          </div>
          {targetCol !== suggestion.suggested && suggestion.suggested && (
            <button
              type="button"
              onClick={() => onSelectTarget(suggestion.suggested)}
              className="shrink-0 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
            >
              Usar variable sugerida
            </button>
          )}
        </div>
      </div>

      {/* Selector de variable objetivo */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900">
          Confirma o elige la variable dependiente (lo que quieres predecir)
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {factorCols.map((col) => {
            const active = col.name === targetCol;
            return (
              <button
                key={col.name}
                type="button"
                onClick={() => onSelectTarget(col.name)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                <span>{col.name}</span>
                <span className={`font-mono ${active ? 'text-teal-100' : 'text-slate-400'}`}>
                  ({col.uniqueCount})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPIs de error base y distribución */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Clase más frecuente</div>
          <div className="mt-1 text-lg font-bold text-slate-900">
            {majorityClass?.cls || '—'}
          </div>
          <div className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
            {formatDec(majorityClass?.pct || 0, 1)}% de los casos
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Exactitud sin modelo (NIR)</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatDec(baseAccuracy * 100, 1)}%
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Si siempre apostaras por "{majorityClass?.cls}"
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Error base de referencia</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-amber-700">
            {formatDec(baseError * 100, 1)}%
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Meta: nuestro árbol debe reducir este error
          </div>
        </div>
      </div>

      {/* Alerta de desbalance < 20% */}
      {minorityClasses.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <div className="font-bold">Advertencia de desbalance de clases</div>
            <p className="mt-1 text-xs leading-relaxed text-amber-900">
              {minorityClasses
                .map((m) => `"${m.cls}" (${formatDec(m.pct, 1)}%)`)
                .join(', ')}{' '}
              representa menos del 20% del total. Cuando las clases están desbalanceadas, la exactitud global (accuracy) puede parecer alta aunque el árbol ignore la clase minoritaria; en el Paso 12 vigilaremos especialmente el <strong>F1-Score</strong> de cada clase.
            </p>
          </div>
        </div>
      )}

      {/* Gráfico y tabla de distribución */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">
            Distribución de clases en {targetCol}
          </h3>
          <div className="mt-3 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist} margin={{ top: 24, right: 12, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="cls" tick={{ fontSize: 11, fill: '#334155' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  formatter={(val: unknown) => [formatInt(Number(val)), 'Consumidores']}
                />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {dist.map((entry, idx) => (
                    <Cell key={entry.cls} fill={getClassColor(idx).bg} />
                  ))}
                  <LabelList
                    dataKey="label"
                    position="top"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      fill: '#0F172A',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">Tabla de frecuencias</h3>
          </div>
          <table className="w-full border-collapse text-sm tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-xs font-semibold text-slate-600">
                <th className="px-4 py-2.5 text-left">Categoría</th>
                <th className="px-4 py-2.5 text-right">Consumidores</th>
                <th className="px-4 py-2.5 text-right">Participación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dist.map((d, idx) => (
                <tr key={d.cls}>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: getClassColor(idx).bg }}
                    />
                    {d.cls}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatInt(d.count)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatDec(d.pct, 1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface Step9Props {
  seed: number;
  onChangeSeedAndSplit: (newSeed: number) => void;
  splitConfig: SplitConfig | null;
  targetCol: string;
}

export const Step09TrainTestSplit: React.FC<Step9Props> = ({
  seed,
  onChangeSeedAndSplit,
  splitConfig,
  targetCol,
}) => {
  if (!splitConfig) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Define primero una variable objetivo válida en el Paso 8 para crear la partición 70/30.
      </div>
    );
  }

  const nTrain = splitConfig.trainIndices.length;
  const nTest = splitConfig.testIndices.length;
  const nTotal = nTrain + nTest;

  return (
    <div className="space-y-6">
      {/* Control de semilla reproducible */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h2 className="text-sm font-bold text-slate-900">
            Semilla aleatoria reproducible (set.seed)
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            La partición estratificada conserva el mismo porcentaje de cada categoría de <strong>{targetCol}</strong> tanto en entrenamiento (70%) como en prueba (30%). Cambiar la semilla genera otra división aleatoria, pero usando el mismo número siempre obtendrás exactamente los mismos grupos.
          </p>
        </div>

        <div className="flex shrink-0 items-end gap-2">
          <div>
            <label
              htmlFor="split-seed-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Semilla
            </label>
            <input
              id="split-seed-input"
              type="number"
              value={seed}
              onChange={(e) => onChangeSeedAndSplit(Number(e.target.value) || 123)}
              className="mt-1 w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => onChangeSeedAndSplit(seed + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Shuffle className="h-3.5 w-3.5" />
            <span>Probar otra semilla</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeSeedAndSplit(123)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>123</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de conteo 70/30 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Base completa</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatInt(nTotal)}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">100,0% de casos válidos</div>
        </div>
        <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
          <div className="text-xs font-semibold text-teal-800">Entrenamiento (Train · 70%)</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-teal-950">
            {formatInt(nTrain)}
          </div>
          <div className="mt-0.5 font-mono text-xs tabular-nums text-teal-800">
            {formatDec(nTotal > 0 ? (nTrain / nTotal) * 100 : 0, 1)}% · El árbol aprende aquí
          </div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <div className="text-xs font-semibold text-blue-800">Prueba (Test · 30%)</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-blue-950">
            {formatInt(nTest)}
          </div>
          <div className="mt-0.5 font-mono text-xs tabular-nums text-blue-800">
            {formatDec(nTotal > 0 ? (nTest / nTotal) * 100 : 0, 1)}% · Examen final del modelo
          </div>
        </div>
      </div>

      {/* Tabla comparativa de proporciones estratificadas */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">
            Verificación de estratificación por clase en {targetCol}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right text-sm tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="px-4 py-2.5 text-left">Clase</th>
                <th className="px-4 py-2.5">Total (n)</th>
                <th className="px-4 py-2.5">Total (%)</th>
                <th className="px-4 py-2.5">Entrenamiento (n)</th>
                <th className="px-4 py-2.5">Entrenamiento (%)</th>
                <th className="px-4 py-2.5">Prueba (n)</th>
                <th className="px-4 py-2.5">Prueba (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {splitConfig.classSummary.map((row) => (
                <tr key={row.cls} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-left font-sans text-sm font-semibold text-slate-900">
                    {row.cls}
                  </td>
                  <td className="px-4 py-3">{formatInt(row.totalCount)}</td>
                  <td className="px-4 py-3">{formatDec(row.totalPct, 1)}%</td>
                  <td className="px-4 py-3 font-semibold text-teal-800">{formatInt(row.trainCount)}</td>
                  <td className="px-4 py-3 text-teal-800">{formatDec(row.trainPct, 1)}%</td>
                  <td className="px-4 py-3 font-semibold text-blue-800">{formatInt(row.testCount)}</td>
                  <td className="px-4 py-3 text-blue-800">{formatDec(row.testPct, 1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
