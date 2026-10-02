import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CardDisplayItem from './CardDisplayItem';

describe('CardDisplayItem', () => {
  it('Show Image reveals the encoded, lazily loaded wiki image as a new-tab link; Hide Image removes it', () => {
    render(<CardDisplayItem card={{ id: 'supply:what', name: 'What? #1', type: 'Gem', cost: '2', page_url: 'https://aeonsend.wiki.gg/wiki/What%3F_%231' }} />);
    expect(screen.queryByRole('img')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show Image' }));

    const url = 'https://aeonsend.wiki.gg/images/What%3F_%231.jpg';
    const img = screen.getByRole('img', { name: 'What? #1' });
    expect(img.getAttribute('src')).toBe(url);
    expect(img.getAttribute('loading')).toBe('lazy');
    const link = img.closest('a');
    expect(link?.getAttribute('href')).toBe(url);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');

    fireEvent.click(screen.getByRole('button', { name: 'Hide Image' }));
    expect(screen.queryByRole('img')).toBeNull();
  });
});
