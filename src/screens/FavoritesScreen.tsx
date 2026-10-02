import { useMemo } from 'react';
import { useGameStore } from '../store';
import { useToggleSet } from '../hooks/useToggleSet';
import { getMageById, getNemesisById, getSupplyCardById } from '../utils/cards';
import CardDisplayItem from '../components/CardDisplayItem';
import MageDisplayItem from '../components/MageDisplayItem';
import NemesisDisplayItem from '../components/NemesisDisplayItem';

/**
 * Resolves favorited record ids to bundled items, sorted by name. Unknown ids are skipped; the
 * store's load-time filter already drops them, so in practice every id resolves.
 */
function resolveFavorites<T extends { name: string }>(ids: string[], lookup: (id: string) => T | undefined): T[] {
  const found: T[] = [];
  ids.forEach(id => {
    const item = lookup(id);
    if (item) found.push(item);
  });
  found.sort((a, b) => a.name.localeCompare(b.name));
  return found;
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

  const mages = useMemo(() => resolveFavorites(favorites.mages, getMageById), [favorites.mages]);
  const nemeses = useMemo(() => resolveFavorites(favorites.nemeses, getNemesisById), [favorites.nemeses]);
  const cards = useMemo(() => resolveFavorites(favorites.supply, getSupplyCardById), [favorites.supply]);

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
                <h3 style={sectionHeadingStyle}>Mages ({mages.length})</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  {mages.map(mage => (
                    <MageDisplayItem
                      key={mage.id}
                      mage={mage}
                      matsVisible={visibleMats.has(mage.id)}
                      onToggleMats={() => visibleMats.toggle(mage.id)}
                      isStarterVisible={visibleStarters.has}
                      onToggleStarter={visibleStarters.toggle}
                    />
                  ))}
                </div>
              </section>
            )}

            {favorites.nemeses.length > 0 && (
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={sectionHeadingStyle}>Nemeses ({nemeses.length})</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  {nemeses.map(nemesis => (
                    <NemesisDisplayItem
                      key={nemesis.id}
                      nemesis={nemesis}
                      imagesVisible={visibleNemesisImages.has(nemesis.id)}
                      onToggleImages={() => visibleNemesisImages.toggle(nemesis.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {favorites.supply.length > 0 && (
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={sectionHeadingStyle}>Supply Cards ({cards.length})</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                  {cards.map(card => (
                    <CardDisplayItem
                      key={card.id}
                      card={card}
                      isImageVisible={visibleCardImages.has(card.id)}
                      onToggleImage={() => visibleCardImages.toggle(card.id)}
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
