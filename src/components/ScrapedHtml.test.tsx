import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ScrapedHtml from './ScrapedHtml';

describe('ScrapedHtml', () => {
  it('renders allowed markup and drops a non-wiki image', () => {
    const { container } = render(
      <ScrapedHtml html={'<b>Cast:</b> Deal 1.<img src="https://evil.com/x" onerror="alert(1)">'} style={{ color: 'red' }} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe('DIV');
    expect(root.style.color).toBe('red');
    expect(root.querySelector('b')?.textContent).toBe('Cast:');
    expect(root.querySelector('img')).toBeNull();
    expect(root.innerHTML).toBe('<b>Cast:</b> Deal 1.');
  });

  it('keeps a wiki token image without inline style', () => {
    const { container } = render(
      <ScrapedHtml html={'<img src="https://aeonsend.wiki.gg/images/Husk_token.png" alt="Husk token" style="display: block">'} />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://aeonsend.wiki.gg/images/Husk_token.png');
    expect(img?.hasAttribute('style')).toBe(false);
  });

  it('renders an empty container for undefined html', () => {
    const { container } = render(<ScrapedHtml html={undefined} />);
    expect(container.firstElementChild?.innerHTML).toBe('');
  });
});
