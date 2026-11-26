import {
  CartModel,
  CartNode,
  EvaluationResult,
  MarketingSegment,
  VariableImportanceItem,
} from '../types';
import { formatDec, formatInt } from '../utils/formatters';

function collectLeaves(node: CartNode, out: CartNode[] = []): CartNode[] {
  if (node.isLeaf || !node.left || !node.right) {
    out.push(node);
    return out;
  }
  collectLeaves(node.left, out);
  collectLeaves(node.right, out);
  return out;
}

function inferProfileTag(conditions: string[]): string {
  const joined = conditions.join(' ').toLowerCase();
  if (joined.includes('más de 60') || joined.includes('46-60')) return 'Maduro y Sénior';
  if (joined.includes('menos de 31')) return 'Joven Dinámico';
  if (joined.includes('31-45')) return 'Adulto Productivo';
  if (joined.includes('mensual')) return 'Contrato Flexible';
  if (joined.includes('reclamos')) return 'Atención Prioritaria';
  if (joined.includes('mora')) return 'Riesgo Crediticio';
  if (joined.includes('plus')) return 'Cliente Frecuente Plus';
  if (joined.includes('virtual')) return 'Modalidad Digital';
  if (joined.includes('sí') && joined.includes('activo')) return 'Activo Laboral';
  if (joined.includes('no') && joined.includes('activo')) return 'Hogar y Tiempo Libre';
  if (joined.includes('casado')) return 'Núcleo Familiar';
  if (joined.includes('soltero')) return 'Estilo Independiente';
  return 'Perfil Específico';
}

function buildStrategyForSegment(
  predictedClass: string,
  sector: string,
  conditions: string[],
  probability: number,
  leafIndex: number
): {
  segmentName: string;
  strategy: MarketingSegment['strategy'];
  mensajeComunicacion: string;
  canalesRecomendados: string[];
  aviso: MarketingSegment['aviso'];
} {
  const clsLower = predictedClass.toLowerCase();
  const sectorLower = sector.toLowerCase();
  const profileTag = inferProfileTag(conditions);
  const probPct = Math.round(probability * 100);
  const joinedConds = conditions.join(' ').toLowerCase();

  // Casos específicos frecuentes y adaptación por clase predicha y sector
  if (clsLower.includes('avena')) {
    return {
      segmentName: `Segmento ${leafIndex + 1}: Bienestar y Avena (${profileTag})`,
      strategy: {
        producto:
          'Presentaciones familiares o multipack de avena en hojuelas e instantánea, enriquecida con fibra y sin azúcares añadidos.',
        precio:
          'Precio de valor por porción con descuento en formatos de 800 g a 1 kg o suscripción mensual de despensa.',
        plaza:
          'Supermercados tradicionales, tiendas de barrio y farmacias/tiendas saludables en zonas residenciales.',
        promocion:
          'Muestras gratis en punto de venta, recetarios impresos en el empaque y alianzas con clubes de bienestar.',
      },
      mensajeComunicacion:
        'Energía natural y digestión saludable para comenzar cada mañana con tranquilidad y sabor casero.',
      canalesRecomendados: [
        'Punto de venta (material POP en pasillo)',
        'WhatsApp de fidelización y recetarios',
        'Radio local y prensa digital',
        'Facebook para audiencias adultas',
      ],
      aviso: {
        titular: 'Cuida tu corazón cada mañana con avena 100% natural',
        texto: `El ${probPct}% de este perfil elige avena como base de su desayuno. Llévala en empaque familiar con recetas rápidas para toda la semana.`,
        cta: 'Descubre nuestras recetas y packs ahorro',
      },
    };
  }

  if (clsLower.includes('barrita')) {
    return {
      segmentName: `Segmento ${leafIndex + 1}: Practicidad On-the-Go (${profileTag})`,
      strategy: {
        producto:
          'Cajas de 6 a 12 barritas proteicas o de cereal con frutos secos, empaque individual listo para llevar en bolso o mochila.',
        precio:
          'Precio competitivo por unidad en tiendas de conveniencia y combos semanales ("lleva 5, paga 4").',
        plaza:
          'Tiendas de conveniencia, gimnasios, cafeterías de oficina, máquinas dispensadoras y apps de entrega rápida.',
        promocion:
          'Campañas en horarios pico de mañana (6:00–9:00 a. m.), cupones de recompra y retos con creadores de contenido fitness.',
      },
      mensajeComunicacion:
        'Tu desayuno completo en 30 segundos: nutrición práctica para quienes no detienen su ritmo.',
      canalesRecomendados: [
        'Instagram Reels y TikTok',
        'Apps de domicilio rápido (Rappi / iFood)',
        'Publicidad exterior cerca de oficinas y universidades',
        'Notificaciones push en horas de la mañana',
      ],
      aviso: {
        titular: '¿Sin tiempo para desayunar? Lleva energía real en tu bolsillo',
        texto: `Diseñada para tu rutina activa: ${probPct}% de afinidad con barritas listas para consumir camino al trabajo o entrenamiento.`,
        cta: 'Pide tu caja semanal ahora',
      },
    };
  }

  if (clsLower.includes('cereal')) {
    return {
      segmentName: `Segmento ${leafIndex + 1}: Cereales Crocantes de Hogar (${profileTag})`,
      strategy: {
        producto:
          'Cereales crocantes en sabores variados (miel, chocolate, multigrano) y cajas tamaño familiar con cierre hermético.',
        precio:
          'Precios promocionales por volumen, combos "desayuno completo" con lácteos o bebidas vegetales.',
        plaza:
          'Grandes superficies, clubes de precio, supermercados de cercanía y e-commerce de mercado mensual.',
        promocion:
          'Promociones cruzadas en góndola, coleccionables o beneficios familiares los fines de semana.',
      },
      mensajeComunicacion:
        'Sabor crocante que reúne a todos en la mesa con practicidad y nutrición balanceada.',
      canalesRecomendados: [
        'Activaciones en supermercados y catálogos',
        'Meta Ads (Instagram y Facebook) segmentado por hogar',
        'Email marketing con listas de mercado',
        'YouTube en contenidos familiares y de cocina',
      ],
      aviso: {
        titular: 'Haz de tu desayuno el momento más crocante del día',
        texto: `Con ${probPct}% de preferencia en este grupo, nuestros cereales combinan sabor, rapidez y rendimiento para el hogar.`,
        cta: 'Arma tu combo desayuno en tienda',
      },
    };
  }

  // Sectores generales: Telecom, Banca, Retail, Salud, Educación o cualquier CSV propio
  const isRiskOrNegative =
    clsLower === 'sí' &&
    (sectorLower.includes('telecom') ||
      sectorLower.includes('abandono') ||
      sectorLower.includes('deser') ||
      joinedConds.includes('reclamo')) ||
    clsLower.includes('rechaz') ||
    clsLower.includes('baja') ||
    clsLower.includes('abandono') ||
    clsLower.includes('alto riesgo');

  if (isRiskOrNegative) {
    return {
      segmentName: `Segmento ${leafIndex + 1}: Alerta Temprana y Retención (${profileTag})`,
      strategy: {
        producto:
          'Paquete de rescate o acompañamiento personalizado que elimine la fricción principal detectada en la regla del árbol.',
        precio:
          'Beneficio transitorio de retención (descuento por 3 meses, exención de recargos o plan escalonado).',
        plaza:
          'Atención proactiva multicanal (equipo especializado de retención, asesores telefónicos y WhatsApp prioritario).',
        promocion:
          'Contacto preventivo antes de la fecha de renovación con oferta exclusiva de permanencia.',
      },
      mensajeComunicacion:
        'Valoramos tu permanencia: ajustamos nuestra propuesta a tu necesidad actual sin trámites complejos.',
      canalesRecomendados: [
        'Llamada proactiva de servicio al cliente',
        'WhatsApp Business con asesor asignado',
        'Correo personalizado con beneficio directo',
      ],
      aviso: {
        titular: 'Queremos mejorar tu experiencia hoy mismo',
        texto: `Identificamos oportunidades para optimizar tu servicio (confianza del modelo: ${probPct}%). Activa un plan a tu medida sin costos ocultos.`,
        cta: 'Hablar con un asesor preferencial',
      },
    };
  }

  return {
    segmentName: `Segmento ${leafIndex + 1}: ${predictedClass} (${profileTag})`,
    strategy: {
      producto: `Oferta principal orientada a potenciar la preferencia "${predictedClass}" adaptada a las condiciones de este grupo.`,
      precio:
        probPct >= 70
          ? 'Margen saludable con venta cruzada (upselling) de mayor valor percibido.'
          : 'Precios escalonados de entrada con incentivo por primera conversión.',
      plaza:
        'Canales directos digitales y puntos de contacto donde este perfil realiza sus decisiones habituales.',
      promocion:
        'Campaña focalizada usando los atributos clave que separan a este nodo en el árbol de decisión.',
    },
    mensajeComunicacion: `Propuesta de valor diseñada específicamente para consumidores con probabilidad del ${probPct}% hacia ${predictedClass}.`,
    canalesRecomendados: [
      'Campañas digitales segmentadas (Meta / Google)',
      'Email y WhatsApp automatizado según regla de perfil',
      'Fuerza comercial y punto de contacto directo',
    ],
    aviso: {
      titular: `La solución ideal para ti: ${predictedClass}`,
      texto: `Pensado para tu perfil (${conditions.slice(0, 2).join(' · ') || 'segmento prioritario'}). Aprovecha condiciones exclusivas esta semana.`,
      cta: 'Conoce la oferta para tu perfil',
    },
  };
}

export function generateMarketingSegments(
  model: CartModel,
  sector: string
): MarketingSegment[] {
  const leaves = collectLeaves(model.root).sort((a, b) => b.n - a.n);

  return leaves.map((leaf, idx) => {
    const prob = leaf.classProbs[leaf.predictedClass] || 0;
    const conditions =
      leaf.rulePath.length > 0 ? leaf.rulePath : ['Toda la población analizada'];
    const built = buildStrategyForSegment(
      leaf.predictedClass,
      sector,
      conditions,
      prob,
      idx
    );

    const classDistribution = model.classes
      .map((cls) => ({
        cls,
        pct: (leaf.classProbs[cls] || 0) * 100,
      }))
      .sort((a, b) => b.pct - a.pct);

    return {
      leafId: leaf.id,
      segmentName: built.segmentName,
      description: conditions.join(' y '),
      conditions,
      n: leaf.n,
      pctOfBase: leaf.pctOfTrain,
      predictedClass: leaf.predictedClass,
      probability: prob,
      classDistribution,
      strategy: built.strategy,
      mensajeComunicacion: built.mensajeComunicacion,
      canalesRecomendados: built.canalesRecomendados,
      aviso: built.aviso,
    };
  });
}

export interface BusinessConclusion {
  topVariables: VariableImportanceItem[];
  lowOrUnusedVariables: VariableImportanceItem[];
  headline: string;
  variableInsights: string;
  campaignAdvice: string;
  nextSteps: string[];
}

export function generateBusinessConclusion(
  model: CartModel,
  evaluation: EvaluationResult,
  targetCol: string
): BusinessConclusion {
  const sorted = [...model.importance].sort((a, b) => b.pctImportance - a.pctImportance);
  const topVariables = sorted.filter((v) => v.pctImportance >= 10);
  const lowOrUnusedVariables = sorted.filter((v) => v.pctImportance < 5);

  const topNames = topVariables
    .slice(0, 3)
    .map((v) => `${v.variable} (${formatDec(v.pctImportance, 1)}%)`)
    .join(', ');

  const lowNames = lowOrUnusedVariables.map((v) => v.variable);
  const hasGenderLow = lowNames.some((n) =>
    n.toLowerCase().includes('genero') || n.toLowerCase().includes('sexo')
  );

  const variableInsights =
    topVariables.length > 0
      ? `Las variables con mayor poder explicativo para predecir "${targetCol}" son ${topNames}. En conjunto explican la mayoría de las divisiones del árbol y deben ser el eje de la segmentación comercial.`
      : `El árbol no encontró divisiones con suficiente ganancia Gini bajo los parámetros actuales; conviene relajar el parámetro cp o minsplit para capturar más matices.`;

  let campaignAdvice = '';
  if (lowNames.length > 0) {
    campaignAdvice = `Variables como ${lowNames.join(', ')} aportan menos del 5% de importancia (o no fueron usadas en el árbol). `;
    if (hasGenderLow) {
      campaignAdvice +=
        'Por ejemplo, dado que el género prácticamente no pesa en la decisión, NO conviene dividir el presupuesto ni diseñar campañas separadas por género; es mucho más rentable invertir según las variables principales.';
    } else {
      campaignAdvice +=
        'No conviene crear campañas diferenciadas por estas variables de bajo peso, ya que fragmentarían el presupuesto sin mejorar la conversión.';
    }
  } else {
    campaignAdvice =
      'Todas las variables incluidas aportan información útil al modelo. Prioriza en tus formularios y CRM la captura de las dos primeras variables del ranking.';
  }

  const liftPp = (evaluation.accuracy - evaluation.noInfoRate) * 100;
  const headline =
    liftPp > 3
      ? `El modelo con ${formatInt(model.leafCount)} segmentos supera en +${formatDec(liftPp, 1)} puntos porcentuales al error base y permite focalizar ${formatInt(model.leafCount)} campañas diferenciadas.`
      : `El modelo identifica ${formatInt(model.leafCount)} perfiles diferenciados; se recomienda validar si nuevas variables del cliente mejoran la separación entre clases.`;

  const nextSteps = [
    `Etiquetar la base de clientes actual en CRM usando las ${formatInt(model.leafCount)} reglas de decisión del árbol (Paso 14 permite descargar la tabla clasificada).`,
    `Lanzar una prueba piloto A/B durante 4 semanas en los 2 segmentos de mayor tamaño comparando el mensaje personalizado frente a la campaña genérica actual.`,
    `Monitorear mensualmente la tasa de acierto y F1 por clase, especialmente si alguna categoría minoritaria presenta menor cobertura, y reentrenar el árbol con nuevos datos trimestrales.`,
  ];

  return {
    topVariables,
    lowOrUnusedVariables,
    headline,
    variableInsights,
    campaignAdvice,
    nextSteps,
  };
}
