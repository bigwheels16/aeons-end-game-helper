import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FavoritesScreen from './FavoritesScreen';
import CardSearchScreen from './CardSearchScreen';
import { useGameStore } from '../store';

vi.mock('../../data/scraped/aeons_end_all.json', () => ({
  default: {
    supply: [
      { id: 'Jade', name: 'Jade', type: 'Gem', expansions: ['Base'], cost: '2', effect: 'Gain 2 aether.' },
      { id: 'Spark', name: 'Spark', type: 'Spell', expansions: ['Base'], cost: '1', effect: 'Deal 1 damage.' },
    ],
    unique_starters: [],
    mages: [
      { name: 'Adelheim', type: 'Mage', expansions: ['Base'], charges: '5', ability_name: 'Aethereal Ward', breaches: [] },
    ],
    nemeses: [
      { name: 'Rageborne', type: 'Nemesis', expansions: ['Base'], health: '70', difficulty: '3' },
    ],
  }
}));

describe('Favorites', () => {
  beforeEach(() => {
    useGameStore.setState({ favorites: { supply: [], mages: [], nemeses: [] } });
    useGameStore.getState().setSearchFilters({
      cardQuery: '',
      selectedExpansions: [],
      selectedTypes: [],
      costRange: [0, 10],
    });
  });

  it('toggleFavorite adds and then removes an item', () => {
    useGameStore.getState().toggleFavorite('mages', 'Adelheim');
    expect(useGameStore.getState().favorites.mages).toEqual(['Adelheim']);

    useGameStore.getState().toggleFavorite('mages', 'Adelheim');
    expect(useGameStore.getState().favorites.mages).toEqual([]);
  });

  it('shows an empty message when nothing is favorited', () => {
    render(<FavoritesScreen />);
    expect(screen.getByText('No favorites yet.')).toBeDefined();
  });

  it('clicking the star on a supply card favorites it and fills the star', () => {
    render(<CardSearchScreen />);
    const star = screen.getByRole('button', { name: 'Add Jade to favorites' });
    expect(star.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(star);

    expect(useGameStore.getState().favorites.supply).toEqual(['Jade']);
    const filledStar = screen.getByRole('button', { name: 'Remove Jade from favorites' });
    expect(filledStar.getAttribute('aria-pressed')).toBe('true');
    expect(filledStar.querySelector('path')?.getAttribute('fill')).toBe('#fdd835');
  });

  it('lists favorited mages, nemeses, and supply cards, and unstarring removes them', () => {
    useGameStore.setState({ favorites: { supply: ['Spark'], mages: ['Adelheim'], nemeses: ['Rageborne'] } });
    render(<FavoritesScreen />);

    expect(screen.getByText('Favorites (3)')).toBeDefined();
    expect(screen.getByText('Adelheim')).toBeDefined();
    expect(screen.getByText('Rageborne')).toBeDefined();
    expect(screen.getByText('Spark')).toBeDefined();
    expect(screen.queryByText('Jade')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Spark from favorites' }));
    expect(screen.queryByText('Spark')).toBeNull();
    expect(screen.getByText('Favorites (2)')).toBeDefined();
  });

  it('reports favorited names that are missing from the data', () => {
    useGameStore.setState({ favorites: { supply: ['Removed Card'], mages: [], nemeses: [] } });
    render(<FavoritesScreen />);
    const section = screen.getByText('Supply Cards (0)').closest('section')!;
    expect(within(section).getByText('Not found in the current card data: Removed Card')).toBeDefined();
  });
});
