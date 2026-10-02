import { render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import WikiLink from './WikiLink';
import CardDisplayItem from './CardDisplayItem';
import NemesisDisplayItem from './NemesisDisplayItem';
import MageDisplayItem from './MageDisplayItem';

describe('WikiLink', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an allowlisted URL as a new-tab link with noopener noreferrer', () => {
    render(
      <WikiLink url="https://aeonsend.wiki.gg/wiki/Jade" fallbackName="Jade" style={{ color: 'green' }}>
        Jade
      </WikiLink>
    );
    const link = screen.getByRole('link', { name: 'Jade' });
    expect(link.getAttribute('href')).toBe('https://aeonsend.wiki.gg/wiki/Jade');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.style.color).toBe('green');
  });

  it('renders the normalized href, not the raw value', () => {
    render(<WikiLink url="HTTPS://AEONSEND.WIKI.GG:443/wiki/Jade" fallbackName="Jade">Jade</WikiLink>);
    expect(screen.getByRole('link', { name: 'Jade' }).getAttribute('href')).toBe('https://aeonsend.wiki.gg/wiki/Jade');
  });

  it.each(['javascript:alert(1)', 'https://evil.com/wiki/Jade', 'https://aeonsend.wiki.gg/index.php?title=Jade'])(
    'renders plain text and warns with the name only for the rejected URL %s',
    (url) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { container } = render(<WikiLink url={url} fallbackName="Jade">Jade</WikiLink>);
      expect(container.querySelector('a')).toBeNull();
      expect(screen.getByText('Jade').tagName).toBe('SPAN');
      expect(warnSpy).toHaveBeenCalled();
      for (const call of warnSpy.mock.calls) {
        const message = call.map(String).join(' ');
        expect(message).toContain('Jade');
        expect(message).not.toContain(url);
      }
    }
  );

  it.each([
    ['backslashes', 'https:\\\\aeonsend.wiki.gg\\wiki\\Jade'],
    ['a tab inside the path', 'https://aeonsend.wiki.gg/wi\tki/Jade'],
    ['a newline inside the host', 'https://aeon\nsend.wiki.gg/wiki/Jade'],
  ])('renders the normalized href for a URL with %s', (_label, url) => {
    render(<WikiLink url={url} fallbackName="Jade">Jade</WikiLink>);
    expect(screen.getByRole('link', { name: 'Jade' }).getAttribute('href')).toBe('https://aeonsend.wiki.gg/wiki/Jade');
  });

  it('renders markup-like children as text, not HTML', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const name = '<img src=x onerror=alert(1)>';
    const { container } = render(<WikiLink url="javascript:alert(1)" fallbackName={name}>{name}</WikiLink>);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(name)).toBeDefined();
  });

  it('a name-built fallback cannot leave /wiki/ or add a query', () => {
    render(<WikiLink url={undefined} fallbackName="../index.php?action=raw">x</WikiLink>);
    expect(screen.getByRole('link', { name: 'x' }).getAttribute('href')).toBe(
      'https://aeonsend.wiki.gg/wiki/..%2Findex.php%3Faction%3Draw'
    );
  });

  it('does not fall back to a name-built URL when a present page_url is rejected', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { container } = render(<WikiLink url="" fallbackName="Jade">Jade</WikiLink>);
    expect(container.querySelector('a')).toBeNull();
  });

  it('builds an encoded fallback URL from the name only when page_url is absent', () => {
    render(<WikiLink url={undefined} fallbackName="What? #1">What? #1</WikiLink>);
    expect(screen.getByRole('link', { name: 'What? #1' }).getAttribute('href')).toBe(
      'https://aeonsend.wiki.gg/wiki/What%3F_%231'
    );
  });
});

describe('WikiLink call sites', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('CardDisplayItem renders no link for a tampered page_url', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { container } = render(
      <CardDisplayItem card={{ id: 'supply:jade', name: 'Jade', type: 'Gem', page_url: 'javascript:alert(1)' }} />
    );
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Jade' })).toBeNull();
    expect(screen.getByText('Jade')).toBeDefined();
  });

  it('MageDisplayItem renders no link for a tampered mage page_url, and keeps the text', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { container } = render(
      <MageDisplayItem
        mage={{ id: 'mage:x', name: 'X', type: 'Mage', page_url: 'javascript:alert(1)' }}
        matsVisible={false}
        onToggleMats={() => undefined}
        isStarterVisible={() => false}
        onToggleStarter={() => undefined}
      />
    );
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    expect(screen.queryByRole('link', { name: 'X' })).toBeNull();
    expect(screen.getByText('X')).toBeDefined();
    for (const call of warnSpy.mock.calls) expect(call.map(String).join(' ')).not.toContain('javascript');
  });

  it('NemesisDisplayItem renders no link for an off-site page_url', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(
      <NemesisDisplayItem
        nemesis={{ id: 'nemesis:x', name: 'X', type: 'Nemesis', page_url: 'https://evil.com/wiki/X' }}
        imagesVisible={false}
        onToggleImages={() => undefined}
      />
    );
    expect(screen.queryByRole('link', { name: 'X' })).toBeNull();
  });
});
