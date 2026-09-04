import { describe, it, expect } from 'vitest';
import { stripHtml } from './text';

describe('text utils', () => {
  describe('stripHtml', () => {
    it('strips basic html tags', () => {
      expect(stripHtml('<b>Bold</b> and <i>italic</i>')).toBe('Bold and italic');
    });

    it('handles empty or null string', () => {
      expect(stripHtml('')).toBe('');
    });
  });
});
