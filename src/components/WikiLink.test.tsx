import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WikiLink from './WikiLink';

describe('WikiLink', () => {
  it('links to page_url in a new tab with noopener noreferrer', () => {
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

  it('builds an encoded URL from the name when page_url is missing', () => {
    render(<WikiLink url={undefined} fallbackName="What? #1">What? #1</WikiLink>);
    expect(screen.getByRole('link', { name: 'What? #1' }).getAttribute('href')).toBe(
      'https://aeonsend.wiki.gg/wiki/What%3F_%231'
    );
  });
});
