export interface SeededRandom {
  next: () => number
  int: (maximum: number) => number
  shuffle: <T>(items: T[]) => T[]
  seed: number
}

export function createRandom(seed: number): SeededRandom {
  let state = seed >>> 0
  const next = (): number => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (maximum) => Math.floor(next() * maximum),
    shuffle: <T>(items: T[]) => {
      const copy = [...items]
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const other = Math.floor(next() * (index + 1))
        ;[copy[index], copy[other]] = [copy[other], copy[index]]
      }
      return copy
    },
    seed: seed >>> 0,
  }
}

export function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0
}
