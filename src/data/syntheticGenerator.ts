import { ColumnMeta, DataRow, SyntheticSectorId } from '../types';
import { createSeededRng } from '../utils/prng';
import { inferColumns } from '../engine/parser';

export interface SyntheticSectorOption {
  id: SyntheticSectorId;
  label: string;
  sectorName: string;
  businessQuestion: string;
  targetName: string;
  summary: string;
  variablesPreview: string[];
}

export const SYNTHETIC_SECTORS: SyntheticSectorOption[] = [
  {
    id: 'telecom',
    label: 'Telecomunicaciones – abandono de clientes',
    sectorName: 'Telecomunicaciones',
    businessQuestion:
      'Una empresa de telefonía e internet quiere identificar qué perfiles de clientes tienen mayor riesgo de cancelar su plan (abandono) para activar campañas de retención.',
    targetName: 'abandono',
    summary: 'Simula antigüedad, factura mensual, reclamos recientes, tipo de plan y permanencia.',
    variablesPreview: ['antiguedad_meses', 'factura_mensual', 'reclamos_6m', 'tipo_plan', 'contrato', 'genero', 'abandono'],
  },
  {
    id: 'banca',
    label: 'Banca – aprobación de crédito',
    sectorName: 'Banca y servicios financieros',
    businessQuestion:
      'Una entidad financiera busca entender qué factores determinan la aprobación de créditos de consumo para agilizar el análisis comercial y orientar ofertas.',
    targetName: 'aprobacion',
    summary: 'Simula ingresos, puntaje crediticio, endeudamiento, historial de mora y tipo de empleo.',
    variablesPreview: ['ingreso_millones', 'puntaje_credito', 'cuota_ingreso_pct', 'tipo_empleo', 'mora_previa', 'ciudad', 'aprobacion'],
  },
  {
    id: 'retail',
    label: 'Retail – canal de compra preferido',
    sectorName: 'Comercio y retail',
    businessQuestion:
      'Una cadena de tiendas desea predecir si un cliente prefiere comprar en Tienda física, App móvil o Web para asignar presupuesto publicitario por canal.',
    targetName: 'canal_preferido',
    summary: 'Simula edad, ticket promedio, frecuencia mensual, nivel de membresía y categoría.',
    variablesPreview: ['edad', 'ticket_promedio_mil', 'compras_mes', 'membresia', 'categoria_fav', 'genero', 'canal_preferido'],
  },
  {
    id: 'salud',
    label: 'Salud – adherencia a tratamiento',
    sectorName: 'Salud y bienestar',
    businessQuestion:
      'Una institución de salud quiere identificar qué pacientes tienen mayor riesgo de abandonar su tratamiento crónico para reforzar el seguimiento clínico.',
    targetName: 'adherencia',
    summary: 'Simula edad, distancia al centro médico, recordatorios digitales, cobertura y copago.',
    variablesPreview: ['edad', 'distancia_km', 'recordatorios_sms', 'nivel_copago', 'acompanamiento', 'sexo', 'adherencia'],
  },
  {
    id: 'educacion',
    label: 'Educación – deserción estudiantil',
    sectorName: 'Educación superior',
    businessQuestion:
      'Una universidad busca detectar tempranamente qué estudiantes tienen riesgo de deserción en los primeros semestres para ofrecer tutorías y becas.',
    targetName: 'desercion',
    summary: 'Simula promedio académico, porcentaje de beca, horas laborales semanales y modalidad.',
    variablesPreview: ['promedio_notas', 'horas_trabajo_sem', 'beca', 'modalidad', 'tutoria_previa', 'jornada', 'desercion'],
  },
  {
    id: 'alimentos',
    label: 'Alimentos – tipo de desayuno',
    sectorName: 'Alimentos y bebidas',
    businessQuestion:
      'Una compañía de alimentos quiere descubrir qué tipo de desayuno prefieren distintos segmentos según su edad, ingreso disponible, hábitos deportivos y hogar.',
    targetName: 'desayuno',
    summary: 'Simula edad, gasto semanal en alimentos, actividad física, tamaño del hogar y horario.',
    variablesPreview: ['edad', 'gasto_semanal_mil', 'actividad_fisica', 'tamano_hogar', 'sale_temprano', 'genero', 'desayuno'],
  },
];

export function generateSyntheticDataset(
  sectorId: SyntheticSectorId,
  rowCount: number,
  seed: number
): { rows: DataRow[]; columns: ColumnMeta[]; sector: SyntheticSectorOption } {
  const n = Math.max(500, Math.min(1000, Math.round(rowCount)));
  const rng = createSeededRng(seed);
  const sector = SYNTHETIC_SECTORS.find((s) => s.id === sectorId) || SYNTHETIC_SECTORS[0];
  const rows: DataRow[] = [];

  for (let i = 0; i < n; i++) {
    if (sectorId === 'telecom') {
      const contrato = rng.pickWeighted(['Mensual', '1 año', '2 años'], [0.46, 0.32, 0.22]);
      const tipoPlan = rng.pickWeighted(['Básico', 'Estándar', 'Fibra + Móvil'], [0.32, 0.4, 0.28]);
      const antiguedad =
        contrato === 'Mensual'
          ? rng.int(1, 28)
          : contrato === '1 año'
            ? rng.int(8, 48)
            : rng.int(18, 72);
      const reclamos =
        contrato === 'Mensual' && rng.next() < 0.48
          ? rng.int(2, 6)
          : rng.int(0, 3);
      const baseFactura =
        tipoPlan === 'Básico' ? 58 : tipoPlan === 'Estándar' ? 96 : 152;
      const facturaMensual = Math.round((baseFactura + (rng.next() - 0.5) * 26) * 10) / 10;
      const genero = rng.next() < 0.5 ? 'Mujer' : 'Hombre';

      let churnProb = 0.12;
      if (contrato === 'Mensual') churnProb += 0.28;
      if (reclamos >= 3) churnProb += 0.36;
      if (antiguedad <= 10) churnProb += 0.16;
      if (facturaMensual > 135 && tipoPlan !== 'Fibra + Móvil') churnProb += 0.12;
      if (contrato === '2 años') churnProb -= 0.18;
      churnProb = Math.max(0.04, Math.min(0.92, churnProb));

      const abandono = rng.next() < churnProb ? 'Sí' : 'No';
      rows.push({
        antiguedad_meses: antiguedad,
        factura_mensual: facturaMensual,
        reclamos_6m: reclamos,
        tipo_plan: tipoPlan,
        contrato,
        genero,
        abandono,
      });
    } else if (sectorId === 'banca') {
      const tipoEmpleo = rng.pickWeighted(['Indefinido', 'Independiente', 'Temporal'], [0.5, 0.3, 0.2]);
      const moraPrevia = rng.next() < 0.22 ? 'Sí' : 'No';
      const ingreso =
        tipoEmpleo === 'Indefinido'
          ? Math.round((3.5 + rng.next() * 9.5) * 10) / 10
          : Math.round((2.1 + rng.next() * 7.5) * 10) / 10;
      const puntaje =
        moraPrevia === 'Sí' ? rng.int(410, 640) : rng.int(580, 860);
      const cuotaPct =
        moraPrevia === 'Sí' ? rng.int(28, 56) : rng.int(12, 46);
      const ciudad = rng.pickWeighted(['Bogotá', 'Medellín', 'Cali', 'Barranquilla'], [0.4, 0.25, 0.2, 0.15]);

      let score = 0;
      if (puntaje >= 680) score += 2.2;
      else if (puntaje < 560) score -= 2.4;
      if (cuotaPct <= 30) score += 1.2;
      else if (cuotaPct > 42) score -= 1.6;
      if (moraPrevia === 'Sí') score -= 1.8;
      if (ingreso >= 5.5) score += 0.8;
      if (tipoEmpleo === 'Temporal') score -= 0.7;

      const probAprobar = 1 / (1 + Math.exp(-score));
      const aprobacion = rng.next() < probAprobar ? 'Aprobado' : 'Rechazado';

      rows.push({
        ingreso_millones: ingreso,
        puntaje_credito: puntaje,
        cuota_ingreso_pct: cuotaPct,
        tipo_empleo: tipoEmpleo,
        mora_previa: moraPrevia,
        ciudad,
        aprobacion,
      });
    } else if (sectorId === 'retail') {
      const edad = rng.int(18, 68);
      const membresia = rng.pickWeighted(['Sin membresía', 'Estándar', 'Plus'], [0.42, 0.36, 0.22]);
      const categoriaFav = rng.pickWeighted(['Moda', 'Tecnología', 'Hogar', 'Mercado'], [0.28, 0.24, 0.24, 0.24]);
      const comprasMes = membresia === 'Plus' ? rng.int(4, 12) : rng.int(1, 6);
      const ticketMil = Math.round((categoriaFav === 'Tecnología' ? 240 : 85) + rng.next() * 140);
      const genero = rng.next() < 0.52 ? 'Mujer' : 'Hombre';

      let wTienda = 1.0;
      let wApp = 1.0;
      let wWeb = 1.0;
      if (edad <= 32) {
        wApp += 2.8;
        wWeb += 0.9;
      } else if (edad >= 50) {
        wTienda += 3.0;
      } else {
        wWeb += 1.6;
        wTienda += 1.0;
      }
      if (membresia === 'Plus') wApp += 1.8;
      if (categoriaFav === 'Tecnología') wWeb += 1.8;
      if (categoriaFav === 'Mercado') wTienda += 1.5;

      const canal = rng.pickWeighted(['Tienda física', 'App móvil', 'Web'], [wTienda, wApp, wWeb]);
      rows.push({
        edad,
        ticket_promedio_mil: ticketMil,
        compras_mes: comprasMes,
        membresia,
        categoria_fav: categoriaFav,
        genero,
        canal_preferido: canal,
      });
    } else if (sectorId === 'salud') {
      const edad = rng.int(24, 79);
      const recordatorios = rng.next() < 0.58 ? 'Sí' : 'No';
      const acompanamiento = rng.next() < 0.48 ? 'Familiar' : 'Solo';
      const nivelCopago = rng.pickWeighted(['Bajo', 'Medio', 'Alto'], [0.4, 0.38, 0.22]);
      const distanciaKm = Math.round((1 + rng.next() * 26) * 10) / 10;
      const sexo = rng.next() < 0.54 ? 'Femenino' : 'Masculino';

      let pAdh = 0.52;
      if (recordatorios === 'Sí') pAdh += 0.22;
      if (acompanamiento === 'Familiar') pAdh += 0.14;
      if (nivelCopago === 'Alto') pAdh -= 0.25;
      if (distanciaKm > 15) pAdh -= 0.18;
      if (edad >= 65 && acompanamiento === 'Solo') pAdh -= 0.12;
      pAdh = Math.max(0.08, Math.min(0.94, pAdh));

      const adherencia = rng.next() < pAdh ? 'Alta' : 'Baja';
      rows.push({
        edad,
        distancia_km: distanciaKm,
        recordatorios_sms: recordatorios,
        nivel_copago: nivelCopago,
        acompanamiento,
        sexo,
        adherencia,
      });
    } else if (sectorId === 'educacion') {
      const modalidad = rng.pickWeighted(['Presencial', 'Virtual', 'Híbrida'], [0.5, 0.28, 0.22]);
      const beca = rng.pickWeighted(['Sin beca', 'Parcial', 'Completa'], [0.55, 0.28, 0.17]);
      const tutoriaPrevia = rng.next() < 0.4 ? 'Sí' : 'No';
      const horasTrabajo = beca === 'Completa' ? rng.int(0, 16) : rng.int(0, 44);
      const promedio = Math.round((2.3 + rng.next() * 2.5 - (horasTrabajo > 28 ? 0.55 : 0)) * 100) / 100;
      const promedioClamped = Math.max(1.5, Math.min(5.0, promedio));
      const jornada = rng.next() < 0.55 ? 'Diurna' : 'Nocturna';

      let pDes = 0.15;
      if (promedioClamped < 3.2) pDes += 0.38;
      if (horasTrabajo >= 30) pDes += 0.26;
      if (beca === 'Sin beca') pDes += 0.12;
      if (modalidad === 'Virtual' && tutoriaPrevia === 'No') pDes += 0.14;
      if (beca === 'Completa') pDes -= 0.18;
      pDes = Math.max(0.04, Math.min(0.9, pDes));

      const desercion = rng.next() < pDes ? 'Sí' : 'No';
      rows.push({
        promedio_notas: promedioClamped,
        horas_trabajo_sem: horasTrabajo,
        beca,
        modalidad,
        tutoria_previa: tutoriaPrevia,
        jornada,
        desercion,
      });
    } else {
      // Alimentos - tipo de desayuno (con variables numéricas y categóricas)
      const edad = rng.int(18, 74);
      const actividadFisica = rng.pickWeighted(['Alta', 'Media', 'Baja'], [0.32, 0.38, 0.3]);
      const saleTemprano = rng.next() < 0.54 ? 'Sí' : 'No';
      const tamanoHogar = rng.int(1, 5);
      const gastoMil = Math.round(45 + tamanoHogar * 24 + rng.next() * 75);
      const genero = rng.next() < 0.5 ? 'Mujer' : 'Hombre';

      let wAvena = 1.0;
      let wBarrita = 1.0;
      let wCereales = 1.0;
      if (edad >= 46) wAvena += 3.2;
      else if (edad <= 30) wBarrita += 2.2;
      else wCereales += 1.8;

      if (actividadFisica === 'Alta' || saleTemprano === 'Sí') wBarrita += 1.9;
      if (tamanoHogar >= 3) wCereales += 2.1;
      if (actividadFisica === 'Baja' && edad >= 40) wAvena += 1.4;

      const desayuno = rng.pickWeighted(['Avena', 'Barrita de desayuno', 'Cereales'], [wAvena, wBarrita, wCereales]);
      rows.push({
        edad,
        gasto_semanal_mil: gastoMil,
        actividad_fisica: actividadFisica,
        tamano_hogar: tamanoHogar,
        sale_temprano: saleTemprano,
        genero,
        desayuno,
      });
    }
  }

  const columns = inferColumns(rows);
  return { rows, columns, sector };
}
