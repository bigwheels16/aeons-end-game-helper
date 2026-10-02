import { CSSProperties, ReactNode } from 'react';
import { wikiPageUrl } from '../utils/wikiUrls';

export interface WikiLinkProps {
  /** Wiki page URL of the record. */
  url: string | undefined;
  /** Record name: used to build the link when `url` is absent. */
  fallbackName: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Link to a record's wiki page, opened in a new tab. */
export default function WikiLink({ url, fallbackName, style, children }: WikiLinkProps) {
  return (
    <a href={url ?? wikiPageUrl(fallbackName)} target="_blank" rel="noopener noreferrer" style={style}>
      {children}
    </a>
  );
}
