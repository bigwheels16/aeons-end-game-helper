import { describe, it, expect } from 'vitest';
import { matchesSearch, stripHtml } from './text';

describe('text utils', () => {
  describe('stripHtml', () => {
    it('strips basic html tags', () => {
      expect(stripHtml('<b>Bold</b> and <i>italic</i>')).toBe('Bold and italic');
    });

    it('handles empty or null string', () => {
      expect(stripHtml('')).toBe('');
    });
  });

  describe('matchesSearch', () => {
    it('needs every term somewhere in the texts, ignoring case and HTML tags', () => {
      const texts = ['Jade', '<p>Gain 2 <b>aether</b>.</p>', undefined];
      expect(matchesSearch('  jade AETHER ', texts)).toBe(true);
      expect(matchesSearch('jade charge', texts)).toBe(false);
      expect(matchesSearch('b', ['Jade', '<b>Gain</b>'])).toBe(false);
      expect(matchesSearch('   ', texts)).toBe(true);
    });
  });
});
