import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CardDisplayItem from './CardDisplayItem';
import { useGameStore } from '../store';

describe('CardDisplayItem', () => {
  it('Show Image reveals the encoded, lazily loaded wiki image as a new-tab link; Hide Image removes it', () => {
    render(<CardDisplayItem card={{ id: 'supply:what', name: 'What? #1', type: 'Gem', cost: '2', images: ['What?_#1.jpg'] }} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('link', { name: 'What? #1' }).getAttribute('href')).toBe('https://aeonsend.wiki.gg/wiki/What%3F_%231');

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

  it('shows the note icon just before the favorites star', () => {
    useGameStore.setState({ notes: { supply: { 'supply:jade': 'Buy early.' }, mages: {}, nemeses: {} } });
    render(<CardDisplayItem card={{ id: 'supply:jade', name: 'Jade', type: 'Gem', cost: '2' }} />);
    const noteButton = screen.getByRole('button', { name: 'Edit note on Jade' });
    expect(noteButton.getAttribute('title')).toBe('Buy early.');
    expect(noteButton.nextElementSibling).toBe(screen.getByRole('button', { name: 'Add Jade to favorites' }));
  });
});
