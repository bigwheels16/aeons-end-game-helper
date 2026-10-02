import { describe, it, expect } from 'vitest';
import { shuffleInPlace } from './shuffle';

describe('shuffleInPlace', () => {
  it('reorders the given array in place and keeps every element exactly once', () => {
    const firstElements = new Set<number>();
    for (let run = 0; run < 200; run++) {
      const items = [0, 1, 2, 3, 4];
      expect(shuffleInPlace(items)).toBe(items);
      expect([...items].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
      firstElements.add(items[0]);
    }
    // A real shuffle moves every element to the front at least once in 200 runs.
    expect(firstElements.size).toBe(5);
  });
});
