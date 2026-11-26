import { createSeededRng } from '../utils/prng';

export const DEFAULT_BUSINESS_QUESTION =
  'Una empresa de alimentos quiere saber qué tipo de desayuno prefiere cada consumidor según su edad, género, estado civil y actividad laboral, para diseñar campañas por segmento.';

export const DEFAULT_BUSINESS_SECTOR = 'Alimentos y bebidas';

export const RECOMMENDED_CASE_NAME =
  'Taller – Desayuno de cereales (880 consumidores)';

export const RECOMMENDED_FILE_NAME = 'cereal_desayuno_880.csv';

interface CerealCell {
  edadcat: 'Menos de 31' | '31-45' | '46-60' | 'Más de 60';
  activo: 'Sí' | 'No';
  ecivil: 'Soltero' | 'Casado';
  counts: {
    Avena: number;
    'Barrita de desayuno': number;
    Cereales: number;
  };
}

// Distribución exacta de 880 consumidores (46-60 y Más de 60 -> 59,0% Avena;
// jóvenes activos -> Barrita de desayuno; menos activos -> Cereales; género balanceado 50/50)
const CEREAL_CELLS: CerealCell[] = [
  // Menos de 31 (240)
  { edadcat: 'Menos de 31', activo: 'Sí', ecivil: 'Soltero', counts: { Avena: 10, 'Barrita de desayuno': 68, Cereales: 22 } }, // 100
  { edadcat: 'Menos de 31', activo: 'Sí', ecivil: 'Casado', counts: { Avena: 6, 'Barrita de desayuno': 30, Cereales: 14 } },  // 50
  { edadcat: 'Menos de 31', activo: 'No', ecivil: 'Soltero', counts: { Avena: 8, 'Barrita de desayuno': 14, Cereales: 38 } },  // 60
  { edadcat: 'Menos de 31', activo: 'No', ecivil: 'Casado', counts: { Avena: 5, 'Barrita de desayuno': 7, Cereales: 18 } },   // 30
  // 31-45 (240)
  { edadcat: '31-45', activo: 'Sí', ecivil: 'Soltero', counts: { Avena: 6, 'Barrita de desayuno': 30, Cereales: 14 } },       // 50
  { edadcat: '31-45', activo: 'Sí', ecivil: 'Casado', counts: { Avena: 16, 'Barrita de desayuno': 44, Cereales: 30 } },       // 90
  { edadcat: '31-45', activo: 'No', ecivil: 'Soltero', counts: { Avena: 9, 'Barrita de desayuno': 5, Cereales: 26 } },        // 40
  { edadcat: '31-45', activo: 'No', ecivil: 'Casado', counts: { Avena: 16, 'Barrita de desayuno': 8, Cereales: 36 } },        // 60
  // 46-60 (220)
  { edadcat: '46-60', activo: 'No', ecivil: 'Casado', counts: { Avena: 60, 'Barrita de desayuno': 10, Cereales: 20 } },       // 90
  { edadcat: '46-60', activo: 'No', ecivil: 'Soltero', counts: { Avena: 26, 'Barrita de desayuno': 6, Cereales: 8 } },        // 40
  { edadcat: '46-60', activo: 'Sí', ecivil: 'Casado', counts: { Avena: 28, 'Barrita de desayuno': 14, Cereales: 18 } },       // 60
  { edadcat: '46-60', activo: 'Sí', ecivil: 'Soltero', counts: { Avena: 12, 'Barrita de desayuno': 10, Cereales: 8 } },       // 30
  // Más de 60 (180)
  { edadcat: 'Más de 60', activo: 'No', ecivil: 'Casado', counts: { Avena: 54, 'Barrita de desayuno': 10, Cereales: 16 } },   // 80
  { edadcat: 'Más de 60', activo: 'No', ecivil: 'Soltero', counts: { Avena: 24, 'Barrita de desayuno': 6, Cereales: 10 } },   // 40
  { edadcat: 'Más de 60', activo: 'Sí', ecivil: 'Casado', counts: { Avena: 22, 'Barrita de desayuno': 8, Cereales: 10 } },    // 40
  { edadcat: 'Más de 60', activo: 'Sí', ecivil: 'Soltero', counts: { Avena: 10, 'Barrita de desayuno': 4, Cereales: 6 } },    // 20
];

function buildEmbeddedCerealCsv(): string {
  const rng = createSeededRng(8802026);
  const lines: string[] = [];
  let genderToggle = 0;

  for (const cell of CEREAL_CELLS) {
    const entries = Object.entries(cell.counts) as [keyof CerealCell['counts'], number][];
    for (const [desayuno, count] of entries) {
      for (let i = 0; i < count; i++) {
        // Género balanceado para que no tenga peso predictivo artificial
        const genero = genderToggle % 2 === 0 ? 'Mujer' : 'Hombre';
        genderToggle++;
        lines.push(`${cell.edadcat},${genero},${cell.ecivil},${cell.activo},${desayuno}`);
      }
    }
  }

  const shuffled = rng.shuffle(lines);
  return ['edadcat,genero,ecivil,activo,desayuno', ...shuffled].join('\n');
}

export const EMBEDDED_CEREAL_CSV = buildEmbeddedCerealCsv();
