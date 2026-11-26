import React, { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { CartNode } from '../types';
import { formatDec, formatInt, getClassColor } from '../utils/formatters';

interface TreeDiagramProps {
  root: CartNode;
  classes: string[];
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

interface PositionedNode {
  node: CartNode;
  x: number;
  y: number;
  width: number;
  height: number;
  parentX?: number;
  parentY?: number;
  edgeLabel?: string;
}

const NODE_W = 196;
const NODE_H_INTERNAL = 104;
const NODE_H_LEAF = 132;
const H_GAP = 26;
const V_GAP = 72;

function countLeavesSubtree(node: CartNode): number {
  if (node.isLeaf || !node.left || !node.right) return 1;
  return countLeavesSubtree(node.left) + countLeavesSubtree(node.right);
}

function getTreeDepth(node: CartNode): number {
  if (node.isLeaf || !node.left || !node.right) return 0;
  return 1 + Math.max(getTreeDepth(node.left), getTreeDepth(node.right));
}

function formatEdgeLabel(node: CartNode, isLeft: boolean): string {
  if (!node.split) return '';
  if (node.split.type === 'numeric') {
    const t = formatDec(node.split.threshold ?? 0, 1);
    return isLeft ? `≤ ${t}` : `> ${t}`;
  }
  const cats = isLeft ? node.split.leftCategories || [] : node.split.rightCategories || [];
  const joined = cats.join(', ');
  return joined.length > 26 ? `${joined.slice(0, 24)}…` : joined;
}

export const TreeDiagram: React.FC<TreeDiagramProps> = ({ root, classes, svgRef }) => {
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<CartNode | null>(null);

  const classIndexMap = useMemo(
    () => new Map<string, number>(classes.map((c, idx) => [c, idx])),
    [classes]
  );

  const layout = useMemo(() => {
    const totalLeaves = countLeavesSubtree(root);
    const maxDepth = getTreeDepth(root);
    const slotW = NODE_W + H_GAP;
    const width = Math.max(680, totalLeaves * slotW + 60);
    const height = Math.max(280, (maxDepth + 1) * (NODE_H_LEAF + V_GAP) + 40);

    const items: PositionedNode[] = [];
    let leafCursor = 0;

    function assignCoords(
      node: CartNode,
      depth: number,
      parentCenterX?: number,
      parentBottomY?: number,
      edgeLabel?: string
    ): number {
      const y = 32 + depth * (NODE_H_LEAF + V_GAP);
      const h = node.isLeaf ? NODE_H_LEAF : NODE_H_INTERNAL;

      let centerX: number;
      if (node.isLeaf || !node.left || !node.right) {
        centerX = 30 + leafCursor * slotW + NODE_W / 2;
        leafCursor++;
      } else {
        const leftX = assignCoords(
          node.left,
          depth + 1,
          undefined,
          undefined,
          formatEdgeLabel(node, true)
        );
        const rightX = assignCoords(
          node.right,
          depth + 1,
          undefined,
          undefined,
          formatEdgeLabel(node, false)
        );
        centerX = (leftX + rightX) / 2;

        // Actualizar coordenadas del padre en los hijos recién agregados
        const leftItem = items.find((it) => it.node.id === node.left!.id);
        const rightItem = items.find((it) => it.node.id === node.right!.id);
        if (leftItem) {
          leftItem.parentX = centerX;
          leftItem.parentY = y + h;
        }
        if (rightItem) {
          rightItem.parentX = centerX;
          rightItem.parentY = y + h;
        }
      }

      items.push({
        node,
        x: centerX - NODE_W / 2,
        y,
        width: NODE_W,
        height: h,
        parentX: parentCenterX,
        parentY: parentBottomY,
        edgeLabel,
      });

      return centerX;
    }

    assignCoords(root, 0);
    return { items, width, height };
  }, [root]);

  const activeNode = selectedNode || root;

  return (
    <div className="space-y-4">
      {/* Barra superior del diagrama */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Clases:</span>
          {classes.map((cls, idx) => {
            const c = getClassColor(idx);
            return (
              <span key={cls} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: c.bg }}
                />
                <span>{cls}</span>
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.55, +(z - 0.15).toFixed(2)))}
            className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
            title="Alejar diagrama"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-12 text-center font-mono text-xs tabular-nums text-slate-600">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.45, +(z + 0.15).toFixed(2)))}
            className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
            title="Acercar diagrama"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
            title="Restablecer zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Lienzo SVG desplazable */}
      <div className="-mt-4 overflow-x-auto rounded-b-xl border border-slate-200 bg-white p-4">
        <div
          style={{
            width: layout.width * zoom,
            height: layout.height * zoom,
            minWidth: '100%',
          }}
        >
          <svg
            ref={svgRef}
            width={layout.width * zoom}
            height={layout.height * zoom}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto block select-none"
          >
            {/* Conectores */}
            {layout.items.map((item) => {
              if (item.parentX === undefined || item.parentY === undefined) return null;
              const childTopX = item.x + item.width / 2;
              const childTopY = item.y;
              const midY = (item.parentY + childTopY) / 2;
              const pathD = `M ${item.parentX} ${item.parentY} C ${item.parentX} ${midY}, ${childTopX} ${midY}, ${childTopX} ${childTopY}`;
              const labelX = (item.parentX + childTopX) / 2;
              const labelY = midY;

              return (
                <g key={`edge-${item.node.id}`}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth={1.75}
                  />
                  {item.edgeLabel && (
                    <g>
                      <rect
                        x={labelX - Math.min(72, item.edgeLabel.length * 3.4 + 10)}
                        y={labelY - 10}
                        width={Math.min(144, item.edgeLabel.length * 6.8 + 20)}
                        height={20}
                        rx={4}
                        fill="#F8FAFC"
                        stroke="#CBD5E1"
                        strokeWidth={1}
                      />
                      <text
                        x={labelX}
                        y={labelY + 3.5}
                        textAnchor="middle"
                        fontSize={10.5}
                        fontFamily="DM Sans, sans-serif"
                        fontWeight={600}
                        fill="#334155"
                      >
                        {item.edgeLabel}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Nodos */}
            {layout.items.map((item) => {
              const { node, x, y, width, height } = item;
              const cIdx = classIndexMap.get(node.predictedClass) ?? 0;
              const color = getClassColor(cIdx);
              const isSelected = activeNode.id === node.id;
              const topProbs = classes
                .map((cls) => ({
                  cls,
                  pct: Math.round((node.classProbs[cls] || 0) * 100),
                }))
                .slice(0, 4);

              const fillBg = node.isLeaf ? color.light : '#FFFFFF';
              const strokeColor = isSelected ? '#0F172A' : node.isLeaf ? color.bg : '#CBD5E1';

              return (
                <g
                  key={`node-${node.id}`}
                  onClick={() => setSelectedNode(node)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx={8}
                    fill={fillBg}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 2.5 : node.isLeaf ? 1.8 : 1.3}
                  />

                  {/* Franja superior de clase */}
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={22}
                    rx={8}
                    fill={color.bg}
                  />
                  <rect
                    x={x}
                    y={y + 12}
                    width={width}
                    height={10}
                    fill={color.bg}
                  />

                  {/* Número de nodo y clase predicha */}
                  <text
                    x={x + 8}
                    y={y + 15}
                    fontSize={10.5}
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={600}
                    fill="#FFFFFF"
                  >
                    #{node.id}
                  </text>
                  <text
                    x={x + width - 8}
                    y={y + 15}
                    textAnchor="end"
                    fontSize={10.5}
                    fontFamily="Plus Jakarta Sans, sans-serif"
                    fontWeight={700}
                    fill="#FFFFFF"
                  >
                    {node.predictedClass.length > 18
                      ? `${node.predictedClass.slice(0, 16)}…`
                      : node.predictedClass}
                  </text>

                  {/* Contenido del nodo */}
                  {node.isLeaf ? (
                    <>
                      <text
                        x={x + width / 2}
                        y={y + 40}
                        textAnchor="middle"
                        fontSize={11}
                        fontFamily="DM Sans, sans-serif"
                        fontWeight={700}
                        fill="#0F172A"
                      >
                        HOJA · n = {formatInt(node.n)} ({formatDec(node.pctOfTrain, 1)}%)
                      </text>
                      {/* Porcentajes por clase (estilo extra = 104 en rpart.plot) */}
                      <text
                        x={x + width / 2}
                        y={y + 58}
                        textAnchor="middle"
                        fontSize={10}
                        fontFamily="JetBrains Mono, monospace"
                        fill="#334155"
                      >
                        {topProbs.map((p) => `${p.pct}%`).join(' / ')}
                      </text>
                      <text
                        x={x + width / 2}
                        y={y + 74}
                        textAnchor="middle"
                        fontSize={9.5}
                        fontFamily="DM Sans, sans-serif"
                        fill="#475569"
                      >
                        {topProbs
                          .map((p) => `${p.cls.slice(0, 7)}`)
                          .join(' · ')}
                      </text>
                      {/* Barra proporcional */}
                      <g transform={`translate(${x + 14}, ${y + 84})`}>
                        {(() => {
                          let offset = 0;
                          const barW = width - 28;
                          return classes.map((cls, ci) => {
                            const w = Math.max(0, (node.classProbs[cls] || 0) * barW);
                            const el = (
                              <rect
                                key={cls}
                                x={offset}
                                y={0}
                                width={w}
                                height={7}
                                fill={getClassColor(ci).bg}
                              />
                            );
                            offset += w;
                            return el;
                          });
                        })()}
                      </g>
                      <text
                        x={x + width / 2}
                        y={y + 114}
                        textAnchor="middle"
                        fontSize={10}
                        fontFamily="JetBrains Mono, monospace"
                        fill="#475569"
                      >
                        Gini: {formatDec(node.gini, 3)}
                      </text>
                    </>
                  ) : (
                    <>
                      <text
                        x={x + width / 2}
                        y={y + 42}
                        textAnchor="middle"
                        fontSize={11.5}
                        fontFamily="Plus Jakarta Sans, sans-serif"
                        fontWeight={700}
                        fill="#0F172A"
                      >
                        ¿{node.split?.variable}?
                      </text>
                      <text
                        x={x + width / 2}
                        y={y + 60}
                        textAnchor="middle"
                        fontSize={10.5}
                        fontFamily="JetBrains Mono, monospace"
                        fill="#334155"
                      >
                        n = {formatInt(node.n)} ({formatDec(node.pctOfTrain, 1)}%)
                      </text>
                      <text
                        x={x + width / 2}
                        y={y + 78}
                        textAnchor="middle"
                        fontSize={10}
                        fontFamily="JetBrains Mono, monospace"
                        fill="#475569"
                      >
                        {topProbs.map((p) => `${p.pct}%`).join(' / ')}
                      </text>
                      <text
                        x={x + width / 2}
                        y={y + 94}
                        textAnchor="middle"
                        fontSize={9.5}
                        fontFamily="JetBrains Mono, monospace"
                        fill="#64748B"
                      >
                        Gini: {formatDec(node.gini, 3)} · Prof: {node.depth}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Inspector del nodo seleccionado */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold text-slate-900">
            Detalle del nodo #{activeNode.id} ({activeNode.isLeaf ? 'Hoja terminal' : activeNode.depth === 0 ? 'Raíz del árbol' : 'Nodo interno'})
          </div>
          <div className="font-mono tabular-nums text-slate-600">
            n = {formatInt(activeNode.n)} · {formatDec(activeNode.pctOfTrain, 1)}% del entrenamiento · Índice Gini = {formatDec(activeNode.gini, 3)}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <strong>Clase mayoritaria:</strong> {activeNode.predictedClass}
          </span>
          <span>
            <strong>Distribución:</strong>{' '}
            {classes
              .map(
                (c) =>
                  `${c}: ${formatInt(activeNode.classCounts[c] || 0)} (${formatDec((activeNode.classProbs[c] || 0) * 100, 1)}%)`
              )
              .join(' · ')}
          </span>
        </div>
        {activeNode.rulePath.length > 0 && (
          <div className="mt-1 text-slate-600">
            <strong>Camino desde la raíz:</strong> {activeNode.rulePath.join(' Y ')}
          </div>
        )}
      </div>
    </div>
  );
};
