import { StepDefinition } from '../types';

export const STEPS_METADATA: StepDefinition[] = [
  {
    number: 1,
    shortTitle: 'Contexto de negocio',
    title: 'Paso 1: Contexto de negocio y pregunta guía',
    phase: 'Comprensión del negocio',
    whatItMeansTitle: '¿Por qué empezar por el negocio y no por los datos?',
    whatItMeansText:
      'En la metodología CRISP-DM, todo proyecto analítico comienza definiendo qué decisión comercial queremos mejorar. Un árbol de clasificación solo genera valor si responde a una pregunta concreta del equipo.',
    whatItMeansExample:
      'Ejemplo: En lugar de decir "analizar clientes", formulamos: "¿Qué tipo de desayuno prefiere cada grupo de consumidores para enviar la promoción adecuada a cada segmento?".',
  },
  {
    number: 2,
    shortTitle: 'Cargar datos',
    title: 'Paso 2: Cargar base de datos (CSV, TXT o Excel)',
    phase: 'Comprensión de los datos',
    whatItMeansTitle: '¿Qué son el separador y el símbolo decimal?',
    whatItMeansText:
      'Los archivos de texto separan las columnas con coma (,), punto y coma (;) o tabulación, y usan punto o coma para los decimales. Detectarlos bien evita que toda la tabla quede pegada en una sola columna o que los números se lean como texto.',
    whatItMeansExample:
      'Ejemplo: Un archivo exportado desde Excel en Colombia suele usar punto y coma (;) entre columnas y coma (,) para decimales como 45,8.',
  },
  {
    number: 3,
    shortTitle: 'Data sintética',
    title: 'Paso 3: Generar data sintética por sector (opcional)',
    phase: 'Comprensión de los datos',
    whatItMeansTitle: '¿Qué es la data sintética y cuándo conviene usarla?',
    whatItMeansText:
      'Es una base de datos simulada matemáticamente en el navegador usando reglas de negocio reales de un sector. Sirve para practicar, probar estrategias o validar el flujo antes de tener los datos reales de tu empresa.',
    whatItMeansExample:
      'Ejemplo: Podemos simular 800 clientes de telecomunicaciones donde los contratos mensuales con 3 o más reclamos tienen mayor probabilidad de cancelar el servicio.',
  },
  {
    number: 4,
    shortTitle: 'Vista previa',
    title: 'Paso 4: Vista previa de los registros',
    phase: 'Comprensión de los datos',
    whatItMeansTitle: '¿Para qué revisar las primeras 5 filas (head)?',
    whatItMeansText:
      'Mirar los primeros registros y contar filas y columnas permite confirmar que los encabezados se leyeron bien, que no hay columnas vacías ni textos cortados y que cada fila representa a un consumidor.',
    whatItMeansExample:
      'Ejemplo: Ver que "edadcat", "genero", "ecivil", "activo" y "desayuno" aparecen como columnas separadas y que el total coincide con 880 consumidores.',
  },
  {
    number: 5,
    shortTitle: 'Tipos de variables',
    title: 'Paso 5: Tipos de variables (Categóricas vs. Numéricas)',
    phase: 'Comprensión de los datos',
    whatItMeansTitle: '¿Por qué un número como 1, 2 o 3 puede ser una categoría?',
    whatItMeansText:
      'Las variables categóricas (llamadas "factor" en R) representan grupos o etiquetas, mientras que las numéricas miden cantidades que se pueden promediar. A veces una encuesta guarda respuestas como 1, 2, 3 (por ejemplo: 1 = Soltero, 2 = Casado, 3 = Otro). Si se dejan como número, el árbol intentaría calcular promedios sin sentido.',
    whatItMeansExample:
      'Ejemplo: El estrato socioeconómico (1 a 6) o un código de sucursal (101, 102) deben marcarse como Categórica (factor), no como Numérica.',
  },
  {
    number: 6,
    shortTitle: 'Análisis numérico',
    title: 'Paso 6: Análisis descriptivo de variables numéricas',
    phase: 'Comprensión de los datos',
    whatItMeansTitle: '¿Qué cuentan la mediana, el CV, la asimetría y el boxplot?',
    whatItMeansText:
      'La media es el promedio, pero la mediana muestra el valor central sin dejarse arrastrar por extremos. El coeficiente de variación (CV) mide qué tan dispersos están los datos frente al promedio. El histograma y el boxplot muestran dónde se concentra la mayoría y si existen valores atípicos.',
    whatItMeansExample:
      'Ejemplo: Si el gasto mensual tiene media $180.000 pero mediana $95.000 y asimetría positiva, unos pocos compradores grandes están subiendo el promedio.',
  },
  {
    number: 7,
    shortTitle: 'Gráficos categóricos',
    title: 'Paso 7: Frecuencias y cruces de variables categóricas',
    phase: 'Comprensión de los datos',
    whatItMeansTitle: '¿Qué aporta cruzar cada variable con la variable objetivo?',
    whatItMeansText:
      'El gráfico de barras muestra cuántas personas hay en cada categoría. La tabla cruzada con porcentajes por fila revela si la preferencia cambia fuertemente de un grupo a otro, anticipando qué variables serán útiles para el árbol.',
    whatItMeansExample:
      'Ejemplo: Si el 60% de mayores de 60 años elige Avena, mientras solo el 12% de jóvenes la elige, la edad tiene un poder fuerte de separación.',
  },
  {
    number: 8,
    shortTitle: 'Variable dependiente',
    title: 'Paso 8: Definir la variable dependiente (objetivo)',
    phase: 'Preparación de los datos',
    whatItMeansTitle: '¿Qué es el error base y qué significa el desbalance?',
    whatItMeansText:
      'La variable dependiente es aquello que el árbol intentará predecir. El "error base" es el porcentaje de veces que nos equivocaríamos si siempre apostáramos por la categoría más común sin usar ningún modelo. Si una clase representa menos del 20% de los datos, existe desbalance y conviene vigilar el F1-Score, no solo la exactitud global.',
    whatItMeansExample:
      'Ejemplo: Si el 85% de los clientes NO abandona, decir siempre "No abandona" acierta 85% (error base 15%), pero falla en detectar a quienes sí se van.',
  },
  {
    number: 9,
    shortTitle: 'Entrenamiento 70/30',
    title: 'Paso 9: División estratificada 70% entrenamiento / 30% prueba',
    phase: 'Preparación de los datos',
    whatItMeansTitle: '¿Por qué separar 30% para prueba y usar semilla?',
    whatItMeansText:
      'El árbol aprende las reglas con el 70% de los consumidores (entrenamiento) y luego lo evaluamos como en un examen sorpresa con el 30% restante (prueba) que nunca vio. Hacerlo de forma estratificada garantiza que ambas partes mantengan la misma proporción de clases, y la semilla fija asegura que cualquiera pueda repetir exactamente la misma división.',
    whatItMeansExample:
      'Ejemplo: Si en toda la base el 35,5% prefiere Avena, tanto en entrenamiento como en prueba habrá ~35,5% de consumidores de Avena.',
  },
  {
    number: 10,
    shortTitle: 'Árbol optimizado',
    title: 'Paso 10: Árbol CART optimizado y validación cruzada',
    phase: 'Modelado',
    whatItMeansTitle: '¿Qué son la raíz, las hojas, el índice Gini y el xerror?',
    whatItMeansText:
      'La raíz es el primer nodo arriba que contiene todo el entrenamiento. Los nodos internos hacen preguntas binarias que reducen al máximo la mezcla de clases medida por el índice Gini (Gini = 0 significa nodo 100% puro de una sola clase). Las hojas son las cajas finales con la predicción. El error de validación cruzada (xerror) mide qué tan bien predice cada tamaño de árbol en 10 submuestras distintas.',
    whatItMeansExample:
      'Ejemplo: Un árbol crece hasta cp = 0,001 y luego la tabla CP identifica en qué punto xerror alcanza su mínimo antes de empezar a memorizar ruido.',
  },
  {
    number: 11,
    shortTitle: 'Podar el árbol',
    title: 'Paso 11: Poda del árbol y comparación de versiones',
    phase: 'Modelado',
    whatItMeansTitle: '¿Por qué podar un árbol evita el sobreajuste?',
    whatItMeansText:
      'El sobreajuste ocurre cuando un árbol crece demasiado y memoriza casos raros del entrenamiento que no se repiten en clientes nuevos. Podar consiste en recortar ramas débiles usando el parámetro de complejidad (cp), la regla de 1 error estándar (1-SE) o límites de profundidad (maxdepth) y tamaño mínimo de hoja (minbucket).',
    whatItMeansExample:
      'Ejemplo: Un árbol de 18 hojas puede tener 72% en entrenamiento pero bajar a 56% en prueba, mientras uno podado a 5 hojas logra 64% estable en ambos.',
  },
  {
    number: 12,
    shortTitle: 'Evaluación en prueba',
    title: 'Paso 12: Evaluación en datos de prueba y matriz de confusión',
    phase: 'Evaluación',
    whatItMeansTitle: '¿Cómo leer la matriz de confusión, Kappa y F1-Score?',
    whatItMeansText:
      'En la matriz de confusión, las filas muestran la clase real del consumidor y las columnas la predicción del árbol (en R, caret la muestra al revés). La diagonal son los aciertos. El Kappa mide cuánto mejora el árbol frente al azar puro, y el F1 combina precisión y sensibilidad (recall) por cada clase para detectar si alguna categoría quedó desatendida.',
    whatItMeansExample:
      'Ejemplo: Si la accuracy global es 78% pero la clase minoritaria tiene F1 = 22%, el modelo es bueno para la mayoría pero falla justo en ese segmento clave.',
  },
  {
    number: 13,
    shortTitle: 'Aplicación al negocio',
    title: 'Paso 13: Segmentos accionables y estrategias de marketing',
    phase: 'Despliegue',
    whatItMeansTitle: '¿Cómo se convierte una hoja del árbol en una campaña?',
    whatItMeansText:
      'Cada hoja terminal del árbol agrupa a consumidores con características idénticas y una preferencia dominante clara. Al traducir las condiciones de cada hoja en nombre comercial, propuesta de valor (4P), canales y ejemplo de aviso, el análisis estadístico se vuelve ejecutable para mercadeo y ventas.',
    whatItMeansExample:
      'Ejemplo: Si el género tiene menos del 5% de importancia, no gastamos presupuesto diseñando dos creatividades distintas por género, sino según edad y actividad.',
  },
  {
    number: 14,
    shortTitle: 'Exportar',
    title: 'Paso 14: Exportar informe ejecutivo, predicciones y script R',
    phase: 'Despliegue',
    whatItMeansTitle: '¿Qué incluye cada archivo descargable?',
    whatItMeansText:
      'El informe HTML guarda en un solo archivo portátil el diagrama del árbol, la matriz de confusión, las estrategias por segmento y el código R equivalente. El archivo CSV entrega cada consumidor del conjunto de prueba con su predicción y segmento asignado para cargarlo en CRM o Excel.',
    whatItMeansExample:
      'Ejemplo: Compartir el HTML por correo con gerencia y entregar el CSV al equipo de pauta digital para activar la campaña piloto.',
  },
];
