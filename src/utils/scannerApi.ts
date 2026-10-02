import { z } from 'zod';
import { ScrapedSupplyCard } from '../types/scraped';
import { getSupplyCardByName } from './cards';

export interface ScanResult {
  /** Detected cards found in the bundled dataset, in reading order. */
  cards: ScrapedSupplyCard[];
  /** Detected names with no bundled card. */
  unmatched: string[];
  total: number;
}

/** The scan request was refused because the login is missing or has expired. */
export class ScannerAuthError extends Error {}

const ScanResponseSchema = z.object({
  detected_cards: z.array(z.object({ name: z.string() })),
  unmatched_cards: z.array(z.string()).default([]),
  total_detected: z.number().optional(),
});

const isJson = (res: Response) => (res.headers.get('content-type') ?? '').includes('application/json');

/** Login URL that returns to `returnTo`, a path on this site, afterwards. */
export const signInUrl = (returnTo: string) => `/oauth2/start?rd=${encodeURIComponent(returnTo)}`;

/** Logout URL that returns to `returnTo`, a path on this site, afterwards. */
export const signOutUrl = (returnTo: string) => `/oauth2/sign_out?rd=${encodeURIComponent(returnTo)}`;

/** True when someone is logged in to the scanner on this browser. */
export async function fetchLoggedIn(): Promise<boolean> {
  const res = await fetch('/oauth2/userinfo', { headers: { Accept: 'application/json' } });
  if (res.status === 401 || res.status === 403) return false;
  if (!res.ok) throw new Error(`Login check failed: HTTP ${res.status}`);
  // Only the login proxy's JSON user info counts as logged in, not a page served in its place
  await res.json();
  return true;
}

/** Uploads a photo to the scanner and resolves the detected names to bundled cards. */
export async function scanImage(file: File): Promise<ScanResult> {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/scan', {
    method: 'POST',
    body: formData,
    headers: { Accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403) {
    throw new ScannerAuthError('Your login has expired. Please log in again.');
  }
  if (!res.ok) {
    const detail = isJson(res) ? (await res.json())?.detail : undefined;
    throw new Error(typeof detail === 'string' ? detail : `Scan failed (HTTP ${res.status})`);
  }

  const data = ScanResponseSchema.parse(await res.json());
  const cards: ScrapedSupplyCard[] = [];
  const unmatched = [...data.unmatched_cards];
  for (const { name } of data.detected_cards) {
    const card = getSupplyCardByName(name);
    if (card) cards.push(card);
    else unmatched.push(name);
  }
  return {
    cards,
    unmatched,
    total: Math.max(data.total_detected ?? 0, data.detected_cards.length + data.unmatched_cards.length),
  };
}
