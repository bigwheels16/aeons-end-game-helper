import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import CardDisplayItem from './CardDisplayItem';
import MageDisplayItem from './MageDisplayItem';
import NemesisDisplayItem from './NemesisDisplayItem';

vi.mock('../utils/mages', () => ({
  getMageStarters: () => [
    { id: 'starter:x', name: 'Starter X', type: 'Spell', effect: hostile('starter-effect') },
  ],
}));

const WIKI_IMG = 'https://aeonsend.wiki.gg/images/Fury_token.png';

/** Hostile field HTML with a unique marker so each rendered field can be located. */
function hostile(marker: string): string {
  return (
    `<b onclick="alert(1)">${marker}</b> Gain 1 <span class="aether" onmouseover="alert(1)">&AElig;</span>.` +
    '<img src="https://evil.com/p.gif" onerror="alert(1)">' +
    `<img src="${WIKI_IMG}" alt="Fury token" style="position:fixed" onload="alert(1)">` +
    '<script>alert(1)</script><style>*{display:none}</style>' +
    '<a href="javascript:alert(1)">lnk</a><svg><g onload="alert(1)">svg</g></svg>'
  );
}

function expected(marker: string): string {
  return (
    `<b>${marker}</b> Gain 1 <span class="aether">Æ</span>.` +
    `<img src="${WIKI_IMG}" alt="Fury token">lnk`
  );
}

/** Finds the ScrapedHtml container for a marker and checks it holds exactly the sanitized output. */
function expectSanitizedField(container: HTMLElement, marker: string) {
  const bold = Array.from(container.querySelectorAll('b')).filter((b) => b.textContent === marker);
  expect(bold, marker).toHaveLength(1);
  const field = bold[0].parentElement as HTMLElement;
  expect(field.tagName).toBe('DIV');
  expect(field.innerHTML, marker).toBe(expected(marker));
}

function expectNoHostileMarkup(container: HTMLElement) {
  expect(container.querySelector('script, style, svg g, a[href^="javascript"], img[src*="evil.com"]')).toBeNull();
  for (const el of Array.from(container.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      expect(attr.name.startsWith('on'), `${el.tagName}@${attr.name}`).toBe(false);
    }
  }
  for (const img of Array.from(container.querySelectorAll('img'))) {
    expect(img.hasAttribute('style') && img.getAttribute('src') === WIKI_IMG, 'scraped img keeps no style').toBe(false);
  }
}

describe('display items render scraped HTML only through the sanitizer', () => {
  it('CardDisplayItem sanitizes the effect', () => {
    const { container } = render(
      <CardDisplayItem card={{ id: 'supply:x', name: 'X', type: 'Gem', effect: hostile('card-effect') }} />,
    );
    expectSanitizedField(container, 'card-effect');
    expectNoHostileMarkup(container);
  });

  it('MageDisplayItem sanitizes ability_effect, additional_rules and starter effects', () => {
    const { container } = render(
      <MageDisplayItem
        mage={{
          id: 'mage:x',
          name: 'X',
          type: 'Mage',
          ability_effect: hostile('ability-effect'),
          additional_rules: hostile('additional-rules'),
        }}
        matsVisible={false}
        onToggleMats={() => undefined}
        isStarterVisible={() => false}
        onToggleStarter={() => undefined}
      />,
    );
    for (const marker of ['ability-effect', 'additional-rules', 'starter-effect']) {
      expectSanitizedField(container, marker);
    }
    expectNoHostileMarkup(container);
  });

  it('NemesisDisplayItem sanitizes unleash, increased_difficulty, rules and setup', () => {
    const { container } = render(
      <NemesisDisplayItem
        nemesis={{
          id: 'nemesis:x',
          name: 'X',
          type: 'Nemesis',
          unleash: hostile('unleash'),
          increased_difficulty: hostile('increased-difficulty'),
          rules: hostile('rules'),
          setup: hostile('setup'),
        }}
        imagesVisible={false}
        onToggleImages={() => undefined}
      />,
    );
    for (const marker of ['unleash', 'increased-difficulty', 'rules', 'setup']) {
      expectSanitizedField(container, marker);
    }
    expectNoHostileMarkup(container);
  });

  it('CardDisplayItem renders an empty effect container for a missing effect', () => {
    const { container } = render(<CardDisplayItem card={{ id: 'supply:y', name: 'Y', type: 'Gem' }} />);
    expect(container.querySelector('b, span.aether')).toBeNull();
    expectNoHostileMarkup(container);
  });
});
