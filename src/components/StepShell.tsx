import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Code2, Copy, HelpCircle, Lightbulb } from 'lucide-react';
import { StepDefinition } from '../types';

interface StepShellProps {
  step: StepDefinition;
  keyFinding: string;
  rCode: string;
  children: React.ReactNode;
}

export const StepShell: React.FC<StepShellProps> = ({
  step,
  keyFinding,
  rCode,
  children,
}) => {
  const [showHelp, setShowHelp] = useState(false);
  const [showRCode, setShowRCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyR = () => {
    navigator.clipboard.writeText(rCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="space-y-6">
      {/* Encabezado del paso */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>CRISP-DM</span>
            <span aria-hidden="true">·</span>
            <span>{step.phase}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Paso {step.number} de 14</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">
            {step.title}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setShowHelp((prev) => !prev)}
          aria-expanded={showHelp}
          className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            showHelp
              ? 'border-blue-300 bg-blue-50 text-blue-800'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <HelpCircle className="h-4 w-4 text-blue-600" />
          <span>¿Qué significa?</span>
        </button>
      </div>

      {/* Panel explicativo "¿Qué significa?" */}
      {showHelp && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-slate-800">
          <div className="font-display font-semibold text-blue-950">
            {step.whatItMeansTitle}
          </div>
          <p className="mt-1.5 leading-relaxed text-slate-700">
            {step.whatItMeansText}
          </p>
          <p className="mt-2 rounded-lg border border-blue-200/80 bg-white/80 px-3 py-2 text-xs leading-relaxed text-slate-700">
            <strong className="font-semibold text-blue-900">Ejemplo práctico: </strong>
            {step.whatItMeansExample}
          </p>
        </div>
      )}

      {/* Contenido principal del paso */}
      <div>{children}</div>

      {/* Recuadro "Hallazgo clave" en lenguaje de negocio */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-emerald-950">
              Hallazgo clave para el negocio
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-emerald-950/85">
              {keyFinding}
            </p>
          </div>
        </div>
      </div>

      {/* Recuadro plegable "Código R equivalente" */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setShowRCode((prev) => !prev)}
            aria-expanded={showRCode}
            className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-slate-800 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {showRCode ? (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-500" />
            )}
            <Code2 className="h-4 w-4 text-slate-600" />
            <span>Código R equivalente</span>
          </button>

          {showRCode && (
            <button
              type="button"
              onClick={handleCopyR}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span>Copiar código</span>
                </>
              )}
            </button>
          )}
        </div>

        {showRCode && (
          <div className="border-t border-slate-200 bg-slate-950 p-4">
            <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-slate-100">
              <code>{rCode}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
