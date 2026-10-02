import { CSSProperties, ReactNode } from 'react';
import { safeWikiHref, wikiPageUrl } from '../utils/wikiUrls';

export interface WikiLinkProps {
  /** Scraped page URL. When present it must pass the allowlist; it never falls back to the name. */
  url: string | undefined;
  /** Record name: used to build a link only when `url` is absent, and as the warning label. */
  fallbackName: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * The single place that turns data-derived wiki URLs into links. Renders an
 * `<a target="_blank" rel="noopener noreferrer">` with the allowlisted, normalized href, or
 * plain text (no link) when the URL is rejected. A rejected URL is logged with the record name
 * only, never the URL value.
 */
export default function WikiLink({ url, fallbackName, style, children }: WikiLinkProps) {
  const href = safeWikiHref(url !== undefined ? url : wikiPageUrl(fallbackName));
  if (href === null) {
    console.warn(`Wiki link for "${fallbackName}" was rejected by the URL allowlist; rendering text only`);
    return <span>{children}</span>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={style}>
      {children}
    </a>
  );
}
