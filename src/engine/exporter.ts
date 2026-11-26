import {
  CartModel,
  DatasetState,
  EvaluationResult,
  MarketingSegment,
  SavedTreeVersion,
} from '../types';
import { BusinessConclusion } from './marketingRules';
import { escapeHtml, formatCp, formatDec, formatInt, formatPct } from '../utils/formatters';

export function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTestPredictionsCsv(
  dataset: DatasetState,
  targetCol: string,
  evaluation: EvaluationResult,
  segments: MarketingSegment[]
) {
  const segByLeaf = new Map<number, MarketingSegment>(
    segments.map((s) => [s.leafId, s])
  );
  const headers = [
    ...dataset.columns.map((c) => c.name),
    `${targetCol}_real`,
    `${targetCol}_predicho`,
    'acierto',
    'nodo_hoja',
    'segmento_comercial',
    'probabilidad_predicha',
  ];

  const escapeCsvCell = (val: string | number | null | undefined): string => {
    const s = val === null || val === undefined ? '' : String(val);
    if (s.includes(',') || s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };

  const lines: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const pred of evaluation.predictions) {
    const row = dataset.rows[pred.rowIndex];
    const seg = segByLeaf.get(pred.leafId);
    const cells = [
      ...dataset.columns.map((c) => row[c.name]),
      pred.actual,
      pred.predicted,
      pred.correct ? 'Sí' : 'No',
      `#${pred.leafId}`,
      seg?.segmentName || `Segmento hoja #${pred.leafId}`,
      formatDec(pred.probability * 100, 1) + '%',
    ];
    lines.push(cells.map(escapeCsvCell).join(','));
  }

  // BOM UTF-8 para abrir tildes correctamente en Excel
  downloadBlob('\uFEFF' + lines.join('\n'), 'predicciones_prueba_cart.csv', 'text/csv;charset=utf-8;');
}

export function buildHtmlReport(params: {
  businessQuestion: string;
  sector: string;
  dataset: DatasetState;
  targetCol: string;
  model: CartModel;
  evaluation: EvaluationResult;
  versions: SavedTreeVersion[];
  segments: MarketingSegment[];
  conclusion: BusinessConclusion;
  treeSvgMarkup: string;
  fullRScript: string;
}): string {
  const {
    businessQuestion,
    sector,
    dataset,
    targetCol,
    model,
    evaluation,
    versions,
    segments,
    conclusion,
    treeSvgMarkup,
    fullRScript,
  } = params;

  const fecha = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const cpRowsHtml = model.cpTable
    .map((r) => {
      const isMin = Math.abs(r.cp - model.optimalCpMinXerror) < 1e-9;
      const isApplied = Math.abs(r.cp - model.appliedCp) < 1e-6;
      return `<tr class="${isApplied ? 'highlight' : ''}">
        <td>${formatCp(r.cp)}${isMin ? ' (mín. xerror)' : ''}${isApplied ? ' [Elegido]' : ''}</td>
        <td>${formatInt(r.nsplit)}</td>
        <td>${formatDec(r.relError, 4)}</td>
        <td>${formatDec(r.xerror, 4)}</td>
        <td>${formatDec(r.xstd, 4)}</td>
      </tr>`;
    })
    .join('');

  const matrixHeaderHtml = evaluation.classes
    .map((c) => `<th>Pred: ${escapeHtml(c)}</th>`)
    .join('');

  const matrixBodyHtml = evaluation.classes
    .map((cls, i) => {
      const cells = evaluation.matrix[i]
        .map((val, j) => {
          const style =
            i === j
              ? 'background:#dcfce7;color:#14532d;font-weight:700;'
              : val > 0
                ? 'background:#fef2f2;color:#991b1b;'
                : '';
          return `<td style="${style}">${formatInt(val)}</td>`;
        })
        .join('');
      return `<tr><th>Real: ${escapeHtml(cls)}</th>${cells}</tr>`;
    })
    .join('');

  const perClassHtml = evaluation.perClass
    .map(
      (c) => `<tr>
      <td><strong>${escapeHtml(c.cls)}</strong></td>
      <td>${formatInt(c.support)}</td>
      <td>${formatPct(c.precision)}</td>
      <td>${formatPct(c.recall)}</td>
      <td>${formatPct(c.specificity)}</td>
      <td><strong>${formatPct(c.f1)}</strong></td>
    </tr>`
    )
    .join('');

  const versionsHtml = versions
    .map(
      (v) => `<tr>
      <td><strong>${escapeHtml(v.name)}</strong><br><small>${escapeHtml(v.strategyLabel)}</small></td>
      <td>${formatInt(v.model.leafCount)}</td>
      <td>${formatCp(v.model.appliedCp)}</td>
      <td>${formatPct(v.evaluation.trainAccuracy)}</td>
      <td><strong>${formatPct(v.evaluation.accuracy)}</strong></td>
      <td>${formatPct(v.evaluation.macroF1)}</td>
    </tr>`
    )
    .join('');

  const segmentsHtml = segments
    .map(
      (seg) => `
    <div class="segment-card">
      <div class="segment-head">
        <div>
          <h3>${escapeHtml(seg.segmentName)}</h3>
          <p class="muted">Hoja #${seg.leafId} · Tamaño: ${formatInt(seg.n)} consumidores (${formatDec(seg.pctOfBase, 1)}% del entrenamiento) · Predicción: <strong>${escapeHtml(seg.predictedClass)}</strong> (${formatPct(seg.probability)})</p>
        </div>
      </div>
      <p><strong>Regla que define el segmento:</strong> ${escapeHtml(seg.description)}</p>
      <div class="grid-2">
        <div>
          <h4>Estrategia de Marketing (4P)</h4>
          <ul>
            <li><strong>Producto:</strong> ${escapeHtml(seg.strategy.producto)}</li>
            <li><strong>Precio:</strong> ${escapeHtml(seg.strategy.precio)}</li>
            <li><strong>Plaza:</strong> ${escapeHtml(seg.strategy.plaza)}</li>
            <li><strong>Promoción:</strong> ${escapeHtml(seg.strategy.promocion)}</li>
          </ul>
        </div>
        <div>
          <h4>Comunicación y Aviso Sugerido</h4>
          <p><strong>Mensaje central:</strong> ${escapeHtml(seg.mensajeComunicacion)}</p>
          <p><strong>Canales:</strong> ${escapeHtml(seg.canalesRecomendados.join(' · '))}</p>
          <div class="ad-box">
            <div class="ad-title">${escapeHtml(seg.aviso.titular)}</div>
            <p>${escapeHtml(seg.aviso.texto)}</p>
            <span class="ad-cta">${escapeHtml(seg.aviso.cta)}</span>
          </div>
        </div>
      </div>
    </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Informe CART – ${escapeHtml(dataset.name)}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 32px 20px; line-height: 1.55; }
  .container { max-width: 1080px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 40px; }
  h1 { font-size: 26px; margin: 0 0 8px 0; color: #0f172a; }
  h2 { font-size: 19px; margin: 32px 0 12px 0; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; color: #0f172a; }
  h3 { font-size: 16px; margin: 0 0 6px 0; color: #0f172a; }
  h4 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; margin: 10px 0 6px 0; }
  p { margin: 6px 0; }
  .muted { color: #475569; font-size: 13px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; background: #f8fafc; }
  .kpi-label { font-size: 12px; color: #475569; }
  .kpi-val { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; font-variant-numeric: tabular-nums; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  tr.highlight { background: #eff6ff; font-weight: 600; }
  .tree-wrap { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; overflow-x: auto; background: #ffffff; margin: 12px 0; }
  .segment-card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px; margin: 14px 0; background: #ffffff; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 10px; }
  .ad-box { border: 1px dashed #94a3b8; border-radius: 8px; padding: 12px; background: #f8fafc; margin-top: 8px; }
  .ad-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
  .ad-cta { display: inline-block; margin-top: 6px; padding: 4px 10px; background: #0f766e; color: #ffffff; border-radius: 5px; font-size: 12px; font-weight: 600; }
  pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px; line-height: 1.5; }
  @media print { body { background: #fff; padding: 0; } .container { border: none; padding: 0; } }
  @media (max-width: 760px) { .kpi-grid, .grid-2 { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="container">
  <h1>Informe Ejecutivo: Clasificador de Consumidores con Árboles de Decisión (CART)</h1>
  <p class="muted">Generado el ${escapeHtml(fecha)} · Metodología CRISP-DM · Base: ${escapeHtml(dataset.name)} (${formatInt(dataset.rows.length)} registros, ${formatInt(dataset.columns.length)} variables)${dataset.isSimulated ? ' · Datos simulados' : ''}</p>

  <h2>1. Contexto de Negocio y Datos</h2>
  <p><strong>Sector:</strong> ${escapeHtml(sector)}</p>
  <p><strong>Pregunta de negocio:</strong> ${escapeHtml(businessQuestion)}</p>
  <p><strong>Variable objetivo:</strong> ${escapeHtml(targetCol)} (${escapeHtml(model.classes.join(', '))})</p>

  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Accuracy en prueba</div><div class="kpi-val">${formatPct(evaluation.accuracy)}</div></div>
    <div class="kpi"><div class="kpi-label">Error base (NIR)</div><div class="kpi-val">${formatPct(1 - evaluation.noInfoRate)}</div></div>
    <div class="kpi"><div class="kpi-label">F1 promedio (Macro)</div><div class="kpi-val">${formatPct(evaluation.macroF1)}</div></div>
    <div class="kpi"><div class="kpi-label">Hojas (Segmentos)</div><div class="kpi-val">${formatInt(model.leafCount)}</div></div>
  </div>

  <h2>2. Diagrama del Árbol de Decisión</h2>
  <div class="tree-wrap">
    ${treeSvgMarkup || '<p class="muted">Diagrama no disponible.</p>'}
  </div>

  <h3>Reglas de decisión extraídas</h3>
  <ul>
    ${model.rules.map((r) => `<li>${escapeHtml(r.ruleText)}</li>`).join('')}
  </ul>

  <h3>Tabla de complejidad (CP y validación cruzada)</h3>
  <table>
    <thead><tr><th>CP</th><th>Divisiones (nsplit)</th><th>rel error</th><th>xerror</th><th>xstd</th></tr></thead>
    <tbody>${cpRowsHtml}</tbody>
  </table>

  <h2>3. Evaluación en Datos de Prueba (30%)</h2>
  <p class="muted">Filas = Valor real · Columnas = Predicción del árbol (Accuracy entrenamiento: ${formatPct(evaluation.trainAccuracy)} · Accuracy prueba: ${formatPct(evaluation.accuracy)} · Kappa: ${formatDec(evaluation.kappa, 3)})</p>
  <table>
    <thead><tr><th>Real \\ Predicción</th>${matrixHeaderHtml}</tr></thead>
    <tbody>${matrixBodyHtml}</tbody>
  </table>

  <h3>Métricas por clase</h3>
  <table>
    <thead><tr><th>Clase</th><th>Casos reales</th><th>Precisión</th><th>Recall (Sensibilidad)</th><th>Especificidad</th><th>F1-Score</th></tr></thead>
    <tbody>${perClassHtml}</tbody>
  </table>

  ${
    versions.length > 0
      ? `<h3>Comparativa de versiones guardadas</h3>
  <table>
    <thead><tr><th>Versión</th><th>Hojas</th><th>CP aplicado</th><th>Acc. Entrenamiento</th><th>Acc. Prueba</th><th>F1 Macro</th></tr></thead>
    <tbody>${versionsHtml}</tbody>
  </table>`
      : ''
  }

  <h2>4. Segmentos de Consumidores y Estrategias de Marketing</h2>
  ${segmentsHtml}

  <h2>5. Conclusión General y Próximos Pasos</h2>
  <p><strong>${escapeHtml(conclusion.headline)}</strong></p>
  <p>${escapeHtml(conclusion.variableInsights)}</p>
  <p>${escapeHtml(conclusion.campaignAdvice)}</p>
  <ul>
    ${conclusion.nextSteps.map((st) => `<li>${escapeHtml(st)}</li>`).join('')}
  </ul>

  <h2>6. Código R Equivalente Reproducible</h2>
  <pre><code>${escapeHtml(fullRScript)}</code></pre>
</div>
</body>
</html>`;
}
