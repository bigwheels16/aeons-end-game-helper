import { useMemo } from 'react';
import scrapedData from '../../data/scraped/aeons_end_all.json';
import { useGameStore } from '../store';
import { useToggleSet } from '../hooks/useToggleSet';
import { ScrapedMage, ScrapedNemesis, ScrapedSupplyCard } from '../types/scraped';
import CardDisplayItem from '../components/CardDisplayItem';
import MageDisplayItem from '../components/MageDisplayItem';
import NemesisDisplayItem from '../components/NemesisDisplayItem';

const allCards: ScrapedSupplyCard[] = scrapedData.supply || [];
const allMages: ScrapedMage[] = scrapedData.mages || [];
const allNemeses: ScrapedNemesis[] = scrapedData.nemeses || [];

/**
 * Looks up favorited names in a dataset, returning the matching items sorted by name
 * and any favorited names that no longer exist in the dataset.
 */
function resolveFavorites<T extends { name: string }>(names: string[], items: T[]): { found: T[]; missing: string[] } {
  const byName = new Map(items.map(item => [item.name, item]));
  const found: T[] = [];
  const missing: string[] = [];
  names.forEach(name => {
    const item = byName.get(name);
    if (item) {
      found.push(item);
    } else {
      missing.push(name);
    }
  });
  found.sort((a, b) => a.name.localeCompare(b.name));
  return { found, missing };
}

function MissingFavorites({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p style={{ color: '#ffa726', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
      Not found in the current card data: {names.join(', ')}
    </p>
  );
}

/**
 * Favorites Screen Component.
 *
 * Lists every favorited mage, nemesis, and supply card using the same card layouts as the
 * search screens. Clicking a filled star removes the item from favorites.
 */
export default function FavoritesScreen() {
  const favorites = useGameStore((state) => state.favorites);
  const visibleMats = useToggleSet();
  const visibleStarters = useToggleSet();
  const visibleNemesisImages = useToggleSet();
  const visibleCardImages = useToggleSet();

  const mages = useMemo(() => resolveFavorites(favorites.mages, allMages), [favorites.mages]);
  const nemeses = useMemo(() => resolveFavorites(favorites.nemeses, allNemeses), [favorites.nemeses]);
  const cards = useMemo(() => resolveFavorites(favorites.supply, allCards), [favorites.supply]);

  const totalCount = favorites.mages.length + favorites.nemeses.length + favorites.supply.length;
  const sectionHeadingStyle = { color: 'white', margin: '0 0 1rem 0' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#1a1a1a' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #555' }}>
        <h2 style={{ margin: 0, color: 'white' }}>Favorites ({totalCount})</h2>
      </div>

      <div style={{ padding: '1rem', backgroundColor: '#1a1a1a' }}>
        {totalCount === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <p style={{ fontSize: '1.25rem', color: '#ccc' }}>No favorites yet.</p>
            <p style={{ color: '#aaa' }}>Click the star on a mage, nemesis, or supply card to add it here.</p>
          </div>
        ) : (
          <>
            {favorites.mages.length > 0 && (
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={sectionHeadingStyle}>Mages ({mages.found.length})</h3>
                <MissingFavorites names={mages.missing} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  {mages.found.map(mage => (
                    <MageDisplayItem
                      key={mage.name}
                      mage={mage}
                      matsVisible={visibleMats.has(mage.name)}
                      onToggleMats={() => visibleMats.toggle(mage.name)}
                      isStarterVisible={visibleStarters.has}
                      onToggleStarter={visibleStarters.toggle}
                    />
                  ))}
                </div>
              </section>
            )}

            {favorites.nemeses.length > 0 && (
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={sectionHeadingStyle}>Nemeses ({nemeses.found.length})</h3>
                <MissingFavorites names={nemeses.missing} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  {nemeses.found.map(nemesis => (
                    <NemesisDisplayItem
                      key={nemesis.name}
                      nemesis={nemesis}
                      imagesVisible={visibleNemesisImages.has(nemesis.name)}
                      onToggleImages={() => visibleNemesisImages.toggle(nemesis.name)}
                    />
                  ))}
                </div>
              </section>
            )}

            {favorites.supply.length > 0 && (
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={sectionHeadingStyle}>Supply Cards ({cards.found.length})</h3>
                <MissingFavorites names={cards.missing} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                  {cards.found.map(card => (
                    <CardDisplayItem
                      key={card.name}
                      card={card}
                      isImageVisible={visibleCardImages.has(card.name)}
                      onToggleImage={() => visibleCardImages.toggle(card.name)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
