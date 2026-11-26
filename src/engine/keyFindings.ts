import {
  CartModel,
  DatasetState,
  EvaluationResult,
  MarketingSegment,
  SplitConfig,
} from '../types';
import { computeCategoricalStats, computeNumericStats } from './statistics';
import { formatCp, formatDec, formatInt, formatPct } from '../utils/formatters';

export function buildKeyFinding(params: {
  step: number;
  businessQuestion: string;
  sector: string;
  dataset: DatasetState | null;
  targetCol: string;
  splitConfig: SplitConfig | null;
  baseModel: CartModel | null;
  activeModel: CartModel | null;
  evaluation: EvaluationResult | null;
  segments: MarketingSegment[];
}): string {
  const {
    step,
    businessQuestion,
    sector,
    dataset,
    targetCol,
    splitConfig,
    baseModel,
    activeModel,
    evaluation,
    segments,
  } = params;

  if (!dataset || dataset.rows.length === 0) {
    return 'Aún no hay una base de datos activa. Carga un archivo propio en el Paso 2, genera datos simulados en el Paso 3 o restaura el taller recomendado de 880 consumidores.';
  }

  switch (step) {
    case 1:
      return `El proyecto está enfocado en el sector "${sector || 'General'}" con el objetivo: "${businessQuestion.slice(0, 140)}${businessQuestion.length > 140 ? '…' : ''}". Actualmente trabajas con ${formatInt(dataset.rows.length)} registros.`;

    case 2:
      return `La base "${dataset.name}" se cargó correctamente con ${formatInt(dataset.rows.length)} consumidores y ${formatInt(dataset.columns.length)} columnas${dataset.separator ? ` (separador "${dataset.separator === '\t' ? 'TAB' : dataset.separator}", decimal "${dataset.decimal}")` : ''}. Trabajar sobre esta copia protege tus datos originales.`;

    case 3:
      return dataset.isSimulated
        ? `Estás analizando ${formatInt(dataset.rows.length)} registros simulados del sector ${dataset.sectorLabel || sector}. Recuerda presentar los resultados como ejercicio ilustrativo y validarlos luego con datos reales de tu empresa.`
        : `Tu base actual es ${dataset.origin === 'embedded' ? 'el taller real incrustado (880 consumidores)' : 'un archivo propio cargado por el equipo'}. Si deseas experimentar con variables numéricas adicionales, puedes generar un sector simulado aquí.`;

    case 4: {
      const missingTotal = dataset.columns.reduce((acc, c) => acc + c.missingCount, 0);
      return `La tabla tiene ${formatInt(dataset.rows.length)} consumidores y ${formatInt(dataset.columns.length)} variables (${dataset.columns.map((c) => c.name).join(', ')}), con ${formatInt(missingTotal)} celdas vacías en total.`;
    }

    case 5: {
      const nFac = dataset.columns.filter((c) => c.type === 'factor').length;
      const nNum = dataset.columns.filter((c) => c.type === 'numeric').length;
      const coded = dataset.columns.filter((c) => c.isIntegerCoded && c.type === 'numeric');
      if (coded.length > 0) {
        return `Tienes ${formatInt(nFac)} variables categóricas y ${formatInt(nNum)} numéricas. Revisa ${coded.map((c) => `"${c.name}"`).join(', ')}: tiene pocos valores enteros y podría representar categorías codificadas.`;
      }
      return `Clasificación lista: ${formatInt(nFac)} variables categóricas (factor) y ${formatInt(nNum)} variables numéricas listas para el análisis exploratorio.`;
    }

    case 6: {
      const numCols = dataset.columns.filter((c) => c.type === 'numeric');
      if (numCols.length === 0) {
        return 'Esta base no contiene variables numéricas; todas sus columnas son categóricas (factores), por lo que la segmentación se basará en perfiles cualitativos.';
      }
      const first = computeNumericStats(dataset.rows, numCols[0].name);
      if (!first) return 'No se pudieron calcular descriptivos numéricos.';
      return `En "${first.column}", el promedio es ${formatDec(first.mean, 1)} (mediana ${formatDec(first.median, 1)}) con un coeficiente de variación del ${formatDec(first.cv, 1)}% y ${formatInt(first.outliers.length)} valores atípicos detectados.`;
    }

    case 7: {
      const predictors = dataset.columns.filter(
        (c) => c.type === 'factor' && c.name !== targetCol
      );
      if (predictors.length === 0) {
        return 'No hay predictores categóricos distintos a la variable objetivo.';
      }
      let topCol = predictors[0].name;
      let topV = -1;
      for (const p of predictors) {
        const st = computeCategoricalStats(dataset.rows, p, targetCol);
        if ((st.cramersV ?? 0) > topV) {
          topV = st.cramersV ?? 0;
          topCol = p.name;
        }
      }
      return `Al cruzar cada variable categórica contra "${targetCol}", la variable "${topCol}" muestra la mayor asociación preliminar (V de Cramér = ${formatDec(topV, 3)}), por lo que es fuerte candidata a encabezar el árbol.`;
    }

    case 8: {
      const counts = new Map<string, number>();
      let valid = 0;
      for (const r of dataset.rows) {
        const v = r[targetCol];
        if (v !== null && v !== undefined && v !== '') {
          counts.set(String(v), (counts.get(String(v)) || 0) + 1);
          valid++;
        }
      }
      const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      const maj = sorted[0];
      const majPct = maj && valid > 0 ? (maj[1] / valid) * 100 : 0;
      const errBase = 100 - majPct;
      const minority = sorted.filter(([, c]) => (c / valid) * 100 < 20);
      if (minority.length > 0) {
        return `El error base sin modelo es ${formatDec(errBase, 1)}% (si siempre predices "${maj?.[0]}"). Atención: hay clases con menos del 20% (${minority.map(([k]) => k).join(', ')}), por lo que evaluaremos F1 por clase.`;
      }
      return `La variable objetivo "${targetCol}" tiene ${formatInt(sorted.length)} clases equilibradas. El error base sin modelo es ${formatDec(errBase, 1)}%; cualquier buen árbol debe reducir esa tasa de error.`;
    }

    case 9:
      if (!splitConfig) return 'Define la variable objetivo para dividir los datos.';
      return `Se separaron ${formatInt(splitConfig.trainIndices.length)} consumidores para entrenamiento (70%) y ${formatInt(splitConfig.testIndices.length)} para prueba (30%) con semilla ${splitConfig.seed}, conservando idénticas proporciones de "${targetCol}".`;

    case 10:
      if (!baseModel || !activeModel) return 'Entrena el árbol para ver resultados.';
      return `Con validación cruzada de 10 pliegues, el menor error (xerror) se alcanza en cp = ${formatCp(baseModel.optimalCpMinXerror)}, generando ${formatInt(activeModel.leafCount)} hojas y una exactitud en entrenamiento de ${formatPct(activeModel.trainAccuracy)}. La variable más influyente es "${activeModel.importance[0]?.variable || '—'}" (${formatDec(activeModel.importance[0]?.pctImportance || 0, 1)}%).`;

    case 11:
      if (!activeModel) return 'Ajusta las opciones de poda para explorar alternativas.';
      return `El árbol ajustado actual tiene ${formatInt(activeModel.leafCount)} hojas (profundidad ${formatInt(activeModel.maxDepthReached)}) y acierta ${formatPct(activeModel.trainAccuracy)} en entrenamiento. Guarda varias versiones para comprobar en el Paso 12 cuál generaliza mejor en prueba.`;

    case 12: {
      if (!evaluation) return 'Evalúa el modelo en prueba.';
      const lift = (evaluation.accuracy - evaluation.noInfoRate) * 100;
      const lowTxt =
        evaluation.lowF1Classes.length > 0
          ? ` Vigila ${evaluation.lowF1Classes.map((c) => `"${c.cls}" (F1 ${formatPct(c.f1)})`).join(', ')}.`
          : ' Todas las clases mantienen un F1 equilibrado.';
      return `En datos nunca vistos (prueba), el árbol logra ${formatPct(evaluation.accuracy)} de accuracy (${lift >= 0 ? '+' : ''}${formatDec(lift, 1)} pp sobre el error base) y F1 macro de ${formatPct(evaluation.macroF1)}.${lowTxt}`;
    }

    case 13: {
      const biggest = [...segments].sort((a, b) => b.n - a.n)[0];
      const topVar = activeModel?.importance[0];
      const lowVars = activeModel?.importance.filter((v) => v.pctImportance < 5) || [];
      return `Se tradujeron las ${formatInt(segments.length)} hojas del árbol en segmentos comerciales accionables. El grupo más grande es "${biggest?.segmentName || '—'}" (${formatInt(biggest?.n || 0)} casos, predice ${biggest?.predictedClass || '—'}). La variable líder es "${topVar?.variable || '—'}"${lowVars.length > 0 ? `, mientras ${lowVars.map((l) => l.variable).join(', ')} casi no influyen` : ''}.`;
    }

    case 14:
    default:
      return `Todo listo para compartir: puedes descargar el informe HTML ejecutivo con el diagrama y estrategias, el CSV con ${formatInt(evaluation?.predictions.length || 0)} consumidores clasificados en prueba y el script completo en R.`;
  }
}
