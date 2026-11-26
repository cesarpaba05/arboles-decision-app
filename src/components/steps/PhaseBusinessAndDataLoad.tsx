import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { DatasetState, SyntheticSectorId } from '../../types';
import {
  DEFAULT_BUSINESS_QUESTION,
  DEFAULT_BUSINESS_SECTOR,
  RECOMMENDED_CASE_NAME,
} from '../../data/embeddedCereal';
import { SYNTHETIC_SECTORS } from '../../data/syntheticGenerator';
import { formatInt } from '../../utils/formatters';

interface Step1Props {
  businessQuestion: string;
  setBusinessQuestion: (v: string) => void;
  sector: string;
  setSector: (v: string) => void;
  dataset: DatasetState | null;
  onLoadRecommended: () => void;
  onClearDataset: () => void;
}

const SECTOR_OPTIONS = [
  'Alimentos y bebidas',
  'Telecomunicaciones',
  'Banca y servicios financieros',
  'Comercio y retail',
  'Salud y bienestar',
  'Educación superior',
  'Otro sector',
];

export const Step01BusinessContext: React.FC<Step1Props> = ({
  businessQuestion,
  setBusinessQuestion,
  sector,
  setSector,
  dataset,
  onLoadRecommended,
  onClearDataset,
}) => {
  const isCustomSector = !SECTOR_OPTIONS.slice(0, -1).includes(sector);

  return (
    <div className="space-y-6">
      {/* Caso inicial recomendado */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
              <span>Recomendado</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-500 font-normal">Base precargada lista para explorar</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {RECOMMENDED_CASE_NAME}
            </h2>
            <p className="text-sm text-slate-600">
              Contiene 880 consumidores con edad, género, estado civil, actividad laboral y tipo de desayuno elegido (Avena, Barrita de desayuno, Cereales).
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {dataset?.origin === 'embedded' ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Cargada actualmente</span>
                </span>
                <button
                  type="button"
                  onClick={onClearDataset}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  <span>Borrar base</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onLoadRecommended}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
              >
                <Database className="h-3.5 w-3.5" />
                <span>Cargar caso recomendado</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Formulario de contexto */}
      <div className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <label
            htmlFor="sector-select"
            className="block text-sm font-semibold text-slate-900"
          >
            Sector o industria del proyecto
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            El sector ayuda a redactar recomendaciones y ejemplos comerciales acordes a tu mercado.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <select
              id="sector-select"
              value={isCustomSector ? 'Otro sector' : sector}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'Otro sector') setSector('');
                else setSector(v);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              {SECTOR_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Escribe el sector si es específico..."
              aria-label="Nombre personalizado del sector"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="business-question"
              className="block text-sm font-semibold text-slate-900"
            >
              Pregunta de negocio que el árbol debe responder
            </label>
            <button
              type="button"
              onClick={() => {
                setSector(DEFAULT_BUSINESS_SECTOR);
                setBusinessQuestion(DEFAULT_BUSINESS_QUESTION);
              }}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
            >
              Usar ejemplo del taller
            </button>
          </div>
          <textarea
            id="business-question"
            rows={3}
            value={businessQuestion}
            onChange={(e) => setBusinessQuestion(e.target.value)}
            placeholder="Describe qué decisión comercial quieres tomar con los segmentos..."
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};

interface Step2Props {
  dataset: DatasetState | null;
  onUploadFile: (file: File) => Promise<void>;
  onReparseDelimited: (sep: ',' | ';' | '\t', dec: '.' | ',') => void;
  onLoadRecommended: () => void;
  onClearDataset: () => void;
  uploadError: string | null;
}

export const Step02LoadData: React.FC<Step2Props> = ({
  dataset,
  onUploadFile,
  onReparseDelimited,
  onLoadRecommended,
  onClearDataset,
  uploadError,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await onUploadFile(file);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const sepLabel = (sep?: string) => {
    if (sep === ';') return 'Punto y coma (;)';
    if (sep === '\t') return 'Tabulación (\\t)';
    return 'Coma (,)';
  };

  return (
    <div className="space-y-5">
      {/* Recordatorio copia de seguridad */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
        <strong>Buena práctica:</strong> Trabaja siempre sobre una copia de tu archivo original. Todo el procesamiento ocurre localmente en tu navegador y tus datos nunca salen de tu equipo.
      </div>

      {/* Zona de carga */}
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
          <Upload className="h-5 w-5" />
        </div>
        <h2 className="mt-3 text-base font-bold text-slate-900">
          Sube tu propio archivo de consumidores
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Formatos compatibles: CSV, TXT, XLSX o XLS. Detectamos automáticamente separador y decimales.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{loading ? 'Procesando archivo…' : 'Seleccionar archivo'}</span>
          </button>

          {dataset?.origin !== 'embedded' && (
            <button
              type="button"
              onClick={onLoadRecommended}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Database className="h-4 w-4 text-teal-700" />
              <span>Restaurar taller de cereales (880)</span>
            </button>
          )}

          {dataset && (
            <button
              type="button"
              onClick={onClearDataset}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 whitespace-nowrap"
            >
              <Trash2 className="h-4 w-4" />
              <span>Vaciar base actual</span>
            </button>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Estado actual de detección y ajuste */}
      {dataset ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="text-xs text-slate-500">
                Base activa · {dataset.origin === 'embedded' ? 'Incrustada (Recomendado)' : dataset.origin === 'synthetic' ? 'Simulada por sector' : 'Archivo cargado'}
              </div>
              <div className="text-base font-bold text-slate-900">{dataset.name}</div>
            </div>
            <div className="font-mono text-xs tabular-nums text-slate-600">
              {formatInt(dataset.rows.length)} filas · {formatInt(dataset.columns.length)} columnas
            </div>
          </div>

          {dataset.rawText ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Separador de columnas (detectado: {sepLabel(dataset.separator)})
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      { val: ',', label: 'Coma (,)' },
                      { val: ';', label: 'Punto y coma (;)' },
                      { val: '\t', label: 'Tabulación' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() =>
                        onReparseDelimited(opt.val, dataset.decimal || '.')
                      }
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        dataset.separator === opt.val
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Separador decimal (detectado: {dataset.decimal === ',' ? 'Coma (,)' : 'Punto (.)'})
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      { val: '.', label: 'Punto decimal (12.5)' },
                      { val: ',', label: 'Coma decimal (12,5)' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() =>
                        onReparseDelimited(dataset.separator || ',', opt.val)
                      }
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        dataset.decimal === opt.val
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-600">
              {dataset.origin === 'synthetic'
                ? 'Base generada directamente en memoria con variables listas para analizar.'
                : 'Archivo Excel leído directamente por hojas sin ambigüedad de separador.'}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
          No hay ninguna base cargada en este momento. Sube un archivo, genera data sintética en el Paso 3 o restaura el taller de cereales.
        </div>
      )}
    </div>
  );
};

interface Step3Props {
  dataset: DatasetState | null;
  onGenerateSynthetic: (sectorId: SyntheticSectorId, count: number, seed: number) => void;
}

export const Step03SyntheticData: React.FC<Step3Props> = ({
  dataset,
  onGenerateSynthetic,
}) => {
  const [selectedSector, setSelectedSector] = useState<SyntheticSectorId>('telecom');
  const [rowCount, setRowCount] = useState<number>(800);
  const [seed, setSeed] = useState<number>(2026);

  const chosen = SYNTHETIC_SECTORS.find((s) => s.id === selectedSector) || SYNTHETIC_SECTORS[0];

  return (
    <div className="space-y-5">
      {dataset?.isSimulated && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <strong>Datos simulados activos:</strong> Actualmente estás trabajando con la base sintética{' '}
          <span className="font-semibold">{dataset.name}</span> ({formatInt(dataset.rows.length)} registros simulados).
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900">
          Elige un sector para simular entre 500 y 1.000 consumidores
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Si aún no tienes un archivo real o deseas probar el modelo con variables numéricas y categóricas, genera una base coherente con patrones reales del sector.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SYNTHETIC_SECTORS.map((sec) => {
            const active = sec.id === selectedSector;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedSector(sec.id)}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50/60'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="text-sm font-bold text-slate-900">{sec.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {sec.summary}
                </p>
              </button>
            );
          })}
        </div>

        {/* Parámetros de simulación */}
        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <label htmlFor="synth-rows">Cantidad de registros simulados</label>
              <span className="font-mono tabular-nums text-slate-900">
                {formatInt(rowCount)} filas
              </span>
            </div>
            <input
              id="synth-rows"
              type="range"
              min={500}
              max={1000}
              step={50}
              value={rowCount}
              onChange={(e) => setRowCount(Number(e.target.value))}
              className="mt-2 w-full accent-blue-600"
            />
            <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-400">
              <span>500</span>
              <span>750</span>
              <span>1.000</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="synth-seed"
              className="block text-xs font-semibold text-slate-700"
            >
              Semilla de generación (para repetir los mismos datos)
            </label>
            <input
              id="synth-seed"
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 123)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-lg bg-slate-50 p-3.5 text-xs text-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <strong>Variables que se generarán:</strong>{' '}
            <span className="font-mono">{chosen.variablesPreview.join(', ')}</span>
          </div>
          <button
            type="button"
            onClick={() => onGenerateSynthetic(selectedSector, rowCount, seed)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generar base simulada ({formatInt(rowCount)})</span>
          </button>
        </div>
      </div>

      {dataset && !dataset.isSimulated && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>
            Actualmente conservas tu base activa ({dataset.name}). Si no necesitas simular, puedes continuar directamente al Paso 4.
          </span>
        </div>
      )}
    </div>
  );
};

interface Step4Props {
  dataset: DatasetState | null;
}

export const Step04Preview: React.FC<Step4Props> = ({ dataset }) => {
  const [showAllSample, setShowAllSample] = useState(false);

  if (!dataset || dataset.rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        No hay datos cargados para previsualizar. Regresa al Paso 2 o al Paso 3 para cargar o simular una base.
      </div>
    );
  }

  const previewRows = showAllSample ? dataset.rows.slice(0, 20) : dataset.rows.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Resumen dimensional */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Total consumidores (filas)</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatInt(dataset.rows.length)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Variables (columnas)</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatInt(dataset.columns.length)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Origen de datos</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {dataset.isSimulated
              ? 'Datos simulados'
              : dataset.origin === 'embedded'
                ? 'Taller incrustado'
                : 'Archivo del usuario'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Valores faltantes (NA)</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatInt(dataset.columns.reduce((acc, c) => acc + c.missingCount, 0))}
          </div>
        </div>
      </div>

      {/* Tabla head(base, 5) */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Vista previa: primeros {showAllSample ? Math.min(20, dataset.rows.length) : Math.min(5, dataset.rows.length)} registros (head)
            </h2>
            <p className="text-xs text-slate-500">
              Verifica que cada fila corresponda a un caso y que los nombres de columnas estén claros.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAllSample((v) => !v)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
          >
            {showAllSample ? 'Mostrar solo 5 (head)' : 'Ver primeros 20'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700">
                <th className="px-3 py-2.5 font-mono font-semibold text-slate-400">#</th>
                {dataset.columns.map((col) => (
                  <th key={col.name} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {previewRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2 font-mono tabular-nums text-slate-400">
                    {idx + 1}
                  </td>
                  {dataset.columns.map((col) => {
                    const val = row[col.name];
                    const isNum = typeof val === 'number';
                    return (
                      <td
                        key={col.name}
                        className={`px-3 py-2 whitespace-nowrap ${
                          isNum ? 'font-mono tabular-nums text-slate-900' : 'text-slate-700'
                        }`}
                      >
                        {val === null || val === undefined || val === '' ? (
                          <span className="italic text-slate-400">NA</span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
