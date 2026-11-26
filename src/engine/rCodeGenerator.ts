import { DatasetState, RpartControl, SplitConfig } from '../types';

export interface RCodeContext {
  dataset: DatasetState;
  targetCol: string;
  splitConfig: SplitConfig | null;
  control: RpartControl;
  appliedCp: number;
  selectedStep: number;
}

export function getEquivalentRCode(ctx: RCodeContext): string {
  const { dataset, targetCol, splitConfig, control, appliedCp, selectedStep } = ctx;
  const fileName = dataset.fileName || 'cereal_desayuno_880.csv';
  const sep = dataset.separator === '\t' ? '\\t' : dataset.separator || ',';
  const dec = dataset.decimal || '.';
  const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
  const seed = splitConfig?.seed ?? 123;
  const factorCols = dataset.columns.filter((c) => c.type === 'factor').map((c) => c.name);
  const numCols = dataset.columns.filter((c) => c.type === 'numeric').map((c) => c.name);

  switch (selectedStep) {
    case 1:
      return `# Paso 1: Definir el objetivo de negocio en el script del proyecto
# Pregunta de negocio y sector documentados como encabezado reproducible
proyecto <- list(
  sector = "${dataset.sectorLabel || 'Alimentos y bebidas'}",
  objetivo = "Clasificar ${targetCol || 'la variable objetivo'} con árboles CART"
)`;

    case 2:
      if (isExcel) {
        return `# Paso 2: Cargar archivo Excel trabajando sobre una copia
library(readxl)
datos_originales <- read_excel("${fileName}")
base <- datos_originales  # Copia de trabajo para no alterar el archivo fuente`;
      }
      return `# Paso 2: Cargar archivo de texto/CSV trabajando sobre una copia
datos_originales <- read.csv(
  "${fileName}",
  sep = "${sep}",
  dec = "${dec}",
  stringsAsFactors = FALSE,
  fileEncoding = "UTF-8"
)
base <- datos_originales  # Copia de trabajo`;

    case 3:
      return `# Paso 3: Simulación reproducible de consumidores (ejemplo con set.seed)
set.seed(${seed})
n <- ${dataset.rows.length || 800}
# En R se generan covariables con sample(), rnorm() o runif() y reglas logísticas
# para asignar la variable objetivo "${targetCol || 'objetivo'}"`;

    case 4:
      return `# Paso 4: Vista previa y dimensiones de la base de datos
dim(base)      # Filas y columnas: ${dataset.rows.length} x ${dataset.columns.length}
nrow(base)     # Número de consumidores
ncol(base)     # Número de variables
head(base, 5)  # Primeros 5 registros`;

    case 5: {
      const factorLines = factorCols
        .map((c) => `base$${c} <- as.factor(base$${c})`)
        .join('\n');
      return `# Paso 5: Inspeccionar estructura y convertir variables categóricas a factor
str(base)
${factorLines || '# No hay columnas categóricas seleccionadas'}
str(base)`;
    }

    case 6:
      if (numCols.length === 0) {
        return `# Paso 6: Análisis descriptivo de variables numéricas
# En esta base todas las variables son categóricas (factor).
# Si hubiera variables numéricas, se ejecutaría:
summary(base)
# library(psych); describe(base[, sapply(base, is.numeric)])`;
      }
      return `# Paso 6: Estadísticos descriptivos, histograma y boxplot de variables numéricas
library(psych)
vars_num <- c(${numCols.map((c) => `"${c}"`).join(', ')})
summary(base[, vars_num, drop = FALSE])
describe(base[, vars_num, drop = FALSE])

# Histograma y boxplot para la primera variable numérica
hist(base$${numCols[0]}, main = "Histograma de ${numCols[0]}", xlab = "${numCols[0]}")
boxplot(base$${numCols[0]}, main = "Boxplot de ${numCols[0]}", horizontal = TRUE)`;

    case 7: {
      const firstFactor = factorCols[0] || targetCol || 'edadcat';
      return `# Paso 7: Gráficos de barras con conteo y % + tablas cruzadas por fila
library(ggplot2)
library(dplyr)

# Gráfico de barras de frecuencias para ${firstFactor}
base %>%
  count(${firstFactor}) %>%
  mutate(pct = n / sum(n) * 100) %>%
  ggplot(aes(x = ${firstFactor}, y = n, fill = ${firstFactor})) +
  geom_bar(stat = "identity") +
  geom_text(aes(label = paste0(n, " (", round(pct, 1), "%)")), vjust = -0.4) +
  theme_minimal() + theme(legend.position = "none")

# Tabla cruzada contra la variable objetivo (${targetCol}) con % por fila
prop.table(table(base$${firstFactor}, base$${targetCol}), margin = 1) * 100`;
    }

    case 8:
      return `# Paso 8: Verificar distribución de la variable dependiente y error base
tabla_objetivo <- table(base$${targetCol})
prop.table(tabla_objetivo) * 100

# Error base (si siempre se predice la clase mayoritaria)
error_base <- 1 - max(prop.table(tabla_objetivo))
cat("Error base:", round(error_base * 100, 1), "%\\n")`;

    case 9:
      return `# Paso 9: Partición estratificada 70% entrenamiento / 30% prueba
library(caret)
set.seed(${seed})
indice <- createDataPartition(base$${targetCol}, p = 0.70, list = FALSE)
train <- base[indice, ]
test  <- base[-indice, ]

# Comprobar proporciones en entrenamiento y prueba
prop.table(table(train$${targetCol})) * 100
prop.table(table(test$${targetCol})) * 100`;

    case 10:
      return `# Paso 10: Entrenar árbol CART amplio con validación cruzada (xval = ${control.xval})
library(rpart)
library(rpart.plot)

set.seed(${seed})
arbol_grande <- rpart(
  ${targetCol} ~ .,
  data = train,
  method = "class",
  parms = list(split = "gini"),
  control = rpart.control(
    cp = ${control.cp},
    minsplit = ${control.minsplit},
    minbucket = ${control.minbucket},
    maxdepth = ${control.maxdepth},
    xval = ${control.xval}
  )
)

printcp(arbol_grande)  # Tabla de complejidad (CP, nsplit, rel error, xerror, xstd)
plotcp(arbol_grande)   # Gráfico xerror vs tamaño del árbol

# Podar en el cp de menor xerror
cp_optimo <- arbol_grande$cptable[which.min(arbol_grande$cptable[, "xerror"]), "CP"]
arbol_optimo <- prune(arbol_grande, cp = cp_optimo)

rpart.plot(arbol_optimo, extra = 104, nn = TRUE, fallen.leaves = TRUE)
rpart.rules(arbol_optimo, cover = TRUE)
arbol_optimo$variable.importance`;

    case 11:
      return `# Paso 11: Podar el árbol y ajustar hiperparámetros
# Opción (a): menor xerror | Opción (b): regla 1-SE | Opción (c/d): cp = ${appliedCp.toFixed(4)}
arbol_podado <- prune(arbol_grande, cp = ${appliedCp.toFixed(4)})

# O reentrenar con controles personalizados:
arbol_custom <- rpart(
  ${targetCol} ~ .,
  data = train,
  method = "class",
  control = rpart.control(
    cp = ${appliedCp.toFixed(4)},
    minsplit = ${control.minsplit},
    minbucket = ${control.minbucket},
    maxdepth = ${control.maxdepth},
    xval = ${control.xval}
  )
)
rpart.plot(arbol_podado, extra = 104, nn = TRUE)`;

    case 12:
      return `# Paso 12: Evaluar en datos de prueba y comparar contra el error base
library(caret)

pred_train <- predict(arbol_podado, newdata = train, type = "class")
pred_test  <- predict(arbol_podado, newdata = test,  type = "class")

# Nota: caret muestra Predicción en filas y Valor Real en columnas (transpuesta)
cm <- confusionMatrix(data = pred_test, reference = test$${targetCol})
print(cm)

# Para ver Filas = Real y Columnas = Predicción (como en esta aplicación):
t(cm$table)

# Métricas por clase (Precisión, Recall, Especificidad y F1)
cm$byClass[, c("Precision", "Recall", "Specificity", "F1")]`;

    case 13:
      return `# Paso 13: Extraer reglas de segmentos e importancia de variables para marketing
rpart.rules(arbol_podado, style = "tall", cover = TRUE)
importancia <- arbol_podado$variable.importance
round(importancia / sum(importancia) * 100, 1)

# Asignar cada cliente de prueba a su nodo hoja (segmento)
test$nodo_segmento <- arbol_podado$where`;

    case 14:
    default:
      return `# Paso 14: Exportar resultados y predicciones a CSV
test_export <- test
test_export$prediccion <- predict(arbol_podado, newdata = test, type = "class")
prob_mat <- predict(arbol_podado, newdata = test, type = "prob")
test_export$probabilidad_max <- apply(prob_mat, 1, max)

write.csv(test_export, "predicciones_arbol_cart.csv", row.names = FALSE, fileEncoding = "UTF-8")`;
  }
}

export function buildFullRScript(ctx: RCodeContext): string {
  const sections: string[] = [
    '# ============================================================================',
    '# Script completo en R — Clasificador de Consumidores con Árboles de Decisión',
    `# Sector: ${ctx.dataset.sectorLabel || 'General'} | Variable objetivo: ${ctx.targetCol}`,
    '# Metodología CRISP-DM + método CART (índice Gini) con rpart',
    '# ============================================================================',
    '',
  ];
  for (let s = 1; s <= 14; s++) {
    sections.push(getEquivalentRCode({ ...ctx, selectedStep: s }));
    sections.push('');
  }
  return sections.join('\n');
}
