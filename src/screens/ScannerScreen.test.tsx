import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ScannerScreen from './ScannerScreen';

vi.mock('../../data/scraped/aeons_end_all.json', () => ({
  default: {
    supply: [
      { id: 'supply:jade', name: 'Jade', type: 'Gem', expansions: ['Base'], cost: '2', effect: 'Gain 2 aether.', page_url: 'https://aeonsend.wiki.gg/wiki/Jade' },
      { id: 'supply:ruby', name: 'Ruby', type: 'Gem', expansions: ['Base'], cost: '4', effect: 'Gain 3 aether.', page_url: 'https://aeonsend.wiki.gg/wiki/Ruby' },
      { id: 'supply:spark', name: 'Spark', type: 'Spell', expansions: ['Promo'], cost: '1', effect: 'Deal 1 damage.', page_url: 'https://aeonsend.wiki.gg/wiki/Spark' },
      { id: 'supply:opal', name: 'Opal', type: 'Gem', expansions: ['Base'], cost: '4', effect: 'Gain 3 aether.', page_url: 'https://aeonsend.wiki.gg/wiki/Opal' },
    ],
    unique_starters: [],
    mages: [],
    nemeses: [],
  },
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Routes fetch calls by path; anything else fails the test. */
function mockFetch(routes: Record<string, () => Response>) {
  const fn = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const path = String(input);
    const route = routes[path];
    if (!route) throw new Error(`Unexpected fetch: ${path}`);
    return route();
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const cardsParam = () => new URLSearchParams(window.location.search).get('cards');

const tileNames = () =>
  screen.queryAllByRole('button', { name: /^Remove / }).map((b) => b.getAttribute('aria-label')!.replace('Remove ', ''));

describe('ScannerScreen', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/#scanner');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restores the supply from the URL, skipping unknown ids, and keeps the URL in sync', async () => {
    mockFetch({ '/oauth2/userinfo': () => json({}, 401) });
    window.history.replaceState(null, '', '/?cards=supply:ruby,supply:nope,supply:jade#scanner');

    render(<ScannerScreen />);

    expect(tileNames()).toEqual(['Ruby', 'Jade']);
    await waitFor(() => expect(cardsParam()).toBe('supply:ruby,supply:jade'));
    expect(window.location.hash).toBe('#scanner');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Ruby' }));
    expect(cardsParam()).toBe('supply:jade');

    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    expect(cardsParam()).toBeNull();
  });

  it('drops the supply from the URL when leaving the screen', () => {
    mockFetch({ '/oauth2/userinfo': () => json({}, 401) });
    window.history.replaceState(null, '', '/?cards=supply:ruby#scanner');

    const { unmount } = render(<ScannerScreen />);
    unmount();

    expect(cardsParam()).toBeNull();
  });

  it('offers a login that returns to the current supply when logged out', async () => {
    mockFetch({ '/oauth2/userinfo': () => json({}, 401) });
    window.history.replaceState(null, '', '/?cards=supply:jade,supply:ruby#scanner');

    render(<ScannerScreen />);

    const login = screen.getByRole('link', { name: 'Log in' });
    expect(login.getAttribute('href')).toBe(
      `/oauth2/start?rd=${encodeURIComponent('/?cards=supply%3Ajade%2Csupply%3Aruby#scanner')}`,
    );
    expect(screen.queryByRole('button', { name: 'Scan a Photo' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Ruby' }));
    expect(login.getAttribute('href')).toBe(`/oauth2/start?rd=${encodeURIComponent('/?cards=supply%3Ajade#scanner')}`);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it.each([
    ['an error status', () => new Response('', { status: 404 })],
    ['a page instead of JSON', () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } })],
    ['no response', () => { throw new TypeError('Failed to fetch'); }],
  ])('still offers the login when the login check gets %s', async (_, response) => {
    mockFetch({ '/oauth2/userinfo': response });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ScannerScreen />);

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Login check failed', expect.any(Error)));
    expect(screen.getByRole('link', { name: 'Log in' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Scan a Photo' })).toBeNull();
    consoleError.mockRestore();
  });

  it('adds scanned cards after the supply from highest to lowest cost, keeping photo order for equal costs', async () => {
    const fetchMock = mockFetch({
      '/oauth2/userinfo': () => json({ email: 'player@example.com' }),
      '/api/scan': () =>
        json({
          detected_cards: [{ name: 'Spark' }, { name: 'Ruby' }, { name: 'Not In Bundle' }, { name: 'Opal' }],
          unmatched_cards: ['Blurry'],
          total_detected: 5,
        }),
    });
    window.history.replaceState(null, '', '/?cards=supply:spark#scanner');

    render(<ScannerScreen />);
    const logout = await screen.findByRole('link', { name: 'Log out' });
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
    expect(screen.queryByText(/player@example\.com/)).toBeNull();

    const photo = new File(['jpeg'], 'supply.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('scan-file-input'), { target: { files: [photo] } });

    await waitFor(() => expect(tileNames()).toEqual(['Spark', 'Ruby', 'Opal', 'Spark']));
    expect(cardsParam()).toBe('supply:spark,supply:ruby,supply:opal,supply:spark');
    expect(logout.getAttribute('href')).toBe(
      `/oauth2/sign_out?rd=${encodeURIComponent('/?cards=supply%3Aspark%2Csupply%3Aruby%2Csupply%3Aopal%2Csupply%3Aspark#scanner')}`,
    );

    const [, init] = fetchMock.mock.calls.find(([path]) => path === '/api/scan')!;
    expect(init?.method).toBe('POST');
    expect((init?.body as FormData).get('image')).toBe(photo);
  });

  it('switches to the login prompt when a scan is refused for an expired login', async () => {
    mockFetch({
      '/oauth2/userinfo': () => json({ email: 'player@example.com' }),
      '/api/scan': () => json({}, 401),
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ScannerScreen />);
    await screen.findByRole('link', { name: 'Log out' });

    const photo = new File(['jpeg'], 'supply.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('scan-file-input'), { target: { files: [photo] } });

    expect(await screen.findByRole('link', { name: 'Log in' })).toBeDefined();
    expect(tileNames()).toEqual([]);
    consoleError.mockRestore();
  });

  it('adds cards by hand at the end without sorting, and swaps them in place', async () => {
    mockFetch({ '/oauth2/userinfo': () => json({}, 401) });
    render(<ScannerScreen />);
    await screen.findByRole('link', { name: 'Log in' });

    const pick = (query: string, name: RegExp) => {
      fireEvent.change(screen.getByPlaceholderText('Search by card name...'), { target: { value: query } });
      fireEvent.click(screen.getByRole('button', { name }));
    };

    fireEvent.click(screen.getByRole('button', { name: '+ Add Card' }));
    pick('spark', /^Spark/);
    fireEvent.click(screen.getByRole('button', { name: '+ Add Card' }));
    pick('ru', /^Ruby/);
    expect(tileNames()).toEqual(['Spark', 'Ruby']);

    fireEvent.click(screen.getByRole('button', { name: 'Swap Spark' }));
    expect(screen.getByRole('heading', { name: 'Swap Card' })).toBeDefined();
    pick('opal', /^Opal/);

    expect(tileNames()).toEqual(['Opal', 'Ruby']);
    expect(cardsParam()).toBe('supply:opal,supply:ruby');
  });
});
