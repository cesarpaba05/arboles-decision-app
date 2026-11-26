import React from 'react';
import { NumericStats } from '../types';
import { formatDec } from '../utils/formatters';

interface BoxplotChartProps {
  stats: NumericStats;
}

export const BoxplotChart: React.FC<BoxplotChartProps> = ({ stats }) => {
  const width = 460;
  const height = 110;
  const padL = 28;
  const padR = 28;
  const plotW = width - padL - padR;

  const span = stats.max - stats.min || 1;
  const scaleX = (val: number) => padL + ((val - stats.min) / span) * plotW;

  const xWLow = scaleX(stats.whiskerLow);
  const xQ1 = scaleX(stats.q1);
  const xMed = scaleX(stats.median);
  const xQ3 = scaleX(stats.q3);
  const xWHigh = scaleX(stats.whiskerHigh);
  const xMean = scaleX(stats.mean);
  const decs = span < 10 ? 2 : 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full max-w-full overflow-visible"
      role="img"
      aria-label={`Diagrama de caja para ${stats.column}`}
    >
      {/* Eje base */}
      <line x1={padL} y1={82} x2={width - padR} y2={82} stroke="#CBD5E1" strokeWidth={1} />
      <text x={padL} y={98} textAnchor="middle" fontSize={10} fontFamily="JetBrains Mono, monospace" fill="#64748B">
        {formatDec(stats.min, decs)}
      </text>
      <text x={xMed} y={98} textAnchor="middle" fontSize={10} fontFamily="JetBrains Mono, monospace" fill="#0F172A" fontWeight={600}>
        Med: {formatDec(stats.median, decs)}
      </text>
      <text x={width - padR} y={98} textAnchor="middle" fontSize={10} fontFamily="JetBrains Mono, monospace" fill="#64748B">
        {formatDec(stats.max, decs)}
      </text>

      {/* Bigotes */}
      <line x1={xWLow} y1={44} x2={xQ1} y2={44} stroke="#475569" strokeWidth={1.6} />
      <line x1={xQ3} y1={44} x2={xWHigh} y2={44} stroke="#475569" strokeWidth={1.6} />
      <line x1={xWLow} y1={32} x2={xWLow} y2={56} stroke="#475569" strokeWidth={1.6} />
      <line x1={xWHigh} y1={32} x2={xWHigh} y2={56} stroke="#475569" strokeWidth={1.6} />

      {/* Caja Q1 - Q3 */}
      <rect
        x={xQ1}
        y={24}
        width={Math.max(2, xQ3 - xQ1)}
        height={40}
        rx={4}
        fill="#DBEAFE"
        stroke="#2563EB"
        strokeWidth={1.6}
      />

      {/* Línea de mediana */}
      <line x1={xMed} y1={24} x2={xMed} y2={64} stroke="#1E3A8A" strokeWidth={2.5} />

      {/* Rombo de media */}
      <polygon
        points={`${xMean},37 ${xMean + 6},44 ${xMean},51 ${xMean - 6},44`}
        fill="#D97706"
        stroke="#FFFFFF"
        strokeWidth={1}
      />

      {/* Valores atípicos */}
      {stats.outliers.slice(0, 25).map((outVal, idx) => (
        <circle
          key={idx}
          cx={scaleX(outVal)}
          cy={44}
          r={3}
          fill="#DC2626"
          opacity={0.75}
        />
      ))}

      {/* Etiqueta Q1 y Q3 arriba */}
      <text x={xQ1} y={15} textAnchor="middle" fontSize={9.5} fontFamily="JetBrains Mono, monospace" fill="#475569">
        Q1: {formatDec(stats.q1, decs)}
      </text>
      <text x={xQ3} y={15} textAnchor="middle" fontSize={9.5} fontFamily="JetBrains Mono, monospace" fill="#475569">
        Q3: {formatDec(stats.q3, decs)}
      </text>
    </svg>
  );
};
