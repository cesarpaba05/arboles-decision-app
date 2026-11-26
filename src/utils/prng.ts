// Generador pseudoaleatorio determinista Mulberry32 para reproducibilidad tipo set.seed() en R
export interface SeededRng {
  next: () => number;
  int: (min: number, maxInclusive: number) => number;
  shuffle: <T>(arr: T[]) => T[];
  pickWeighted: <T>(items: T[], weights: number[]) => T;
}

export function createSeededRng(seed: number): SeededRng {
  let state = (Math.floor(seed) >>> 0) || 123456789;

  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, maxInclusive: number): number => {
    return min + Math.floor(next() * (maxInclusive - min + 1));
  };

  const shuffle = <T>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  };

  const pickWeighted = <T>(items: T[], weights: number[]): T => {
    const total = weights.reduce((acc, w) => acc + Math.max(0, w), 0);
    if (total <= 0) return items[0];
    let r = next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  return { next, int, shuffle, pickWeighted };
}
