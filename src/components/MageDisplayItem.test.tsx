import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MageDisplayItem from './MageDisplayItem';
import { ScrapedMage } from '../types/scraped';

const mage: ScrapedMage = {
  id: 'mage:brama',
  name: 'Brama',
  type: 'Mage',
  starting_hand: '1x Buried Light<br>4x Crystal',
  starting_deck: '3x Crystal<br>2x Spark',
  images: ['Brama_Front.jpg', 'Brama_Back.jpg'],
};

describe('MageDisplayItem', () => {
  it('shows the starting hand and deck, one card per line', () => {
    render(<MageDisplayItem mage={mage} />);

    const hand = screen.getByText('Starting Hand:').parentElement!;
    expect(hand.innerHTML).toContain('1x Buried Light<br>4x Crystal');
    const deck = screen.getByText('Starting Deck:').parentElement!;
    expect(deck.innerHTML).toContain('3x Crystal<br>2x Spark');
  });

  it('leaves out the section when the mage has no starting cards', () => {
    render(<MageDisplayItem mage={{ ...mage, starting_hand: undefined, starting_deck: undefined }} />);
    expect(screen.queryByText('Starting Hand:')).toBeNull();
    expect(screen.queryByText('Starting Deck:')).toBeNull();
  });

  it('shows unique starters in the supply card layout, without an expansion, note or favorites star', () => {
    render(<MageDisplayItem mage={{ ...mage, unique_cards: ['Buried Light'] }} />);
    expect(screen.getByRole('link', { name: 'Buried Light' })).toBeTruthy();
    expect(screen.getByText('Spell')).toBeTruthy();
    expect(screen.getByText('Cost: 0')).toBeTruthy();
    expect(screen.queryByText("Aeon's End (Core Box)")).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Buried Light to favorites' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add note on Buried Light' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Brama to favorites' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add note on Brama' })).toBeTruthy();
  });

  it('Show Mat Images shows the mat images in order', () => {
    render(<MageDisplayItem mage={mage} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Mat Images' }));

    const srcs = screen.getAllByRole('img').map(img => img.getAttribute('src'));
    expect(srcs).toEqual([
      'https://aeonsend.wiki.gg/images/Brama_Front.jpg',
      'https://aeonsend.wiki.gg/images/Brama_Back.jpg',
    ]);
    expect(screen.getByRole('img', { name: 'Brama Front' })).toBeTruthy();
  });
});
