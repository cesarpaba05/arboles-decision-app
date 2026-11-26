import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Info } from 'lucide-react';
import {
  CategoricalStats,
  ColumnMeta,
  DataRow,
  NumericStats,
  VariableType,
} from '../../types';
import { computeCategoricalStats, computeNumericStats } from '../../engine/statistics';
import { formatDec, formatInt } from '../../utils/formatters';
import { BoxplotChart } from '../BoxplotChart';

const VARIABLE_BAR_COLORS = [
  '#0F766E',
  '#2563EB',
  '#D97706',
  '#7C3AED',
  '#059669',
  '#DC2626',
  '#0284C7',
  '#9333EA',
];

interface Step5Props {
  columns: ColumnMeta[];
  onToggleType: (colName: string, newType: VariableType) => void;
}

export const Step05VariableTypes: React.FC<Step5Props> = ({ columns, onToggleType }) => {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div>
            <strong className="text-slate-900">¿Por qué un número como 1, 2 o 3 puede ser una categoría?</strong>
            <p className="mt-1 leading-relaxed text-slate-600">
              Las variables de texto se convierten automáticamente a <strong>factor (categórica)</strong> como hace <code className="font-mono text-xs">as.factor()</code> en R. Sin embargo, muchas encuestas codifican categorías con números (por ejemplo: 1 = Estrato bajo, 2 = Medio, 3 = Alto, o códigos de ciudad). Si el árbol los trata como número, buscará promedios o cortes como "mayor a 1,5", perdiendo grupos exactos. Si detectamos pocos números enteros repetidos, te avisaremos para que evalúes cambiarlos a <strong>Categórica (factor)</strong>.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                <th className="px-4 py-3">Variable</th>
                <th className="px-4 py-3">Valores únicos</th>
                <th className="px-4 py-3">Faltantes</th>
                <th className="px-4 py-3">Muestras</th>
                <th className="px-4 py-3">Tipo asignado (cambiar manualmente)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {columns.map((col) => (
                <tr key={col.name} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <div>{col.name}</div>
                    {col.isIntegerCoded && col.type === 'numeric' && (
                      <div className="mt-0.5 text-xs font-normal text-amber-700">
                        Posible código numérico de categoría ({col.uniqueCount} valores enteros)
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700">
                    {formatInt(col.uniqueCount)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700">
                    {formatInt(col.missingCount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {col.sampleValues.slice(0, 4).join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => onToggleType(col.name, 'factor')}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                          col.type === 'factor'
                            ? 'bg-white text-teal-800 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Categórica (factor)
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleType(col.name, 'numeric')}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                          col.type === 'numeric'
                            ? 'bg-white text-blue-800 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Numérica
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface Step6Props {
  rows: DataRow[];
  columns: ColumnMeta[];
  onGoToStep3: () => void;
}

export const Step06NumericAnalysis: React.FC<Step6Props> = ({
  rows,
  columns,
  onGoToStep3,
}) => {
  const numCols = columns.filter((c) => c.type === 'numeric');

  if (numCols.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-base font-bold text-slate-900">
          No hay variables numéricas en esta base de datos
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Todas las variables actuales son categóricas (factores), como ocurre en el taller de desayuno de cereales (edad por rangos, género, estado civil, actividad laboral y tipo de desayuno). Por lo tanto, el análisis de medias, histogramas y boxplots no aplica aquí y pasamos directo a los gráficos categóricos en el siguiente paso.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={onGoToStep3}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ¿Quieres ver numéricas? Simula un sector en Paso 3
          </button>
        </div>
      </div>
    );
  }

  const statsList = numCols
    .map((c) => computeNumericStats(rows, c.name))
    .filter((s): s is NumericStats => s !== null);

  return (
    <div className="space-y-6">
      {/* Tabla resumen */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">
            Resumen estadístico descriptivo
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 font-semibold text-slate-700">
                <th className="px-3 py-2.5 text-left">Variable</th>
                <th className="px-3 py-2.5">n</th>
                <th className="px-3 py-2.5">Media</th>
                <th className="px-3 py-2.5">Mediana</th>
                <th className="px-3 py-2.5">Desv. Est.</th>
                <th className="px-3 py-2.5">Mín</th>
                <th className="px-3 py-2.5">Q1 (25%)</th>
                <th className="px-3 py-2.5">Q3 (75%)</th>
                <th className="px-3 py-2.5">Máx</th>
                <th className="px-3 py-2.5">CV (%)</th>
                <th className="px-3 py-2.5">Asimetría</th>
                <th className="px-3 py-2.5">Curtosis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {statsList.map((st) => (
                <tr key={st.column} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-left font-sans font-semibold text-slate-900">
                    {st.column}
                  </td>
                  <td className="px-3 py-2.5">{formatInt(st.n)}</td>
                  <td className="px-3 py-2.5">{formatDec(st.mean, 2)}</td>
                  <td className="px-3 py-2.5">{formatDec(st.median, 2)}</td>
                  <td className="px-3 py-2.5">{formatDec(st.sd, 2)}</td>
                  <td className="px-3 py-2.5">{formatDec(st.min, 2)}</td>
                  <td className="px-3 py-2.5">{formatDec(st.q1, 2)}</td>
                  <td className="px-3 py-2.5">{formatDec(st.q3, 2)}</td>
                  <td className="px-3 py-2.5">{formatDec(st.max, 2)}</td>
                  <td className="px-3 py-2.5">{formatDec(st.cv, 1)}%</td>
                  <td className="px-3 py-2.5">{formatDec(st.skewness, 2)}</td>
                  <td className="px-3 py-2.5">{formatDec(st.kurtosis, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histograma y Boxplot por variable */}
      <div className="grid gap-5 lg:grid-cols-2">
        {statsList.map((st) => (
          <div
            key={st.column}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900">{st.column}</h3>
              <span className="font-mono text-xs tabular-nums text-slate-500">
                CV: {formatDec(st.cv, 1)}% · Atípicos: {formatInt(st.outliers.length)}
              </span>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={st.histogram} margin={{ top: 8, right: 8, left: -16, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#475569' }}
                    angle={-18}
                    textAnchor="end"
                    height={36}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip
                    formatter={(value: unknown) => [formatInt(Number(value)), 'Frecuencia']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="mb-1 text-xs font-semibold text-slate-600">
                Diagrama de caja (Boxplot) — Rombo naranja = Media · Línea azul = Mediana
              </div>
              <BoxplotChart stats={st} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface Step7Props {
  rows: DataRow[];
  columns: ColumnMeta[];
  targetCol: string;
}

export const Step07CategoricalCharts: React.FC<Step7Props> = ({
  rows,
  columns,
  targetCol,
}) => {
  const factorCols = columns.filter((c) => c.type === 'factor');
  const targetMeta = columns.find((c) => c.name === targetCol);
  const targetLevels =
    targetMeta?.levels ||
    Array.from(
      new Set(
        rows
          .map((r) => r[targetCol])
          .filter((v) => v !== null && v !== undefined && v !== '')
          .map(String)
      )
    ).sort((a, b) => a.localeCompare(b, 'es'));

  if (factorCols.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        No hay variables marcadas como categóricas (factor). Revisa el Paso 5 si deseas convertir alguna variable.
      </div>
    );
  }

  const statsList: CategoricalStats[] = factorCols.map((col) =>
    computeCategoricalStats(rows, col, targetCol)
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {statsList.map((st, idx) => {
          const barColor = VARIABLE_BAR_COLORS[idx % VARIABLE_BAR_COLORS.length];
          const chartData = st.levels.map((lvl) => ({
            level: lvl.level,
            count: lvl.count,
            label: `${formatInt(lvl.count)} (${formatDec(lvl.pct, 1)}%)`,
          }));
          const isTarget = st.column === targetCol;

          return (
            <div
              key={st.column}
              className="flex flex-col justify-between space-y-4 rounded-xl border border-slate-200 bg-white p-5"
            >
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    {st.column}
                    {isTarget && (
                      <span className="ml-2 text-xs font-semibold text-teal-700">
                        · Variable objetivo sugerida
                      </span>
                    )}
                  </h2>
                  <span className="font-mono text-xs tabular-nums text-slate-500">
                    {formatInt(st.levels.length)} categorías · n = {formatInt(st.n)}
                  </span>
                </div>

                <div className="mt-3 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 24, right: 12, left: -16, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis
                        dataKey="level"
                        tick={{ fontSize: 11, fill: '#334155' }}
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                      <Tooltip
                        formatter={(val: unknown) => [formatInt(Number(val)), 'Consumidores']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="count" fill={barColor} radius={[5, 5, 0, 0]}>
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

              {/* Tabla cruzada con % por fila contra variable objetivo */}
              {!isTarget && st.crossTab && targetLevels.length >= 2 && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      Cruce contra {targetCol} (% por fila)
                    </span>
                    {st.cramersV !== undefined && (
                      <span className="font-mono tabular-nums text-slate-500">
                        V de Cramér: {formatDec(st.cramersV, 3)}
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <th className="px-2.5 py-1.5 text-left font-semibold">{st.column}</th>
                          {targetLevels.map((t) => (
                            <th key={t} className="px-2.5 py-1.5 text-right font-semibold">
                              {t}
                            </th>
                          ))}
                          <th className="px-2.5 py-1.5 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {st.crossTab.map((row) => (
                          <tr key={row.predictorLevel}>
                            <td className="px-2.5 py-1.5 font-medium text-slate-800">
                              {row.predictorLevel}
                            </td>
                            {targetLevels.map((t) => (
                              <td key={t} className="px-2.5 py-1.5 text-right font-mono text-slate-700">
                                {formatDec(row.rowPcts[t] || 0, 1)}%{' '}
                                <span className="text-slate-400">({formatInt(row.counts[t] || 0)})</span>
                              </td>
                            ))}
                            <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-slate-900">
                              {formatInt(row.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
