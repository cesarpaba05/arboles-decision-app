export type VariableType = 'factor' | 'numeric';

export type CrispPhase =
  | 'Comprensión del negocio'
  | 'Comprensión de los datos'
  | 'Preparación de los datos'
  | 'Modelado'
  | 'Evaluación'
  | 'Despliegue';

export interface ColumnMeta {
  name: string;
  detectedType: VariableType;
  type: VariableType;
  uniqueCount: number;
  missingCount: number;
  sampleValues: string[];
  levels?: string[];
  isIntegerCoded?: boolean;
}

export type DataRow = Record<string, string | number | null>;

export type DatasetOrigin = 'embedded' | 'uploaded' | 'synthetic';

export interface DatasetState {
  name: string;
  origin: DatasetOrigin;
  isRecommended?: boolean;
  isSimulated?: boolean;
  sectorLabel?: string;
  fileName?: string;
  separator?: ',' | ';' | '\t';
  decimal?: '.' | ',';
  rawText?: string;
  rows: DataRow[];
  columns: ColumnMeta[];
}

export interface NumericStats {
  column: string;
  n: number;
  missing: number;
  mean: number;
  median: number;
  sd: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
  cv: number;
  skewness: number;
  kurtosis: number;
  outliers: number[];
  whiskerLow: number;
  whiskerHigh: number;
  histogram: { label: string; from: number; to: number; count: number; pct: number }[];
}

export interface CategoricalLevelStat {
  level: string;
  count: number;
  pct: number;
}

export interface CrossTabRow {
  predictorLevel: string;
  total: number;
  counts: Record<string, number>;
  rowPcts: Record<string, number>;
}

export interface CategoricalStats {
  column: string;
  n: number;
  levels: CategoricalLevelStat[];
  crossTab?: CrossTabRow[];
  cramersV?: number;
}

export interface SplitConfig {
  seed: number;
  trainRatio: number;
  trainIndices: number[];
  testIndices: number[];
  classSummary: {
    cls: string;
    totalCount: number;
    totalPct: number;
    trainCount: number;
    trainPct: number;
    testCount: number;
    testPct: number;
  }[];
}

export interface RpartControl {
  cp: number;
  minsplit: number;
  minbucket: number;
  maxdepth: number;
  xval: number;
}

export interface CartSplitCondition {
  variable: string;
  type: VariableType;
  // For numeric: left is <= threshold, right is > threshold
  threshold?: number;
  // For factor: left is in leftCategories, right is in rightCategories
  leftCategories?: string[];
  rightCategories?: string[];
}

export interface CartNode {
  id: number; // R-style node number (1 = root, 2*i = left, 2*i+1 = right)
  depth: number;
  isLeaf: boolean;
  n: number;
  pctOfTrain: number;
  classCounts: Record<string, number>;
  classProbs: Record<string, number>;
  predictedClass: string;
  gini: number;
  misclassified: number;
  split?: CartSplitCondition;
  impurityGain?: number;
  left?: CartNode;
  right?: CartNode;
  rulePath: string[];
}

export interface CpRow {
  cp: number;
  nsplit: number;
  relError: number;
  xerror: number;
  xstd: number;
}

export interface CartRule {
  nodeId: number;
  predictedClass: string;
  probability: number;
  n: number;
  pctOfTrain: number;
  conditions: string[];
  ruleText: string;
}

export interface VariableImportanceItem {
  variable: string;
  rawImportance: number;
  pctImportance: number;
}

export interface CartModel {
  root: CartNode;
  classes: string[];
  cpTable: CpRow[];
  optimalCpMinXerror: number;
  optimalCpOneSe: number;
  appliedCp: number;
  control: RpartControl;
  leafCount: number;
  maxDepthReached: number;
  trainAccuracy: number;
  rules: CartRule[];
  importance: VariableImportanceItem[];
  rootErrorRate: number;
}

export interface ClassMetrics {
  cls: string;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  specificity: number;
  f1: number;
  support: number;
}

export interface EvaluationResult {
  accuracy: number;
  errorRate: number;
  noInfoRate: number;
  kappa: number;
  macroF1: number;
  trainAccuracy: number;
  matrix: number[][]; // rows = actual, cols = predicted
  classes: string[];
  perClass: ClassMetrics[];
  predictions: {
    rowIndex: number;
    actual: string;
    predicted: string;
    correct: boolean;
    leafId: number;
    probability: number;
  }[];
  lowF1Classes: ClassMetrics[];
}

export interface SavedTreeVersion {
  id: string;
  name: string;
  strategyLabel: string;
  control: RpartControl;
  model: CartModel;
  evaluation: EvaluationResult;
  createdAt: number;
}

export interface MarketingSegment {
  leafId: number;
  segmentName: string;
  description: string;
  conditions: string[];
  n: number;
  pctOfBase: number;
  predictedClass: string;
  probability: number;
  classDistribution: { cls: string; pct: number }[];
  strategy: {
    producto: string;
    precio: string;
    plaza: string;
    promocion: string;
  };
  mensajeComunicacion: string;
  canalesRecomendados: string[];
  aviso: {
    titular: string;
    texto: string;
    cta: string;
  };
}

export type SyntheticSectorId =
  | 'alimentos'
  | 'telecom'
  | 'banca'
  | 'retail'
  | 'salud'
  | 'educacion';

export interface StepDefinition {
  number: number;
  shortTitle: string;
  title: string;
  phase: CrispPhase;
  whatItMeansTitle: string;
  whatItMeansText: string;
  whatItMeansExample: string;
}
