import { test, expect } from 'vitest';
import { allCards } from './allCards';

test('loads all cards', () => {
  expect(allCards.length).toBeGreaterThan(0);
});
