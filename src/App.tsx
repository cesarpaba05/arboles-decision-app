import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Menu,
  X,
} from 'lucide-react';
import {
  CartModel,
  CrispPhase,
  DatasetState,
  RpartControl,
  SavedTreeVersion,
  SplitConfig,
  SyntheticSectorId,
  VariableType,
} from './types';
import {
  DEFAULT_BUSINESS_QUESTION,
  DEFAULT_BUSINESS_SECTOR,
  EMBEDDED_CEREAL_CSV,
  RECOMMENDED_CASE_NAME,
  RECOMMENDED_FILE_NAME,
} from './data/embeddedCereal';
import { generateSyntheticDataset } from './data/syntheticGenerator';
import { STEPS_METADATA } from './data/stepsMetadata';
import {
  applyColumnTypes,
  detectTextFormatting,
  parseDelimitedText,
  parseExcelBuffer,
  suggestTargetColumn,
} from './engine/parser';
import {
  createStratifiedSplit,
  evaluateCartModel,
  trainCartModel,
} from './engine/cart';
import {
  generateBusinessConclusion,
  generateMarketingSegments,
} from './engine/marketingRules';
import { buildFullRScript, getEquivalentRCode } from './engine/rCodeGenerator';
import {
  buildHtmlReport,
  downloadBlob,
  exportTestPredictionsCsv,
} from './engine/exporter';
import { buildKeyFinding } from './engine/keyFindings';
import { formatCp, formatInt, formatPct } from './utils/formatters';
import { StepShell } from './components/StepShell';
import { TreeDiagram } from './components/TreeDiagram';
import {
  Step01BusinessContext,
  Step02LoadData,
  Step03SyntheticData,
  Step04Preview,
} from './components/steps/PhaseBusinessAndDataLoad';
import {
  Step05VariableTypes,
  Step06NumericAnalysis,
  Step07CategoricalCharts,
} from './components/steps/PhaseExploration';
import {
  Step08TargetVariable,
  Step09TrainTestSplit,
} from './components/steps/PhasePreparation';
import {
  PruningMode,
  Step10OptimizedTree,
  Step11PruneAndCompare,
} from './components/steps/PhaseModeling';
import {
  Step12Evaluation,
  Step13BusinessApplication,
  Step14Export,
} from './components/steps/PhaseEvaluationAndDeploy';

const CRISP_PHASES: CrispPhase[] = [
  'Comprensión del negocio',
  'Comprensión de los datos',
  'Preparación de los datos',
  'Modelado',
  'Evaluación',
  'Despliegue',
];

const DEFAULT_CONTROL: RpartControl = {
  cp: 0.001,
  minsplit: 20,
  minbucket: 7,
  maxdepth: 5,
  xval: 10,
};

function createEmbeddedDataset(): DatasetState {
  const { rows, columns } = parseDelimitedText(EMBEDDED_CEREAL_CSV, ',', '.');
  return {
    name: RECOMMENDED_CASE_NAME,
    origin: 'embedded',
    isRecommended: true,
    isSimulated: false,
    sectorLabel: DEFAULT_BUSINESS_SECTOR,
    fileName: RECOMMENDED_FILE_NAME,
    separator: ',',
    decimal: '.',
    rawText: EMBEDDED_CEREAL_CSV,
    rows,
    columns,
  };
}

export default function App() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Paso 1: Contexto
  const [businessQuestion, setBusinessQuestion] = useState<string>(
    DEFAULT_BUSINESS_QUESTION
  );
  const [sector, setSector] = useState<string>(DEFAULT_BUSINESS_SECTOR);

  // Paso 2-5: Datos
  const [dataset, setDataset] = useState<DatasetState | null>(() =>
    createEmbeddedDataset()
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Paso 8-9: Objetivo y partición
  const [targetCol, setTargetCol] = useState<string>('desayuno');
  const [seed, setSeed] = useState<number>(123);
  const [splitConfig, setSplitConfig] = useState<SplitConfig | null>(null);

  // Paso 10-12: Modelado, poda y versiones
  const [pruningMode, setPruningMode] = useState<PruningMode>('min_xerror');
  const [manualCp, setManualCp] = useState<number>(0.01);
  const [sliderControl, setSliderControl] = useState<RpartControl>({
    cp: 0.01,
    minsplit: 20,
    minbucket: 7,
    maxdepth: 4,
    xval: 10,
  });
  const [savedVersions, setSavedVersions] = useState<SavedTreeVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  const exportSvgRef = useRef<SVGSVGElement | null>(null);

  // Recalcular partición 70/30 automáticamente cuando cambia dataset, targetCol o seed
  useEffect(() => {
    if (!dataset || dataset.rows.length < 10 || !targetCol) {
      setSplitConfig(null);
      return;
    }
    const targetExists = dataset.columns.some((c) => c.name === targetCol);
    if (!targetExists) {
      setSplitConfig(null);
      return;
    }
    const nextSplit = createStratifiedSplit(dataset.rows, targetCol, seed, 0.7);
    setSplitConfig(nextSplit);
  }, [dataset, targetCol, seed]);

  // Modelo base amplio (cp = 0.001) + tabla CP y CV de 10 pliegues
  const baseModel: CartModel | null = useMemo(() => {
    if (!dataset || !splitConfig || splitConfig.trainIndices.length < 10 || !targetCol) {
      return null;
    }
    return trainCartModel(
      dataset.rows,
      splitConfig.trainIndices,
      dataset.columns,
      targetCol,
      DEFAULT_CONTROL,
      seed,
      DEFAULT_CONTROL.cp
    );
  }, [dataset, splitConfig, targetCol, seed]);

  // Árbol óptimo del Paso 10 (menor xerror)
  const optimalModel: CartModel | null = useMemo(() => {
    if (!dataset || !splitConfig || !baseModel || !targetCol) return null;
    return trainCartModel(
      dataset.rows,
      splitConfig.trainIndices,
      dataset.columns,
      targetCol,
      DEFAULT_CONTROL,
      seed,
      baseModel.optimalCpMinXerror
    );
  }, [dataset, splitConfig, baseModel, targetCol, seed]);

  // Inicializar manualCp y versiones guardadas cuando cambia el modelo base
  useEffect(() => {
    if (!baseModel || !optimalModel || !dataset || !splitConfig) {
      setSavedVersions([]);
      setActiveVersionId(null);
      return;
    }

    setManualCp(baseModel.optimalCpMinXerror);

    const oneSeModel = trainCartModel(
      dataset.rows,
      splitConfig.trainIndices,
      dataset.columns,
      targetCol,
      DEFAULT_CONTROL,
      seed,
      baseModel.optimalCpOneSe
    );
    const depth2Model = trainCartModel(
      dataset.rows,
      splitConfig.trainIndices,
      dataset.columns,
      targetCol,
      { cp: 0.001, minsplit: 20, minbucket: 7, maxdepth: 2, xval: 10 },
      seed,
      0.001
    );

    const vOpt: SavedTreeVersion = {
      id: 'v-opt',
      name: 'Árbol optimizado (menor xerror)',
      strategyLabel: `cp = ${formatCp(optimalModel.appliedCp)}`,
      control: DEFAULT_CONTROL,
      model: optimalModel,
      evaluation: evaluateCartModel(optimalModel, dataset.rows, splitConfig.testIndices, targetCol),
      createdAt: 1,
    };
    const vOneSe: SavedTreeVersion = {
      id: 'v-1se',
      name: 'Árbol podado (regla 1-SE)',
      strategyLabel: `cp = ${formatCp(oneSeModel.appliedCp)}`,
      control: DEFAULT_CONTROL,
      model: oneSeModel,
      evaluation: evaluateCartModel(oneSeModel, dataset.rows, splitConfig.testIndices, targetCol),
      createdAt: 2,
    };
    const vDepth2: SavedTreeVersion = {
      id: 'v-d2',
      name: 'Árbol simple (profundidad 2)',
      strategyLabel: 'maxdepth = 2',
      control: { cp: 0.001, minsplit: 20, minbucket: 7, maxdepth: 2, xval: 10 },
      model: depth2Model,
      evaluation: evaluateCartModel(depth2Model, dataset.rows, splitConfig.testIndices, targetCol),
      createdAt: 3,
    };

    setSavedVersions([vOpt, vOneSe, vDepth2]);
    setActiveVersionId('v-opt');
  }, [baseModel, optimalModel, dataset, splitConfig, targetCol, seed]);

  // Modelo en vivo del Paso 11 según el modo de poda seleccionado
  const livePrunedModel: CartModel | null = useMemo(() => {
    if (!dataset || !splitConfig || !baseModel || !targetCol) return null;

    if (pruningMode === 'min_xerror') {
      return optimalModel;
    }
    if (pruningMode === 'one_se') {
      return trainCartModel(
        dataset.rows,
        splitConfig.trainIndices,
        dataset.columns,
        targetCol,
        DEFAULT_CONTROL,
        seed,
        baseModel.optimalCpOneSe
      );
    }
    if (pruningMode === 'manual_cp') {
      return trainCartModel(
        dataset.rows,
        splitConfig.trainIndices,
        dataset.columns,
        targetCol,
        DEFAULT_CONTROL,
        seed,
        manualCp
      );
    }
    return trainCartModel(
      dataset.rows,
      splitConfig.trainIndices,
      dataset.columns,
      targetCol,
      sliderControl,
      seed,
      sliderControl.cp
    );
  }, [
    dataset,
    splitConfig,
    baseModel,
    optimalModel,
    targetCol,
    seed,
    pruningMode,
    manualCp,
    sliderControl,
  ]);

  // Modelo activo para Pasos 12, 13 y 14 (versión seleccionada o el árbol en vivo)
  const activeVersion = useMemo(
    () => savedVersions.find((v) => v.id === activeVersionId) || null,
    [savedVersions, activeVersionId]
  );

  const finalModel = useMemo(() => {
    if (currentStep === 10) return optimalModel;
    if (currentStep === 11) return livePrunedModel;
    return activeVersion?.model || livePrunedModel || optimalModel;
  }, [currentStep, optimalModel, livePrunedModel, activeVersion]);

  const finalEvaluation = useMemo(() => {
    if (!finalModel || !dataset || !splitConfig || !targetCol) return null;
    if (activeVersion && currentStep >= 12 && finalModel === activeVersion.model) {
      return activeVersion.evaluation;
    }
    return evaluateCartModel(finalModel, dataset.rows, splitConfig.testIndices, targetCol);
  }, [finalModel, dataset, splitConfig, targetCol, activeVersion, currentStep]);

  const marketingSegments = useMemo(() => {
    if (!finalModel) return [];
    return generateMarketingSegments(finalModel, sector);
  }, [finalModel, sector]);

  const businessConclusion = useMemo(() => {
    if (!finalModel || !finalEvaluation) return null;
    return generateBusinessConclusion(finalModel, finalEvaluation, targetCol);
  }, [finalModel, finalEvaluation, targetCol]);

  // Handlers de datos
  const applyNewDataset = useCallback((next: DatasetState, suggestedQuestion?: string, suggestedSector?: string) => {
    setDataset(next);
    setUploadError(null);
    const sug = suggestTargetColumn(next.columns);
    setTargetCol(sug.suggested);
    if (suggestedQuestion) setBusinessQuestion(suggestedQuestion);
    if (suggestedSector) setSector(suggestedSector);
  }, []);

  const handleLoadRecommended = () => {
    const emb = createEmbeddedDataset();
    applyNewDataset(emb, DEFAULT_BUSINESS_QUESTION, DEFAULT_BUSINESS_SECTOR);
    setTargetCol('desayuno');
  };

  const handleClearDataset = () => {
    setDataset(null);
    setTargetCol('');
    setSplitConfig(null);
    setSavedVersions([]);
    setActiveVersionId(null);
  };

  const handleUploadFile = async (file: File) => {
    setUploadError(null);
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        const { rows, columns, sheetName } = await parseExcelBuffer(buf, '.');
        if (rows.length < 15) {
          setUploadError('El archivo debe tener al menos 15 filas válidas para entrenar y probar un árbol.');
          return;
        }
        applyNewDataset({
          name: `${file.name} (${sheetName})`,
          origin: 'uploaded',
          isSimulated: false,
          sectorLabel: sector,
          fileName: file.name,
          rows,
          columns,
        });
      } else if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        const text = await file.text();
        const detected = detectTextFormatting(text);
        const { rows, columns } = parseDelimitedText(
          text,
          detected.separator,
          detected.decimal
        );
        if (rows.length < 15 || columns.length < 2) {
          setUploadError(
            'No se pudieron detectar al menos 2 columnas y 15 filas. Prueba ajustar el separador abajo o revisa el formato del archivo.'
          );
        }
        applyNewDataset({
          name: file.name,
          origin: 'uploaded',
          isSimulated: false,
          sectorLabel: sector,
          fileName: file.name,
          separator: detected.separator,
          decimal: detected.decimal,
          rawText: text,
          rows,
          columns,
        });
      } else {
        setUploadError('Formato no compatible. Sube archivos .csv, .txt, .xlsx o .xls.');
      }
    } catch {
      setUploadError('Ocurrió un error al leer el archivo. Verifica que no esté corrupto o protegido con contraseña.');
    }
  };

  const handleReparseDelimited = (sep: ',' | ';' | '\t', dec: '.' | ',') => {
    if (!dataset?.rawText) return;
    const { rows, columns } = parseDelimitedText(dataset.rawText, sep, dec);
    applyNewDataset({
      ...dataset,
      separator: sep,
      decimal: dec,
      rows,
      columns,
    });
  };

  const handleGenerateSynthetic = (
    sectorId: SyntheticSectorId,
    count: number,
    synthSeed: number
  ) => {
    const { rows, columns, sector: secInfo } = generateSyntheticDataset(
      sectorId,
      count,
      synthSeed
    );
    applyNewDataset(
      {
        name: `Simulación – ${secInfo.label} (${formatInt(rows.length)} registros)`,
        origin: 'synthetic',
        isSimulated: true,
        sectorLabel: secInfo.sectorName,
        fileName: `sintetico_${sectorId}_${rows.length}.csv`,
        rows,
        columns,
      },
      secInfo.businessQuestion,
      secInfo.sectorName
    );
    setTargetCol(secInfo.targetName);
  };

  const handleToggleColumnType = (colName: string, newType: VariableType) => {
    if (!dataset) return;
    const updatedCols = dataset.columns.map((c) => {
      if (c.name !== colName) return c;
      const updated = { ...c, type: newType };
      if (newType === 'factor') {
        const lvls = Array.from(
          new Set(
            dataset.rows
              .map((r) => r[colName])
              .filter((v) => v !== null && v !== undefined && v !== '')
              .map(String)
          )
        ).sort((a, b) => a.localeCompare(b, 'es'));
        updated.levels = lvls;
      }
      return updated;
    });
    const updatedRows = applyColumnTypes(dataset.rows, updatedCols);
    setDataset({
      ...dataset,
      columns: updatedCols,
      rows: updatedRows,
    });
    if (colName === targetCol && newType !== 'factor') {
      const sug = suggestTargetColumn(updatedCols);
      setTargetCol(sug.suggested);
    }
  };

  const handleSaveVersion = (name: string, strategyLabel: string) => {
    if (!livePrunedModel || !dataset || !splitConfig) return;
    const evalRes = evaluateCartModel(
      livePrunedModel,
      dataset.rows,
      splitConfig.testIndices,
      targetCol
    );
    const id = `v-${Date.now()}`;
    const newVer: SavedTreeVersion = {
      id,
      name,
      strategyLabel,
      control: livePrunedModel.control,
      model: livePrunedModel,
      evaluation: evalRes,
      createdAt: Date.now(),
    };
    setSavedVersions((prev) => [...prev, newVer]);
    setActiveVersionId(id);
  };

  const handleDeleteVersion = (id: string) => {
    setSavedVersions((prev) => {
      const filtered = prev.filter((v) => v.id !== id);
      if (activeVersionId === id && filtered.length > 0) {
        setActiveVersionId(filtered[0].id);
      }
      return filtered;
    });
  };

  // Contexto de código R
  const rContext = useMemo(
    () => ({
      dataset: dataset || createEmbeddedDataset(),
      targetCol: targetCol || 'desayuno',
      splitConfig,
      control: pruningMode === 'sliders' ? sliderControl : DEFAULT_CONTROL,
      appliedCp: finalModel?.appliedCp ?? 0.01,
      selectedStep: currentStep,
    }),
    [dataset, targetCol, splitConfig, pruningMode, sliderControl, finalModel, currentStep]
  );

  const currentStepMeta = STEPS_METADATA[currentStep - 1];

  const keyFinding = useMemo(
    () =>
      buildKeyFinding({
        step: currentStep,
        businessQuestion,
        sector,
        dataset,
        targetCol,
        splitConfig,
        baseModel,
        activeModel: finalModel,
        evaluation: finalEvaluation,
        segments: marketingSegments,
      }),
    [
      currentStep,
      businessQuestion,
      sector,
      dataset,
      targetCol,
      splitConfig,
      baseModel,
      finalModel,
      finalEvaluation,
      marketingSegments,
    ]
  );

  const handleDownloadHtml = () => {
    if (!dataset || !finalModel || !finalEvaluation || !businessConclusion) return;
    const svgMarkup = exportSvgRef.current ? exportSvgRef.current.outerHTML : '';
    const html = buildHtmlReport({
      businessQuestion,
      sector,
      dataset,
      targetCol,
      model: finalModel,
      evaluation: finalEvaluation,
      versions: savedVersions,
      segments: marketingSegments,
      conclusion: businessConclusion,
      treeSvgMarkup: svgMarkup,
      fullRScript: buildFullRScript(rContext),
    });
    downloadBlob(html, 'informe_arbol_decision_cart.html', 'text/html;charset=utf-8;');
  };

  const handleDownloadCsv = () => {
    if (!dataset || !finalEvaluation) return;
    exportTestPredictionsCsv(dataset, targetCol, finalEvaluation, marketingSegments);
  };

  const handleDownloadRScript = () => {
    downloadBlob(
      buildFullRScript(rContext),
      'pipeline_arbol_cart_crisp_dm.R',
      'text/plain;charset=utf-8;'
    );
  };

  const jumpToPhase = (phase: CrispPhase) => {
    const firstStep = STEPS_METADATA.find((s) => s.phase === phase);
    if (firstStep) {
      setCurrentStep(firstStep.number);
      setMobileNavOpen(false);
    }
  };

  const progressPct = Math.round((currentStep / 14) * 100);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zonas exactas */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen((o) => !o)}
            className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
            aria-label="Abrir navegación de pasos"
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <a
            href="#inicio"
            onClick={(e) => {
              e.preventDefault();
              setCurrentStep(1);
            }}
            className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 sm:text-lg"
          >
            Clasificador de Consumidores
          </a>
        </div>

        <nav className="hidden items-center gap-6 text-xs font-medium text-slate-600 xl:flex">
          <button
            type="button"
            onClick={() => jumpToPhase('Comprensión del negocio')}
            className="hover:text-slate-950 hover:underline whitespace-nowrap shrink-0"
          >
            Negocio
          </button>
          <button
            type="button"
            onClick={() => jumpToPhase('Comprensión de los datos')}
            className="hover:text-slate-950 hover:underline whitespace-nowrap shrink-0"
          >
            Exploración
          </button>
          <button
            type="button"
            onClick={() => jumpToPhase('Modelado')}
            className="hover:text-slate-950 hover:underline whitespace-nowrap shrink-0"
          >
            Árbol CART
          </button>
          <button
            type="button"
            onClick={() => jumpToPhase('Evaluación')}
            className="hover:text-slate-950 hover:underline whitespace-nowrap shrink-0"
          >
            Evaluación
          </button>
          <button
            type="button"
            onClick={() => jumpToPhase('Despliegue')}
            className="hover:text-slate-950 hover:underline whitespace-nowrap shrink-0"
          >
            Marketing
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setCurrentStep(14)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Exportar informe
          </button>
        </div>
      </header>

      {/* Barra de progreso global */}
      <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-teal-700 transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center gap-2 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
            <span>{progressPct}%</span>
            <span aria-hidden="true">·</span>
            <span>
              {dataset
                ? `${formatInt(dataset.rows.length)} filas`
                : 'Sin base'}
            </span>
            {finalEvaluation && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">
                  Acc. prueba {formatPct(finalEvaluation.accuracy)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Layout principal Sidebar + Workspace */}
      <div className="mx-auto flex max-w-[1440px]">
        {/* Sidebar de pasos CRISP-DM */}
        <aside
          className={`${
            mobileNavOpen ? 'fixed inset-0 top-[57px] z-20 block bg-white' : 'hidden'
          } w-full shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4 lg:sticky lg:top-[90px] lg:block lg:h-[calc(100vh-90px)] lg:w-[280px]`}
        >
          <div className="space-y-5">
            {CRISP_PHASES.map((phase) => {
              const phaseSteps = STEPS_METADATA.filter((s) => s.phase === phase);
              return (
                <div key={phase}>
                  <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {phase}
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    {phaseSteps.map((s) => {
                      const isCurrent = s.number === currentStep;
                      const isDone = s.number < currentStep;
                      return (
                        <button
                          key={s.number}
                          type="button"
                          onClick={() => {
                            setCurrentStep(s.number);
                            setMobileNavOpen(false);
                          }}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                            isCurrent
                              ? 'bg-slate-900 font-semibold text-white'
                              : isDone
                                ? 'text-slate-700 hover:bg-slate-100'
                                : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[11px] tabular-nums ${
                              isCurrent
                                ? 'bg-teal-500 text-white'
                                : isDone
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              s.number
                            )}
                          </span>
                          <span className="truncate">{s.shortTitle}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Área de trabajo del paso actual */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-5xl space-y-8">
            <StepShell
              step={currentStepMeta}
              keyFinding={keyFinding}
              rCode={getEquivalentRCode(rContext)}
            >
              {currentStep === 1 && (
                <Step01BusinessContext
                  businessQuestion={businessQuestion}
                  setBusinessQuestion={setBusinessQuestion}
                  sector={sector}
                  setSector={setSector}
                  dataset={dataset}
                  onLoadRecommended={handleLoadRecommended}
                  onClearDataset={handleClearDataset}
                />
              )}

              {currentStep === 2 && (
                <Step02LoadData
                  dataset={dataset}
                  onUploadFile={handleUploadFile}
                  onReparseDelimited={handleReparseDelimited}
                  onLoadRecommended={handleLoadRecommended}
                  onClearDataset={handleClearDataset}
                  uploadError={uploadError}
                />
              )}

              {currentStep === 3 && (
                <Step03SyntheticData
                  dataset={dataset}
                  onGenerateSynthetic={handleGenerateSynthetic}
                />
              )}

              {currentStep === 4 && <Step04Preview dataset={dataset} />}

              {currentStep === 5 && (
                <Step05VariableTypes
                  columns={dataset?.columns || []}
                  onToggleType={handleToggleColumnType}
                />
              )}

              {currentStep === 6 && (
                <Step06NumericAnalysis
                  rows={dataset?.rows || []}
                  columns={dataset?.columns || []}
                  onGoToStep3={() => setCurrentStep(3)}
                />
              )}

              {currentStep === 7 && (
                <Step07CategoricalCharts
                  rows={dataset?.rows || []}
                  columns={dataset?.columns || []}
                  targetCol={targetCol}
                />
              )}

              {currentStep === 8 && (
                <Step08TargetVariable
                  rows={dataset?.rows || []}
                  columns={dataset?.columns || []}
                  targetCol={targetCol}
                  onSelectTarget={setTargetCol}
                />
              )}

              {currentStep === 9 && (
                <Step09TrainTestSplit
                  seed={seed}
                  onChangeSeedAndSplit={setSeed}
                  splitConfig={splitConfig}
                  targetCol={targetCol}
                />
              )}

              {currentStep === 10 && (
                <Step10OptimizedTree
                  baseModel={baseModel}
                  optimalModel={optimalModel}
                />
              )}

              {currentStep === 11 && (
                <Step11PruneAndCompare
                  baseModel={baseModel}
                  currentModel={livePrunedModel}
                  pruningMode={pruningMode}
                  setPruningMode={setPruningMode}
                  manualCp={manualCp}
                  setManualCp={setManualCp}
                  sliderControl={sliderControl}
                  setSliderControl={setSliderControl}
                  savedVersions={savedVersions}
                  onSaveVersion={handleSaveVersion}
                  onDeleteVersion={handleDeleteVersion}
                />
              )}

              {currentStep === 12 && (
                <Step12Evaluation
                  evaluation={finalEvaluation}
                  model={finalModel}
                  savedVersions={savedVersions}
                  activeVersionId={activeVersionId}
                  onSelectVersion={setActiveVersionId}
                />
              )}

              {currentStep === 13 && (
                <Step13BusinessApplication
                  segments={marketingSegments}
                  conclusion={businessConclusion}
                  model={finalModel}
                />
              )}

              {currentStep === 14 && (
                <Step14Export
                  dataset={dataset}
                  targetCol={targetCol}
                  evaluation={finalEvaluation}
                  segments={marketingSegments}
                  onDownloadHtml={handleDownloadHtml}
                  onDownloadCsv={handleDownloadCsv}
                  onDownloadRScript={handleDownloadRScript}
                />
              )}
            </StepShell>

            {/* Controles Anterior / Siguiente */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-5">
              <button
                type="button"
                disabled={currentStep === 1}
                onClick={() => {
                  setCurrentStep((s) => Math.max(1, s - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Anterior</span>
              </button>

              <div className="hidden font-mono text-xs tabular-nums text-slate-500 sm:block">
                Paso {currentStep} / 14
              </div>

              <button
                type="button"
                disabled={currentStep === 14}
                onClick={() => {
                  setCurrentStep((s) => Math.min(14, s + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
              >
                <span>Siguiente</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* SVG oculto del árbol activo para exportación HTML completa desde cualquier paso */}
      {finalModel && (
        <div className="hidden" aria-hidden="true">
          <TreeDiagram
            root={finalModel.root}
            classes={finalModel.classes}
            svgRef={exportSvgRef}
          />
        </div>
      )}
    </div>
  );
}
