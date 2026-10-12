import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WikiLink from './WikiLink';

describe('WikiLink', () => {
  it('links to the encoded wiki page in a new tab with noopener noreferrer', () => {
    render(
      <WikiLink title="Bishop: Returned" style={{ color: 'green' }}>
        Bishop
      </WikiLink>
    );
    const link = screen.getByRole('link', { name: 'Bishop' });
    expect(link.getAttribute('href')).toBe('https://aeonsend.wiki.gg/wiki/Bishop%3A_Returned');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.style.color).toBe('green');
  });
});
