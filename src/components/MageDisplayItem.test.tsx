import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MageDisplayItem from './MageDisplayItem';
import { ScrapedMage } from '../types/scraped';

const mage: ScrapedMage = {
  id: 'mage:brama',
  name: 'Brama',
  type: 'Mage',
  starting_hand: '1x Buried Light<br>4x Crystal',
  starting_deck: '3x Crystal<br>2x Spark',
  page_url: 'https://aeonsend.wiki.gg/wiki/Brama',
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
});
