import {
  CartModel,
  CartNode,
  CartRule,
  CartSplitCondition,
  ClassMetrics,
  ColumnMeta,
  CpRow,
  DataRow,
  EvaluationResult,
  RpartControl,
  SplitConfig,
  VariableImportanceItem,
} from '../types';
import { formatDec } from '../utils/formatters';
import { createSeededRng } from '../utils/prng';

export function createStratifiedSplit(
  rows: DataRow[],
  targetCol: string,
  seed: number,
  trainRatio = 0.7
): SplitConfig {
  const rng = createSeededRng(seed);
  const byClass = new Map<string, number[]>();

  rows.forEach((row, idx) => {
    const val = row[targetCol];
    if (val === null || val === undefined || val === '') return;
    const cls = String(val);
    if (!byClass.has(cls)) byClass.set(cls, []);
    byClass.get(cls)!.push(idx);
  });

  const classes = Array.from(byClass.keys()).sort((a, b) => a.localeCompare(b, 'es'));
  const trainIndices: number[] = [];
  const testIndices: number[] = [];

  for (const cls of classes) {
    const shuffled = rng.shuffle(byClass.get(cls)!);
    let nTrain = Math.round(shuffled.length * trainRatio);
    if (shuffled.length >= 2) {
      nTrain = Math.max(1, Math.min(shuffled.length - 1, nTrain));
    }
    trainIndices.push(...shuffled.slice(0, nTrain));
    testIndices.push(...shuffled.slice(nTrain));
  }

  const totalValid = trainIndices.length + testIndices.length;
  const classSummary = classes.map((cls) => {
    const clsTotal = byClass.get(cls)!.length;
    const trCount = trainIndices.filter((i) => String(rows[i][targetCol]) === cls).length;
    const teCount = testIndices.filter((i) => String(rows[i][targetCol]) === cls).length;
    return {
      cls,
      totalCount: clsTotal,
      totalPct: totalValid > 0 ? (clsTotal / totalValid) * 100 : 0,
      trainCount: trCount,
      trainPct: trainIndices.length > 0 ? (trCount / trainIndices.length) * 100 : 0,
      testCount: teCount,
      testPct: testIndices.length > 0 ? (teCount / testIndices.length) * 100 : 0,
    };
  });

  return {
    seed,
    trainRatio,
    trainIndices: trainIndices.sort((a, b) => a - b),
    testIndices: testIndices.sort((a, b) => a - b),
    classSummary,
  };
}

interface InternalNode {
  id: number;
  depth: number;
  isLeaf: boolean;
  indices: number[];
  n: number;
  classCounts: number[];
  predictedClassIdx: number;
  gini: number;
  misclassified: number;
  split?: CartSplitCondition;
  impurityGain: number;
  left?: InternalNode;
  right?: InternalNode;
}

function giniFromCounts(counts: number[], total: number): number {
  if (total <= 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < counts.length; i++) {
    const p = counts[i] / total;
    sumSq += p * p;
  }
  return 1 - sumSq;
}

function countClasses(indices: number[], yIdx: number[], numClasses: number): number[] {
  const counts = new Array(numClasses).fill(0);
  for (let i = 0; i < indices.length; i++) {
    counts[yIdx[indices[i]]]++;
  }
  return counts;
}

function argMax(counts: number[]): number {
  let bestIdx = 0;
  let bestVal = counts[0] ?? 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > bestVal) {
      bestVal = counts[i];
      bestIdx = i;
    }
  }
  return bestIdx;
}

function findBestSplit(
  indices: number[],
  rows: DataRow[],
  predictors: ColumnMeta[],
  yIdx: number[],
  numClasses: number,
  minbucket: number
): {
  split: CartSplitCondition;
  gain: number;
  leftIndices: number[];
  rightIndices: number[];
} | null {
  const n = indices.length;
  const parentCounts = countClasses(indices, yIdx, numClasses);
  const parentImpurity = n * giniFromCounts(parentCounts, n);

  let bestGain = 1e-12;
  let bestResult: {
    split: CartSplitCondition;
    gain: number;
    leftIndices: number[];
    rightIndices: number[];
  } | null = null;

  for (const col of predictors) {
    if (col.type === 'numeric') {
      const pairs: { val: number; rowIdx: number; c: number }[] = [];
      const missingIndices: number[] = [];

      for (let i = 0; i < indices.length; i++) {
        const rIdx = indices[i];
        const raw = rows[rIdx][col.name];
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          pairs.push({ val: raw, rowIdx: rIdx, c: yIdx[rIdx] });
        } else {
          missingIndices.push(rIdx);
        }
      }

      if (pairs.length < minbucket * 2) continue;
      pairs.sort((a, b) => a.val - b.val);

      const leftCounts = new Array(numClasses).fill(0);
      const rightCounts = new Array(numClasses).fill(0);
      for (const p of pairs) rightCounts[p.c]++;

      const totalValid = pairs.length;
      const missingImp =
        missingIndices.length > 0
          ? parentImpurity * (totalValid / n)
          : parentImpurity;

      let bestThreshold: number | null = null;
      let bestSplitPos = -1;
      let bestColGain = 1e-12;

      for (let i = 0; i < totalValid - 1; i++) {
        leftCounts[pairs[i].c]++;
        rightCounts[pairs[i].c]--;

        if (pairs[i].val === pairs[i + 1].val) continue;
        const nLeft = i + 1;
        const nRight = totalValid - nLeft;
        if (nLeft < minbucket || nRight < minbucket) continue;

        const leftImp = nLeft * giniFromCounts(leftCounts, nLeft);
        const rightImp = nRight * giniFromCounts(rightCounts, nRight);
        const gain = missingImp - (leftImp + rightImp);

        if (gain > bestColGain) {
          bestColGain = gain;
          bestThreshold = (pairs[i].val + pairs[i + 1].val) / 2;
          bestSplitPos = i;
        }
      }

      if (bestThreshold !== null && bestColGain > bestGain) {
        const leftIndices = pairs.slice(0, bestSplitPos + 1).map((p) => p.rowIdx);
        const rightIndices = pairs.slice(bestSplitPos + 1).map((p) => p.rowIdx);
        // Enviar valores faltantes a la rama mayoritaria (estilo simplificado)
        if (missingIndices.length > 0) {
          if (leftIndices.length >= rightIndices.length) {
            leftIndices.push(...missingIndices);
          } else {
            rightIndices.push(...missingIndices);
          }
        }
        if (leftIndices.length >= minbucket && rightIndices.length >= minbucket) {
          bestGain = bestColGain;
          bestResult = {
            split: {
              variable: col.name,
              type: 'numeric',
              threshold: bestThreshold,
            },
            gain: bestColGain,
            leftIndices,
            rightIndices,
          };
        }
      }
    } else {
      // Variable categórica (factor)
      const catGroups = new Map<string, { indices: number[]; counts: number[] }>();
      const missingIndices: number[] = [];

      for (let i = 0; i < indices.length; i++) {
        const rIdx = indices[i];
        const raw = rows[rIdx][col.name];
        if (raw === null || raw === undefined || raw === '') {
          missingIndices.push(rIdx);
          continue;
        }
        const key = String(raw);
        if (!catGroups.has(key)) {
          catGroups.set(key, { indices: [], counts: new Array(numClasses).fill(0) });
        }
        const g = catGroups.get(key)!;
        g.indices.push(rIdx);
        g.counts[yIdx[rIdx]]++;
      }

      const categories = Array.from(catGroups.keys()).sort((a, b) => a.localeCompare(b, 'es'));
      const m = categories.length;
      if (m < 2) continue;

      const totalValid = n - missingIndices.length;
      const validCounts = new Array(numClasses).fill(0);
      for (const cat of categories) {
        const gc = catGroups.get(cat)!.counts;
        for (let c = 0; c < numClasses; c++) validCounts[c] += gc[c];
      }
      const validImp = totalValid * giniFromCounts(validCounts, totalValid);

      let bestLeftCats: string[] | null = null;
      let bestColGain = 1e-12;

      if (m <= 10) {
        // Búsqueda exacta de todos los subconjuntos binarios no vacíos (2^(m-1) - 1)
        const maxMask = 1 << (m - 1);
        for (let mask = 1; mask < maxMask; mask++) {
          let nLeft = 0;
          const leftCounts = new Array(numClasses).fill(0);
          const rightCounts = new Array(numClasses).fill(0);

          for (let j = 0; j < m; j++) {
            const g = catGroups.get(categories[j])!;
            if ((mask & (1 << j)) !== 0) {
              nLeft += g.indices.length;
              for (let c = 0; c < numClasses; c++) leftCounts[c] += g.counts[c];
            } else {
              for (let c = 0; c < numClasses; c++) rightCounts[c] += g.counts[c];
            }
          }

          const nRight = totalValid - nLeft;
          if (nLeft < minbucket || nRight < minbucket) continue;

          const impLeft = nLeft * giniFromCounts(leftCounts, nLeft);
          const impRight = nRight * giniFromCounts(rightCounts, nRight);
          const gain = validImp - (impLeft + impRight);

          if (gain > bestColGain) {
            bestColGain = gain;
            bestLeftCats = categories.filter((_, j) => (mask & (1 << j)) !== 0);
          }
        }
      } else {
        // Para > 10 categorías: ordenar por proporción de la clase mayoritaria del nodo
        const majClass = argMax(validCounts);
        const sortedCats = [...categories].sort((a, b) => {
          const ga = catGroups.get(a)!;
          const gb = catGroups.get(b)!;
          const pa = ga.counts[majClass] / ga.indices.length;
          const pb = gb.counts[majClass] / gb.indices.length;
          return pb - pa;
        });

        let nLeft = 0;
        const leftCounts = new Array(numClasses).fill(0);
        const rightCounts = [...validCounts];

        for (let i = 0; i < sortedCats.length - 1; i++) {
          const g = catGroups.get(sortedCats[i])!;
          nLeft += g.indices.length;
          for (let c = 0; c < numClasses; c++) {
            leftCounts[c] += g.counts[c];
            rightCounts[c] -= g.counts[c];
          }
          const nRight = totalValid - nLeft;
          if (nLeft < minbucket || nRight < minbucket) continue;

          const gain =
            validImp -
            (nLeft * giniFromCounts(leftCounts, nLeft) +
              nRight * giniFromCounts(rightCounts, nRight));
          if (gain > bestColGain) {
            bestColGain = gain;
            bestLeftCats = sortedCats.slice(0, i + 1);
          }
        }
      }

      if (bestLeftCats && bestColGain > bestGain) {
        const leftSet = new Set(bestLeftCats);
        const rightCats = categories.filter((c) => !leftSet.has(c));
        const leftIndices: number[] = [];
        const rightIndices: number[] = [];

        for (const cat of categories) {
          const idxs = catGroups.get(cat)!.indices;
          if (leftSet.has(cat)) leftIndices.push(...idxs);
          else rightIndices.push(...idxs);
        }

        if (missingIndices.length > 0) {
          if (leftIndices.length >= rightIndices.length) leftIndices.push(...missingIndices);
          else rightIndices.push(...missingIndices);
        }

        if (leftIndices.length >= minbucket && rightIndices.length >= minbucket) {
          bestGain = bestColGain;
          bestResult = {
            split: {
              variable: col.name,
              type: 'factor',
              leftCategories: bestLeftCats,
              rightCategories: rightCats,
            },
            gain: bestColGain,
            leftIndices,
            rightIndices,
          };
        }
      }
    }
  }

  return bestResult;
}

function buildTreeRecursive(
  indices: number[],
  id: number,
  depth: number,
  rows: DataRow[],
  predictors: ColumnMeta[],
  yIdx: number[],
  numClasses: number,
  control: RpartControl
): InternalNode {
  const n = indices.length;
  const classCounts = countClasses(indices, yIdx, numClasses);
  const predictedClassIdx = argMax(classCounts);
  const gini = giniFromCounts(classCounts, n);
  const misclassified = n - classCounts[predictedClassIdx];

  const canSplit =
    gini > 1e-10 &&
    depth < control.maxdepth &&
    n >= control.minsplit &&
    n >= control.minbucket * 2;

  if (canSplit) {
    const splitRes = findBestSplit(
      indices,
      rows,
      predictors,
      yIdx,
      numClasses,
      control.minbucket
    );

    if (splitRes) {
      const left = buildTreeRecursive(
        splitRes.leftIndices,
        id * 2,
        depth + 1,
        rows,
        predictors,
        yIdx,
        numClasses,
        control
      );
      const right = buildTreeRecursive(
        splitRes.rightIndices,
        id * 2 + 1,
        depth + 1,
        rows,
        predictors,
        yIdx,
        numClasses,
        control
      );

      return {
        id,
        depth,
        isLeaf: false,
        indices,
        n,
        classCounts,
        predictedClassIdx,
        gini,
        misclassified,
        split: splitRes.split,
        impurityGain: splitRes.gain,
        left,
        right,
      };
    }
  }

  return {
    id,
    depth,
    isLeaf: true,
    indices,
    n,
    classCounts,
    predictedClassIdx,
    gini,
    misclassified,
    impurityGain: 0,
  };
}

function cloneTree(node: InternalNode): InternalNode {
  return {
    ...node,
    classCounts: [...node.classCounts],
    indices: [...node.indices],
    split: node.split
      ? {
          ...node.split,
          leftCategories: node.split.leftCategories ? [...node.split.leftCategories] : undefined,
          rightCategories: node.split.rightCategories ? [...node.split.rightCategories] : undefined,
        }
      : undefined,
    left: node.left ? cloneTree(node.left) : undefined,
    right: node.right ? cloneTree(node.right) : undefined,
  };
}

function subtreeStats(node: InternalNode): { leafCount: number; leafErrors: number } {
  if (node.isLeaf || !node.left || !node.right) {
    return { leafCount: 1, leafErrors: node.misclassified };
  }
  const l = subtreeStats(node.left);
  const r = subtreeStats(node.right);
  return {
    leafCount: l.leafCount + r.leafCount,
    leafErrors: l.leafErrors + r.leafErrors,
  };
}

function findWeakestLink(
  node: InternalNode,
  rootErrors: number
): { minCp: number; targetId: number } {
  if (node.isLeaf || !node.left || !node.right) {
    return { minCp: Infinity, targetId: -1 };
  }
  const stats = subtreeStats(node);
  const denom = Math.max(1, stats.leafCount - 1) * Math.max(1, rootErrors);
  const cpHere = Math.max(0, (node.misclassified - stats.leafErrors) / denom);

  const l = findWeakestLink(node.left, rootErrors);
  const r = findWeakestLink(node.right, rootErrors);

  let bestCp = cpHere;
  let bestId = node.id;

  if (l.minCp < bestCp) {
    bestCp = l.minCp;
    bestId = l.targetId;
  }
  if (r.minCp < bestCp) {
    bestCp = r.minCp;
    bestId = r.targetId;
  }
  return { minCp: bestCp, targetId: bestId };
}

function pruneNodeById(node: InternalNode, targetId: number): void {
  if (node.id === targetId) {
    node.isLeaf = true;
    node.left = undefined;
    node.right = undefined;
    node.split = undefined;
    node.impurityGain = 0;
    return;
  }
  if (node.left) pruneNodeById(node.left, targetId);
  if (node.right) pruneNodeById(node.right, targetId);
}

function pruneAtCp(tree: InternalNode, cp: number, rootErrors: number): InternalNode {
  const copy = cloneTree(tree);
  while (!copy.isLeaf) {
    const { minCp, targetId } = findWeakestLink(copy, rootErrors);
    if (minCp <= cp + 1e-12 && targetId !== -1) {
      pruneNodeById(copy, targetId);
    } else {
      break;
    }
  }
  return copy;
}

function generatePruneSequence(
  fullTree: InternalNode,
  rootErrors: number,
  minCpFloor: number
): { cp: number; nsplit: number; relError: number; tree: InternalNode }[] {
  const steps: {
    cpToCollapseNext: number;
    nsplit: number;
    relError: number;
    tree: InternalNode;
  }[] = [];

  let current = cloneTree(fullTree);
  const initialStats = subtreeStats(current);
  steps.push({
    cpToCollapseNext: minCpFloor,
    nsplit: initialStats.leafCount - 1,
    relError: initialStats.leafErrors / Math.max(1, rootErrors),
    tree: cloneTree(current),
  });

  while (!current.isLeaf) {
    const { minCp, targetId } = findWeakestLink(current, rootErrors);
    if (targetId === -1) break;

    let nextTree = cloneTree(current);
    while (!nextTree.isLeaf) {
      const check = findWeakestLink(nextTree, rootErrors);
      if (Math.abs(check.minCp - minCp) <= 1e-12 && check.targetId !== -1) {
        pruneNodeById(nextTree, check.targetId);
      } else {
        break;
      }
    }

    const st = subtreeStats(nextTree);
    steps.push({
      cpToCollapseNext: minCp,
      nsplit: st.leafCount - 1,
      relError: st.leafErrors / Math.max(1, rootErrors),
      tree: cloneTree(nextTree),
    });
    current = nextTree;
  }

  // Invertir para ordenar de menor nsplit (raíz) a mayor nsplit (árbol completo)
  const ordered = steps.reverse();
  return ordered.map((item) => ({
    cp: item.cpToCollapseNext,
    nsplit: item.nsplit,
    relError: item.relError,
    tree: item.tree,
  }));
}

function predictSingleInternal(node: InternalNode, row: DataRow): InternalNode {
  let curr = node;
  while (!curr.isLeaf && curr.split && curr.left && curr.right) {
    const raw = row[curr.split.variable];
    if (curr.split.type === 'numeric') {
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        curr = raw <= (curr.split.threshold ?? 0) ? curr.left : curr.right;
      } else {
        curr = curr.left.n >= curr.right.n ? curr.left : curr.right;
      }
    } else {
      if (raw !== null && raw !== undefined && raw !== '') {
        const str = String(raw);
        if (curr.split.leftCategories?.includes(str)) {
          curr = curr.left;
        } else if (curr.split.rightCategories?.includes(str)) {
          curr = curr.right;
        } else {
          curr = curr.left.n >= curr.right.n ? curr.left : curr.right;
        }
      } else {
        curr = curr.left.n >= curr.right.n ? curr.left : curr.right;
      }
    }
  }
  return curr;
}

function formatSplitConditionText(split: CartSplitCondition, goLeft: boolean): string {
  if (split.type === 'numeric') {
    const t = formatDec(split.threshold ?? 0, 2);
    return goLeft ? `${split.variable} ≤ ${t}` : `${split.variable} > ${t}`;
  }
  const cats = goLeft ? split.leftCategories || [] : split.rightCategories || [];
  return `${split.variable} = ${cats.join(' o ')}`;
}

function convertToPublicNode(
  node: InternalNode,
  classes: string[],
  totalTrain: number,
  rulePath: string[] = []
): CartNode {
  const classCounts: Record<string, number> = {};
  const classProbs: Record<string, number> = {};
  classes.forEach((cls, idx) => {
    const cnt = node.classCounts[idx] || 0;
    classCounts[cls] = cnt;
    classProbs[cls] = node.n > 0 ? cnt / node.n : 0;
  });

  const left =
    !node.isLeaf && node.left && node.split
      ? convertToPublicNode(node.left, classes, totalTrain, [
          ...rulePath,
          formatSplitConditionText(node.split, true),
        ])
      : undefined;

  const right =
    !node.isLeaf && node.right && node.split
      ? convertToPublicNode(node.right, classes, totalTrain, [
          ...rulePath,
          formatSplitConditionText(node.split, false),
        ])
      : undefined;

  return {
    id: node.id,
    depth: node.depth,
    isLeaf: node.isLeaf || !left || !right,
    n: node.n,
    pctOfTrain: totalTrain > 0 ? (node.n / totalTrain) * 100 : 0,
    classCounts,
    classProbs,
    predictedClass: classes[node.predictedClassIdx],
    gini: node.gini,
    misclassified: node.misclassified,
    split: node.isLeaf ? undefined : node.split,
    impurityGain: node.isLeaf ? 0 : node.impurityGain,
    left,
    right,
    rulePath,
  };
}

function collectLeaves(node: CartNode, out: CartNode[] = []): CartNode[] {
  if (node.isLeaf || !node.left || !node.right) {
    out.push(node);
    return out;
  }
  collectLeaves(node.left, out);
  collectLeaves(node.right, out);
  return out;
}

function collectImportance(
  node: CartNode,
  totals: Map<string, number>
): void {
  if (node.isLeaf || !node.split) return;
  totals.set(
    node.split.variable,
    (totals.get(node.split.variable) || 0) + (node.impurityGain || 0)
  );
  if (node.left) collectImportance(node.left, totals);
  if (node.right) collectImportance(node.right, totals);
}

function maxTreeDepth(node: CartNode): number {
  if (node.isLeaf || !node.left || !node.right) return node.depth;
  return Math.max(maxTreeDepth(node.left), maxTreeDepth(node.right));
}

function buildRulesFromTree(root: CartNode): CartRule[] {
  const leaves = collectLeaves(root);
  return leaves.map((leaf) => {
    const prob = leaf.classProbs[leaf.predictedClass] || 0;
    const condText =
      leaf.rulePath.length > 0 ? leaf.rulePath.join(' Y ') : 'Todos los casos';
    const pctStr = formatDec(prob * 100, 0);
    return {
      nodeId: leaf.id,
      predictedClass: leaf.predictedClass,
      probability: prob,
      n: leaf.n,
      pctOfTrain: leaf.pctOfTrain,
      conditions: leaf.rulePath,
      ruleText: `SI ${condText} ENTONCES ${leaf.predictedClass}, ${pctStr}% (n = ${leaf.n})`,
    };
  });
}

export function trainCartModel(
  allRows: DataRow[],
  trainIndices: number[],
  columns: ColumnMeta[],
  targetCol: string,
  control: RpartControl,
  seed: number,
  overrideCpToPrune?: number
): CartModel {
  const predictors = columns.filter((c) => c.name !== targetCol);

  // Filtrar filas válidas en entrenamiento
  const validTrainIndices = trainIndices.filter((idx) => {
    const v = allRows[idx]?.[targetCol];
    return v !== null && v !== undefined && v !== '';
  });

  const classSet = new Set<string>();
  for (const row of allRows) {
    const v = row[targetCol];
    if (v !== null && v !== undefined && v !== '') classSet.add(String(v));
  }
  const classes = Array.from(classSet).sort((a, b) => a.localeCompare(b, 'es'));
  const classToIdx = new Map<string, number>(classes.map((c, i) => [c, i]));

  const yIdx = allRows.map((r) => {
    const v = r[targetCol];
    return v !== null && v !== undefined && v !== '' ? classToIdx.get(String(v)) ?? 0 : 0;
  });

  // 1. Construir árbol completo hasta cp bajo (control.cp) para tabla de complejidad
  const growControl: RpartControl = {
    ...control,
    cp: Math.min(control.cp, 0.001),
  };

  const fullTreeRaw = buildTreeRecursive(
    validTrainIndices,
    1,
    0,
    allRows,
    predictors,
    yIdx,
    classes.length,
    growControl
  );

  const rootErrors = Math.max(1, fullTreeRaw.misclassified);
  // Podar primero por control.cp mínimo
  const fullTree = pruneAtCp(fullTreeRaw, control.cp, rootErrors);
  const seq = generatePruneSequence(fullTree, rootErrors, control.cp);

  // 2. Validación cruzada estratificada (xval pliegues)
  const kFolds = Math.max(2, Math.min(20, Math.round(control.xval)));
  const rng = createSeededRng(seed + 997);

  const byClassTrain = new Map<number, number[]>();
  for (const idx of validTrainIndices) {
    const c = yIdx[idx];
    if (!byClassTrain.has(c)) byClassTrain.set(c, []);
    byClassTrain.get(c)!.push(idx);
  }

  const folds: number[][] = Array.from({ length: kFolds }, () => []);
  for (const [, idxs] of byClassTrain.entries()) {
    const shuffled = rng.shuffle(idxs);
    shuffled.forEach((rowIdx, pos) => {
      folds[pos % kFolds].push(rowIdx);
    });
  }

  // Umbrales geométricos dentro del intervalo de cada subárbol T_k
  const evalCps = seq.map((row, idx) => {
    if (idx === 0) return 1.0; // T_0: nodo raíz sin divisiones
    if (idx === seq.length - 1) return control.cp; // T_M: árbol completo
    const upperCp = seq[idx - 1].cp;
    const lowerCp = row.cp;
    if (upperCp > 0 && lowerCp > 0) return Math.sqrt(upperCp * lowerCp);
    return (upperCp + lowerCp) / 2;
  });

  const cvErrorCounts = new Array(seq.length).fill(0);

  for (let f = 0; f < kFolds; f++) {
    const valSet = folds[f];
    const subTrain: number[] = [];
    for (let g = 0; g < kFolds; g++) {
      if (g !== f) subTrain.push(...folds[g]);
    }
    if (subTrain.length === 0 || valSet.length === 0) continue;

    const foldRawTree = buildTreeRecursive(
      subTrain,
      1,
      0,
      allRows,
      predictors,
      yIdx,
      classes.length,
      growControl
    );
    const foldRootErr = Math.max(1, foldRawTree.misclassified);

    for (let k = 0; k < evalCps.length; k++) {
      const prunedFold = pruneAtCp(foldRawTree, evalCps[k], foldRootErr);
      let errs = 0;
      for (const rIdx of valSet) {
        const leaf = predictSingleInternal(prunedFold, allRows[rIdx]);
        if (leaf.predictedClassIdx !== yIdx[rIdx]) errs++;
      }
      cvErrorCounts[k] += errs;
    }
  }

  const nTrain = validTrainIndices.length;
  const cpTable: CpRow[] = seq.map((item, k) => {
    const totalErrs = cvErrorCounts[k];
    const xerror = totalErrs / rootErrors;
    const pErr = nTrain > 0 ? totalErrs / nTrain : 0;
    const xstd = Math.sqrt(nTrain * pErr * (1 - pErr)) / rootErrors;
    return {
      cp: item.cp,
      nsplit: item.nsplit,
      relError: item.relError,
      xerror,
      xstd,
    };
  });

  // Encontrar CP óptimo (menor xerror) y regla 1-SE
  let minIdx = 0;
  for (let k = 1; k < cpTable.length; k++) {
    if (cpTable[k].xerror < cpTable[minIdx].xerror) {
      minIdx = k;
    }
  }
  const optimalCpMinXerror = cpTable[minIdx]?.cp ?? control.cp;
  const oneSeThreshold = (cpTable[minIdx]?.xerror ?? 1) + (cpTable[minIdx]?.xstd ?? 0);

  let oneSeIdx = minIdx;
  for (let k = 0; k < cpTable.length; k++) {
    if (cpTable[k].xerror <= oneSeThreshold + 1e-9) {
      oneSeIdx = k;
      break; // El más simple (menor nsplit / mayor cp)
    }
  }
  const optimalCpOneSe = cpTable[oneSeIdx]?.cp ?? optimalCpMinXerror;

  const appliedCp =
    overrideCpToPrune !== undefined ? overrideCpToPrune : control.cp;
  const finalInternalTree = pruneAtCp(fullTreeRaw, appliedCp, rootErrors);

  const root = convertToPublicNode(finalInternalTree, classes, nTrain);
  const leaves = collectLeaves(root);
  const trainErrors = leaves.reduce((acc, l) => acc + l.misclassified, 0);
  const trainAccuracy = nTrain > 0 ? (nTrain - trainErrors) / nTrain : 0;

  const impMap = new Map<string, number>();
  predictors.forEach((p) => impMap.set(p.name, 0));
  collectImportance(root, impMap);
  const totalImp = Array.from(impMap.values()).reduce((a, b) => a + b, 0);

  const importance: VariableImportanceItem[] = Array.from(impMap.entries())
    .map(([variable, rawImportance]) => ({
      variable,
      rawImportance,
      pctImportance: totalImp > 0 ? (rawImportance / totalImp) * 100 : 0,
    }))
    .sort((a, b) => b.pctImportance - a.pctImportance);

  return {
    root,
    classes,
    cpTable,
    optimalCpMinXerror,
    optimalCpOneSe,
    appliedCp,
    control,
    leafCount: leaves.length,
    maxDepthReached: maxTreeDepth(root),
    trainAccuracy,
    rules: buildRulesFromTree(root),
    importance,
    rootErrorRate: nTrain > 0 ? rootErrors / nTrain : 0,
  };
}

export function predictWithCartNode(root: CartNode, row: DataRow): CartNode {
  let curr = root;
  while (!curr.isLeaf && curr.split && curr.left && curr.right) {
    const raw = row[curr.split.variable];
    if (curr.split.type === 'numeric') {
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        curr = raw <= (curr.split.threshold ?? 0) ? curr.left : curr.right;
      } else {
        curr = curr.left.n >= curr.right.n ? curr.left : curr.right;
      }
    } else {
      if (raw !== null && raw !== undefined && raw !== '') {
        const str = String(raw);
        if (curr.split.leftCategories?.includes(str)) {
          curr = curr.left;
        } else if (curr.split.rightCategories?.includes(str)) {
          curr = curr.right;
        } else {
          curr = curr.left.n >= curr.right.n ? curr.left : curr.right;
        }
      } else {
        curr = curr.left.n >= curr.right.n ? curr.left : curr.right;
      }
    }
  }
  return curr;
}

export function evaluateCartModel(
  model: CartModel,
  allRows: DataRow[],
  testIndices: number[],
  targetCol: string
): EvaluationResult {
  const classes = model.classes;
  const k = classes.length;
  const classToIdx = new Map<string, number>(classes.map((c, i) => [c, i]));
  const matrix: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const predictions: EvaluationResult['predictions'] = [];

  for (const rowIndex of testIndices) {
    const row = allRows[rowIndex];
    const actualRaw = row?.[targetCol];
    if (actualRaw === null || actualRaw === undefined || actualRaw === '') continue;
    const actual = String(actualRaw);
    const actualIdx = classToIdx.get(actual);
    if (actualIdx === undefined) continue;

    const leaf = predictWithCartNode(model.root, row);
    const predicted = leaf.predictedClass;
    const predIdx = classToIdx.get(predicted) ?? 0;

    matrix[actualIdx][predIdx]++;
    predictions.push({
      rowIndex,
      actual,
      predicted,
      correct: actual === predicted,
      leafId: leaf.id,
      probability: leaf.classProbs[predicted] ?? 0,
    });
  }

  const total = predictions.length;
  const correctTotal = predictions.filter((p) => p.correct).length;
  const accuracy = total > 0 ? correctTotal / total : 0;
  const errorRate = 1 - accuracy;

  // No Information Rate (proporción de la clase real más frecuente en prueba)
  const actualTotals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const predTotals = classes.map((_, colIdx) =>
    matrix.reduce((sum, row) => sum + row[colIdx], 0)
  );
  const maxActual = Math.max(0, ...actualTotals);
  const noInfoRate = total > 0 ? maxActual / total : 0;

  // Kappa de Cohen
  let pe = 0;
  if (total > 0) {
    for (let i = 0; i < k; i++) {
      pe += (actualTotals[i] / total) * (predTotals[i] / total);
    }
  }
  const kappa = pe < 1 ? (accuracy - pe) / (1 - pe) : 0;

  const perClass: ClassMetrics[] = classes.map((cls, i) => {
    const tp = matrix[i][i];
    const fn = actualTotals[i] - tp;
    const fp = predTotals[i] - tp;
    const tn = total - tp - fn - fp;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      cls,
      tp,
      fp,
      fn,
      tn,
      precision,
      recall,
      specificity,
      f1,
      support: actualTotals[i],
    };
  });

  const macroF1 =
    perClass.length > 0
      ? perClass.reduce((acc, m) => acc + m.f1, 0) / perClass.length
      : 0;

  const lowF1Classes = perClass.filter((c) => c.support > 0 && c.f1 < 0.55);

  return {
    accuracy,
    errorRate,
    noInfoRate,
    kappa,
    macroF1,
    trainAccuracy: model.trainAccuracy,
    matrix,
    classes,
    perClass,
    predictions,
    lowF1Classes,
  };
}
