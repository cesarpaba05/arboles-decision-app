import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BookmarkPlus, Check, RotateCcw, Scissors, Sliders } from 'lucide-react';
import { CartModel, RpartControl, SavedTreeVersion } from '../../types';
import { formatCp, formatDec, formatInt, formatPct } from '../../utils/formatters';
import { TreeDiagram } from '../TreeDiagram';

interface Step10Props {
  baseModel: CartModel | null;
  optimalModel: CartModel | null;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export const Step10OptimizedTree: React.FC<Step10Props> = ({
  baseModel,
  optimalModel,
  svgRef,
}) => {
  if (!baseModel || !optimalModel) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Necesitas una base válida y la partición 70/30 del Paso 9 para entrenar el árbol CART.
      </div>
    );
  }

  const minXerrRow =
    baseModel.cpTable.find(
      (r) => Math.abs(r.cp - baseModel.optimalCpMinXerror) < 1e-9
    ) || baseModel.cpTable[0];

  const oneSeThreshold = minXerrRow.xerror + minXerrRow.xstd;

  const plotCpData = baseModel.cpTable.map((r) => ({
    size: r.nsplit + 1,
    nsplit: r.nsplit,
    cpLabel: formatCp(r.cp),
    xerror: Number(r.xerror.toFixed(4)),
    relError: Number(r.relError.toFixed(4)),
    xstd: Number(r.xstd.toFixed(4)),
  }));

  return (
    <div className="space-y-6">
      {/* KPIs del árbol optimizado */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">CP óptimo (menor xerror)</div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-blue-700">
            {formatCp(optimalModel.appliedCp)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Hojas (segmentos)</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatInt(optimalModel.leafCount)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Profundidad máxima</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatInt(optimalModel.maxDepthReached)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Accuracy en entrenamiento</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-emerald-700">
            {formatPct(optimalModel.trainAccuracy)}
          </div>
        </div>
      </div>

      {/* Glosario visual rápido */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">
          Anatomía del árbol CART (índice Gini)
        </h2>
        <div className="mt-2 grid gap-3 text-xs leading-relaxed text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <strong className="text-slate-900">Raíz (#1):</strong> Nodo superior con el 100% del entrenamiento; hace la primera pregunta más informativa.
          </div>
          <div>
            <strong className="text-slate-900">Nodos internos:</strong> Preguntas binarias que dividen grupos buscando reducir la mezcla de clases.
          </div>
          <div>
            <strong className="text-slate-900">Hojas (cajas de color):</strong> Nodos finales sin más divisiones; asignan la clase predicha y forman segmentos.
          </div>
          <div>
            <strong className="text-slate-900">Índice Gini (0 = puro):</strong> Mide impureza del nodo; 0 significa 100% de una sola clase, valores cercanos a 0,66 indican mezcla pareja.
          </div>
        </div>
      </div>

      {/* Diagrama visual del árbol óptimo */}
      <div className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">
          Diagrama visual del árbol optimizado (estilo rpart.plot)
        </h2>
        <TreeDiagram root={optimalModel.root} classes={optimalModel.classes} svgRef={svgRef} />
      </div>

      {/* Tabla CP y Gráfico plotcp */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">
              Tabla de complejidad (printcp) · 10 pliegues
            </h3>
            <p className="text-xs text-slate-500">
              Se parte de un árbol grande (cp = 0,001) y se elige el CP con menor xerror.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 font-sans font-semibold text-slate-700">
                  <th className="px-3 py-2 text-left">CP</th>
                  <th className="px-3 py-2">nsplit</th>
                  <th className="px-3 py-2">rel error</th>
                  <th className="px-3 py-2">xerror</th>
                  <th className="px-3 py-2">xstd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {baseModel.cpTable.map((row, idx) => {
                  const isMin = Math.abs(row.cp - baseModel.optimalCpMinXerror) < 1e-9;
                  const isOneSe = Math.abs(row.cp - baseModel.optimalCpOneSe) < 1e-9;
                  return (
                    <tr
                      key={idx}
                      className={
                        isMin
                          ? 'bg-blue-50 font-semibold text-blue-950'
                          : isOneSe
                            ? 'bg-emerald-50/60 text-emerald-950'
                            : 'hover:bg-slate-50'
                      }
                    >
                      <td className="px-3 py-2 text-left">
                        {formatCp(row.cp)}
                        {isMin && (
                          <span className="ml-1.5 font-sans text-[11px] font-bold text-blue-700">
                            · Mín. xerror
                          </span>
                        )}
                        {!isMin && isOneSe && (
                          <span className="ml-1.5 font-sans text-[11px] font-semibold text-emerald-700">
                            · Regla 1-SE
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{formatInt(row.nsplit)}</td>
                      <td className="px-3 py-2">{formatDec(row.relError, 4)}</td>
                      <td className="px-3 py-2">{formatDec(row.xerror, 4)}</td>
                      <td className="px-3 py-2">{formatDec(row.xstd, 4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">
            Error de validación cruzada vs. tamaño del árbol (plotcp)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Línea punteada roja = umbral 1 error estándar ({formatDec(oneSeThreshold, 3)}).
          </p>
          <div className="mt-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={plotCpData} margin={{ top: 16, right: 16, left: -12, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="size"
                  label={{
                    value: 'Tamaño del árbol (número de hojas)',
                    position: 'insideBottom',
                    offset: -8,
                    style: { fontSize: 11, fill: '#475569' },
                  }}
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <Tooltip
                  formatter={(val: unknown, name: unknown) => [
                    formatDec(Number(val), 4),
                    name === 'xerror' ? 'Error CV (xerror)' : 'Error entrenamiento (rel error)',
                  ]}
                  labelFormatter={(label) => `Hojas: ${label}`}
                />
                <ReferenceLine
                  y={oneSeThreshold}
                  stroke="#DC2626"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="xerror"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2563EB' }}
                >
                  <ErrorBar dataKey="xstd" width={4} strokeWidth={1.3} stroke="#64748B" />
                </Line>
                <Line
                  type="monotone"
                  dataKey="relError"
                  stroke="#94A3B8"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={{ r: 2.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Reglas en texto e Importancia de variables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">
            Reglas de decisión en lenguaje sencillo (rpart.rules)
          </h3>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-800">
            {optimalModel.rules.map((rule) => (
              <li
                key={rule.nodeId}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span className="mr-2 font-mono font-semibold text-slate-500">
                  Hoja #{rule.nodeId}:
                </span>
                <span>{rule.ruleText}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">
            Importancia relativa de las variables (%)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Mide cuánto aporta cada variable a reducir la impureza Gini en el árbol.
          </p>
          <div className="mt-3 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={optimalModel.importance}
                layout="vertical"
                margin={{ top: 4, right: 32, left: 16, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="variable"
                  width={110}
                  tick={{ fontSize: 11, fill: '#0F172A' }}
                />
                <Tooltip
                  formatter={(val: unknown) => [`${formatDec(Number(val), 1)}%`, 'Importancia']}
                />
                <Bar dataKey="pctImportance" fill="#0F766E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export type PruningMode = 'min_xerror' | 'one_se' | 'manual_cp' | 'sliders';

interface Step11Props {
  baseModel: CartModel | null;
  currentModel: CartModel | null;
  pruningMode: PruningMode;
  setPruningMode: (m: PruningMode) => void;
  manualCp: number;
  setManualCp: (cp: number) => void;
  sliderControl: RpartControl;
  setSliderControl: (c: RpartControl) => void;
  savedVersions: SavedTreeVersion[];
  onSaveVersion: (name: string, strategyLabel: string) => void;
  onDeleteVersion: (id: string) => void;
}

export const Step11PruneAndCompare: React.FC<Step11Props> = ({
  baseModel,
  currentModel,
  pruningMode,
  setPruningMode,
  manualCp,
  setManualCp,
  sliderControl,
  setSliderControl,
  savedVersions,
  onSaveVersion,
  onDeleteVersion,
}) => {
  const [customVersionName, setCustomVersionName] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  if (!baseModel || !currentModel) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Entrena primero el árbol en el Paso 10 para poder podarlo y guardar versiones.
      </div>
    );
  }

  const handleSave = (suggestedName?: string, suggestedStrategy?: string) => {
    const name =
      suggestedName ||
      customVersionName.trim() ||
      `Versión (${currentModel.leafCount} hojas · cp ${formatCp(currentModel.appliedCp)})`;
    const strategy =
      suggestedStrategy ||
      (pruningMode === 'min_xerror'
        ? 'Menor xerror'
        : pruningMode === 'one_se'
          ? 'Regla 1-SE'
          : pruningMode === 'manual_cp'
            ? `CP manual (${formatCp(manualCp)})`
            : `Sliders (prof=${sliderControl.maxdepth}, minsplit=${sliderControl.minsplit})`);
    onSaveVersion(name, strategy);
    setCustomVersionName('');
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Explicación del sobreajuste */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950">
        <strong>Cuidado con el sobreajuste (overfitting):</strong> Un árbol muy grande con decenas de hojas puede acertar mucho en los datos de entrenamiento porque memoriza casos particulares, pero suele equivocarse más al predecir consumidores nuevos. Podar busca el equilibrio justo entre simplicidad (fácil de accionar en marketing) y precisión fuera de muestra.
      </div>

      {/* Selector de 4 modos de poda */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900">
          Elige cómo podar o ajustar el árbol (actualización en tiempo real)
        </h2>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setPruningMode('min_xerror')}
            className={`rounded-xl border p-3 text-left transition-colors ${
              pruningMode === 'min_xerror'
                ? 'border-blue-600 bg-blue-50 text-blue-950'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="text-xs font-bold">(a) Menor xerror</div>
            <div className="mt-0.5 font-mono text-xs text-slate-600">
              cp = {formatCp(baseModel.optimalCpMinXerror)}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPruningMode('one_se')}
            className={`rounded-xl border p-3 text-left transition-colors ${
              pruningMode === 'one_se'
                ? 'border-blue-600 bg-blue-50 text-blue-950'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="text-xs font-bold">(b) Regla 1 error estándar</div>
            <div className="mt-0.5 font-mono text-xs text-slate-600">
              cp = {formatCp(baseModel.optimalCpOneSe)}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPruningMode('manual_cp')}
            className={`rounded-xl border p-3 text-left transition-colors ${
              pruningMode === 'manual_cp'
                ? 'border-blue-600 bg-blue-50 text-blue-950'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="text-xs font-bold">(c) Elegir CP de la tabla</div>
            <div className="mt-0.5 font-mono text-xs text-slate-600">
              cp = {formatCp(manualCp)}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPruningMode('sliders')}
            className={`rounded-xl border p-3 text-left transition-colors ${
              pruningMode === 'sliders'
                ? 'border-blue-600 bg-blue-50 text-blue-950'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <Sliders className="h-3.5 w-3.5" />
              <span>(d) Controles deslizantes</span>
            </div>
            <div className="mt-0.5 font-mono text-xs text-slate-600">
              prof={sliderControl.maxdepth} · minsplit={sliderControl.minsplit}
            </div>
          </button>
        </div>

        {/* Subpanel para (c) CP manual */}
        {pruningMode === 'manual_cp' && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-2 text-xs font-semibold text-slate-700">
              Haz clic en una fila de la tabla de complejidad para aplicar su CP:
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right font-mono text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-sans font-semibold text-slate-600">
                    <th className="px-3 py-2 text-left">CP</th>
                    <th className="px-3 py-2">nsplit</th>
                    <th className="px-3 py-2">Hojas</th>
                    <th className="px-3 py-2">rel error</th>
                    <th className="px-3 py-2">xerror</th>
                    <th className="px-3 py-2">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {baseModel.cpTable.map((row, idx) => {
                    const selected = Math.abs(manualCp - row.cp) < 1e-8;
                    return (
                      <tr
                        key={idx}
                        onClick={() => setManualCp(row.cp)}
                        className={`cursor-pointer ${
                          selected ? 'bg-blue-50 font-bold text-blue-900' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-2 text-left">{formatCp(row.cp)}</td>
                        <td className="px-3 py-2">{formatInt(row.nsplit)}</td>
                        <td className="px-3 py-2">{formatInt(row.nsplit + 1)}</td>
                        <td className="px-3 py-2">{formatDec(row.relError, 4)}</td>
                        <td className="px-3 py-2">{formatDec(row.xerror, 4)}</td>
                        <td className="px-3 py-2 font-sans">
                          <span className={selected ? 'text-blue-700' : 'text-slate-500'}>
                            {selected ? 'Seleccionado' : 'Aplicar'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Subpanel para (d) Sliders en tiempo real */}
        {pruningMode === 'sliders' && (
          <div className="mt-4 grid gap-5 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <label htmlFor="sl-maxdepth">maxdepth</label>
                <span className="font-mono tabular-nums">{sliderControl.maxdepth}</span>
              </div>
              <input
                id="sl-maxdepth"
                type="range"
                min={1}
                max={8}
                step={1}
                value={sliderControl.maxdepth}
                onChange={(e) =>
                  setSliderControl({ ...sliderControl, maxdepth: Number(e.target.value) })
                }
                className="mt-1.5 w-full accent-blue-600"
              />
              <p className="mt-0.5 text-[11px] text-slate-500">Profundidad máxima del árbol</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <label htmlFor="sl-minsplit">minsplit</label>
                <span className="font-mono tabular-nums">{sliderControl.minsplit}</span>
              </div>
              <input
                id="sl-minsplit"
                type="range"
                min={4}
                max={120}
                step={2}
                value={sliderControl.minsplit}
                onChange={(e) => {
                  const ms = Number(e.target.value);
                  setSliderControl({
                    ...sliderControl,
                    minsplit: ms,
                    minbucket: Math.min(sliderControl.minbucket, Math.max(2, Math.floor(ms / 2))),
                  });
                }}
                className="mt-1.5 w-full accent-blue-600"
              />
              <p className="mt-0.5 text-[11px] text-slate-500">Mínimo de casos para dividir</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <label htmlFor="sl-minbucket">minbucket</label>
                <span className="font-mono tabular-nums">{sliderControl.minbucket}</span>
              </div>
              <input
                id="sl-minbucket"
                type="range"
                min={2}
                max={60}
                step={1}
                value={sliderControl.minbucket}
                onChange={(e) =>
                  setSliderControl({ ...sliderControl, minbucket: Number(e.target.value) })
                }
                className="mt-1.5 w-full accent-blue-600"
              />
              <p className="mt-0.5 text-[11px] text-slate-500">Mínimo de casos por hoja</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <label htmlFor="sl-cp">cp</label>
                <span className="font-mono tabular-nums">{formatCp(sliderControl.cp)}</span>
              </div>
              <input
                id="sl-cp"
                type="range"
                min={0.001}
                max={0.08}
                step={0.001}
                value={sliderControl.cp}
                onChange={(e) =>
                  setSliderControl({ ...sliderControl, cp: Number(e.target.value) })
                }
                className="mt-1.5 w-full accent-blue-600"
              />
              <p className="mt-0.5 text-[11px] text-slate-500">Exigencia mínima de mejora</p>
            </div>
          </div>
        )}
      </div>

      {/* Resumen en vivo y guardar versión */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <div className="text-slate-500">Hojas actuales</div>
            <div className="font-display text-xl font-bold tabular-nums text-slate-900">
              {formatInt(currentModel.leafCount)}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Profundidad</div>
            <div className="font-display text-xl font-bold tabular-nums text-slate-900">
              {formatInt(currentModel.maxDepthReached)}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Acc. entrenamiento</div>
            <div className="font-display text-xl font-bold tabular-nums text-emerald-700">
              {formatPct(currentModel.trainAccuracy)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={customVersionName}
            onChange={(e) => setCustomVersionName(e.target.value)}
            placeholder="Nombre de versión (ej. Podado 1-SE)"
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => handleSave()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            {justSaved ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
            <span>{justSaved ? 'Guardado' : 'Guardar versión'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPruningMode('sliders');
              setSliderControl({ cp: 0.001, minsplit: 20, minbucket: 7, maxdepth: 2, xval: 10 });
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Scissors className="h-3.5 w-3.5" />
            <span>Probar profundidad 2</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPruningMode('sliders');
              setSliderControl({ cp: 0.001, minsplit: 10, minbucket: 4, maxdepth: 6, xval: 10 });
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Probar árbol grande</span>
          </button>
        </div>
      </div>

      {/* Lista de versiones guardadas */}
      {savedVersions.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-bold text-slate-800">
            Versiones guardadas para comparar en el Paso 12 ({savedVersions.length})
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {savedVersions.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
              >
                <span className="font-semibold text-slate-900">{v.name}</span>
                <span className="font-mono text-slate-500">
                  {v.model.leafCount} hojas · Acc. prueba {formatPct(v.evaluation.accuracy)}
                </span>
                {savedVersions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteVersion(v.id)}
                    className="ml-1 text-slate-400 hover:text-rose-600"
                    title="Eliminar versión"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagrama actualizado en tiempo real */}
      <TreeDiagram root={currentModel.root} classes={currentModel.classes} />
    </div>
  );
};
