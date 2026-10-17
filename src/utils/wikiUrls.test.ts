import { describe, it, expect } from 'vitest';
import { imageUrl, wikiPageUrl } from './wikiUrls';

describe('wikiUrls', () => {
  it('builds hosted image URLs from encoded image file names', () => {
    expect(imageUrl('Brama_Front.webp')).toBe('https://aeons-end.jkbff.com/images/Brama_Front.webp');
    expect(imageUrl("What?_#1_Z'hana.webp")).toBe("https://aeons-end.jkbff.com/images/What%3F_%231_Z'hana.webp");
  });

  it('builds wiki page URLs from page titles', () => {
    expect(wikiPageUrl('Bishop: Returned')).toBe('https://aeonsend.wiki.gg/wiki/Bishop%3A_Returned');
  });
});
