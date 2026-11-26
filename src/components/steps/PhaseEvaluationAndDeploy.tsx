import React from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Megaphone,
  Target,
} from 'lucide-react';
import {
  CartModel,
  DatasetState,
  EvaluationResult,
  MarketingSegment,
  SavedTreeVersion,
} from '../../types';
import { BusinessConclusion } from '../../engine/marketingRules';
import {
  formatCp,
  formatDec,
  formatInt,
  formatPct,
  getClassColor,
} from '../../utils/formatters';

interface Step12Props {
  evaluation: EvaluationResult | null;
  model: CartModel | null;
  savedVersions: SavedTreeVersion[];
  activeVersionId: string | null;
  onSelectVersion: (id: string) => void;
}

export const Step12Evaluation: React.FC<Step12Props> = ({
  evaluation,
  model,
  savedVersions,
  activeVersionId,
  onSelectVersion,
}) => {
  if (!evaluation || !model) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Necesitas un modelo entrenado del Paso 10/11 para evaluar en los datos de prueba.
      </div>
    );
  }

  const baseError = 1 - evaluation.noInfoRate;
  const trainTestGap = (evaluation.trainAccuracy - evaluation.accuracy) * 100;
  const liftOverNir = (evaluation.accuracy - evaluation.noInfoRate) * 100;

  // Mejor versión guardada por F1 Macro (y Accuracy como desempate, menor hojas como parsimonia)
  const bestVersion =
    savedVersions.length > 0
      ? [...savedVersions].sort((a, b) => {
          const scoreA = a.evaluation.macroF1 * 0.6 + a.evaluation.accuracy * 0.4;
          const scoreB = b.evaluation.macroF1 * 0.6 + b.evaluation.accuracy * 0.4;
          if (Math.abs(scoreB - scoreA) > 0.005) return scoreB - scoreA;
          return a.model.leafCount - b.model.leafCount;
        })[0]
      : null;

  return (
    <div className="space-y-6">
      {/* KPIs principales en prueba */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Accuracy en prueba</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-emerald-700">
            {formatPct(evaluation.accuracy)}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Error: {formatPct(evaluation.errorRate)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Error base (NIR)</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatPct(baseError)}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            NIR: {formatPct(evaluation.noInfoRate)} ({liftOverNir >= 0 ? '+' : ''}
            {formatDec(liftOverNir, 1)} pp)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Kappa de Cohen</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatDec(evaluation.kappa, 3)}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">Acuerdo sobre azar</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">F1 promedio (Macro)</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-blue-700">
            {formatPct(evaluation.macroF1)}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">Balance entre clases</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Acc. entrenamiento</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatPct(evaluation.trainAccuracy)}
          </div>
          <div
            className={`mt-0.5 text-xs font-medium ${
              trainTestGap > 8 ? 'text-amber-700' : 'text-slate-500'
            }`}
          >
            Brecha: {formatDec(trainTestGap, 1)} pp
          </div>
        </div>
      </div>

      {/* Alerta cuando accuracy es aceptable pero F1 de alguna clase es bajo */}
      {evaluation.lowF1Classes.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <div className="font-bold">
              Atención: Exactitud global aceptable, pero F1 bajo en alguna clase
            </div>
            <p className="mt-1 text-xs leading-relaxed text-amber-900">
              Aunque la accuracy general es {formatPct(evaluation.accuracy)},{' '}
              {evaluation.lowF1Classes
                .map((c) => `"${c.cls}" tiene un F1 de ${formatPct(c.f1)}`)
                .join(' y ')}
              . Esto ocurre cuando el árbol acierta bien las categorías más grandes pero confunde o deja con poca cobertura a una categoría específica. Conviene revisar una versión menos podada o equilibrar las campañas de ese grupo.
            </p>
          </div>
        </div>
      )}

      {/* Matriz de Confusión + Nota caret */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">
              Matriz de confusión en prueba (Filas = Valor real · Columnas = Predicción)
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              La diagonal verde muestra los aciertos. Nota: en R, <code className="font-mono">caret::confusionMatrix()</code> imprime las predicciones en las filas y el valor real en las columnas (transpuesta frente a esta tabla).
            </p>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full border-collapse text-center text-xs tabular-nums">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">
                    Real \ Predicción
                  </th>
                  {evaluation.classes.map((cls) => (
                    <th
                      key={cls}
                      className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-800"
                    >
                      {cls}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                {evaluation.classes.map((cls, i) => (
                  <tr key={cls}>
                    <th className="border border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-sans font-semibold text-slate-900">
                      {cls}
                    </th>
                    {evaluation.matrix[i].map((val, j) => {
                      const isDiag = i === j;
                      return (
                        <td
                          key={j}
                          className={`border border-slate-200 px-3 py-2.5 text-sm ${
                            isDiag
                              ? 'bg-emerald-100 font-bold text-emerald-950'
                              : val > 0
                                ? 'bg-rose-50 text-rose-900'
                                : 'bg-white text-slate-400'
                          }`}
                        >
                          {formatInt(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Métricas por clase */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">
              Desempeño por categoría (Precisión, Recall, Especificidad y F1)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 font-semibold text-slate-600">
                  <th className="px-3 py-2.5 text-left">Clase</th>
                  <th className="px-3 py-2.5">Casos</th>
                  <th className="px-3 py-2.5">Precisión</th>
                  <th className="px-3 py-2.5">Recall</th>
                  <th className="px-3 py-2.5">Especif.</th>
                  <th className="px-3 py-2.5">F1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {evaluation.perClass.map((c, idx) => (
                  <tr key={c.cls} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-left font-sans font-semibold text-slate-900">
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: getClassColor(idx).bg }}
                      />
                      {c.cls}
                    </td>
                    <td className="px-3 py-2.5">{formatInt(c.support)}</td>
                    <td className="px-3 py-2.5">{formatPct(c.precision)}</td>
                    <td className="px-3 py-2.5">{formatPct(c.recall)}</td>
                    <td className="px-3 py-2.5">{formatPct(c.specificity)}</td>
                    <td
                      className={`px-3 py-2.5 font-bold ${
                        c.f1 < 0.55 ? 'text-amber-700' : 'text-slate-900'
                      }`}
                    >
                      {formatPct(c.f1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tabla comparativa de versiones guardadas */}
      {savedVersions.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Comparativa de versiones guardadas del árbol
              </h2>
              <p className="text-xs text-slate-500">
                Selecciona la versión que quieres llevar a los segmentos y estrategias de marketing (Paso 13).
              </p>
            </div>
            {bestVersion && (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <Award className="h-4 w-4 text-emerald-600" />
                <span>Recomendada: {bestVersion.name}</span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 font-semibold text-slate-600">
                  <th className="px-3 py-2.5 text-left">Versión</th>
                  <th className="px-3 py-2.5">Hojas</th>
                  <th className="px-3 py-2.5">CP</th>
                  <th className="px-3 py-2.5">Acc. Train</th>
                  <th className="px-3 py-2.5">Acc. Prueba</th>
                  <th className="px-3 py-2.5">F1 Macro</th>
                  {evaluation.classes.map((cls) => (
                    <th key={cls} className="px-3 py-2.5">
                      F1 {cls}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center">Usar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {savedVersions.map((v) => {
                  const isBest = bestVersion?.id === v.id;
                  const isActive = activeVersionId === v.id;
                  return (
                    <tr
                      key={v.id}
                      className={isActive ? 'bg-blue-50/70' : 'hover:bg-slate-50'}
                    >
                      <td className="px-3 py-2.5 text-left font-sans">
                        <div className="font-semibold text-slate-900">
                          {v.name}
                          {isBest && (
                            <span className="ml-1.5 text-[11px] font-bold text-emerald-700">
                              · Mejor equilibrio
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">{v.strategyLabel}</div>
                      </td>
                      <td className="px-3 py-2.5">{formatInt(v.model.leafCount)}</td>
                      <td className="px-3 py-2.5">{formatCp(v.model.appliedCp)}</td>
                      <td className="px-3 py-2.5">{formatPct(v.evaluation.trainAccuracy)}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900">
                        {formatPct(v.evaluation.accuracy)}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-blue-700">
                        {formatPct(v.evaluation.macroF1)}
                      </td>
                      {evaluation.classes.map((cls) => {
                        const cm = v.evaluation.perClass.find((p) => p.cls === cls);
                        return (
                          <td key={cls} className="px-3 py-2.5">
                            {cm ? formatPct(cm.f1) : '—'}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center font-sans">
                        <button
                          type="button"
                          onClick={() => onSelectVersion(v.id)}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                            isActive
                              ? 'bg-blue-700 text-white'
                              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {isActive && <CheckCircle2 className="h-3 w-3" />}
                          <span>{isActive ? 'Activa' : 'Elegir'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

interface Step13Props {
  segments: MarketingSegment[];
  conclusion: BusinessConclusion | null;
  model: CartModel | null;
}

export const Step13BusinessApplication: React.FC<Step13Props> = ({
  segments,
  conclusion,
  model,
}) => {
  if (!model || !conclusion || segments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Completa el modelado del árbol para transformar cada hoja en un segmento de marketing.
      </div>
    );
  }

  const classIdxMap = new Map(model.classes.map((c, i) => [c, i]));

  return (
    <div className="space-y-6">
      {/* Conclusión general ejecutiva */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-800">
            <Target className="h-4 w-4" />
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              Conclusión general y orientación del presupuesto
            </h2>
            <p className="text-sm font-medium text-slate-800">{conclusion.headline}</p>
            <p className="text-sm leading-relaxed text-slate-600">
              {conclusion.variableInsights}
            </p>
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800">
              <strong>Recomendación de segmentación: </strong>
              {conclusion.campaignAdvice}
            </p>
            <div className="pt-1">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Próximos pasos recomendados
              </div>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {conclusion.nextSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas por segmento (una por cada hoja del árbol) */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          Segmentos accionables derivados de las hojas del árbol ({segments.length})
        </h2>

        {segments.map((seg) => {
          const cIdx = classIdxMap.get(seg.predictedClass) ?? 0;
          const color = getClassColor(cIdx);
          return (
            <div
              key={seg.leafId}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-700">
                      Hoja #{seg.leafId}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {formatInt(seg.n)} consumidores ({formatDec(seg.pctOfBase, 1)}% de la base)
                    </span>
                  </div>
                  <h3 className="mt-0.5 text-lg font-bold text-slate-900">
                    {seg.segmentName}
                  </h3>
                </div>

                <div
                  className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: color.light,
                    borderColor: color.border,
                    color: color.text,
                  }}
                >
                  Predicción: {seg.predictedClass} ({formatPct(seg.probability)})
                </div>
              </div>

              <div className="space-y-5 p-5">
                <div className="text-sm text-slate-700">
                  <strong>Condición que define este grupo: </strong>
                  {seg.description}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Estrategia 4P */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Estrategia de Marketing (4P)
                    </h4>
                    <dl className="space-y-2 text-sm">
                      <div>
                        <dt className="font-semibold text-slate-900">Producto</dt>
                        <dd className="text-slate-600">{seg.strategy.producto}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-900">Precio</dt>
                        <dd className="text-slate-600">{seg.strategy.precio}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-900">Plaza (distribución)</dt>
                        <dd className="text-slate-600">{seg.strategy.plaza}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-900">Promoción</dt>
                        <dd className="text-slate-600">{seg.strategy.promocion}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Comunicación, canales y aviso */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Comunicación y ejemplo de aviso
                    </h4>
                    <p className="text-sm text-slate-700">
                      <strong>Mensaje clave: </strong>
                      {seg.mensajeComunicacion}
                    </p>
                    <p className="text-xs text-slate-600">
                      <strong>Canales recomendados: </strong>
                      {seg.canalesRecomendados.join(' · ')}
                    </p>

                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <Megaphone className="h-3.5 w-3.5 text-blue-600" />
                        <span>Borrador de aviso publicitario</span>
                      </div>
                      <div className="mt-1.5 font-display text-base font-bold text-slate-900">
                        {seg.aviso.titular}
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{seg.aviso.texto}</p>
                      <div className="mt-3 inline-block rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                        {seg.aviso.cta}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface Step14Props {
  dataset: DatasetState | null;
  targetCol: string;
  evaluation: EvaluationResult | null;
  segments: MarketingSegment[];
  onDownloadHtml: () => void;
  onDownloadCsv: () => void;
  onDownloadRScript: () => void;
}

export const Step14Export: React.FC<Step14Props> = ({
  dataset,
  targetCol,
  evaluation,
  segments,
  onDownloadHtml,
  onDownloadCsv,
  onDownloadRScript,
}) => {
  if (!dataset || !evaluation) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Completa los pasos anteriores para habilitar la descarga del informe y las predicciones.
      </div>
    );
  }

  const segByLeaf = new Map(segments.map((s) => [s.leafId, s]));

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-3">
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-base font-bold text-slate-900">
              Informe ejecutivo HTML
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Archivo autónomo listo para abrir en cualquier navegador o imprimir a PDF. Incluye el diagrama vectorial del árbol, la tabla CP, la matriz de confusión, todos los segmentos con 4P y el código R equivalente.
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadHtml}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Descargar informe HTML</span>
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-base font-bold text-slate-900">
              CSV de predicciones en prueba
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Contiene los {formatInt(evaluation.predictions.length)} registros del conjunto de prueba (30%) con sus columnas originales, valor real, predicción, acierto, hoja del árbol, segmento comercial y probabilidad.
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadCsv}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Descargar CSV de prueba</span>
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
              <FileCode2 className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-base font-bold text-slate-900">
              Script completo en R (.R)
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Reúne en un solo script las instrucciones de los 14 pasos con tus nombres de archivo, semilla, variables y parámetro CP elegidos para reproducirlo en RStudio.
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadRScript}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Descargar script .R</span>
          </button>
        </div>
      </div>

      {/* Vista previa del CSV de prueba */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">
            Muestra del archivo de predicciones en prueba (primeros 8 registros)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 font-semibold text-slate-700">
                <th className="px-3 py-2">Fila</th>
                <th className="px-3 py-2">{targetCol} real</th>
                <th className="px-3 py-2">{targetCol} predicho</th>
                <th className="px-3 py-2">Acierto</th>
                <th className="px-3 py-2">Hoja</th>
                <th className="px-3 py-2">Segmento asignado</th>
                <th className="px-3 py-2 text-right">Prob.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {evaluation.predictions.slice(0, 8).map((p) => (
                <tr key={p.rowIndex} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-500">{p.rowIndex + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{p.actual}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{p.predicted}</td>
                  <td
                    className={`px-3 py-2 font-semibold ${
                      p.correct ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {p.correct ? 'Sí' : 'No'}
                  </td>
                  <td className="px-3 py-2 font-mono">#{p.leafId}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {segByLeaf.get(p.leafId)?.segmentName || `Hoja #${p.leafId}`}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatPct(p.probability)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
