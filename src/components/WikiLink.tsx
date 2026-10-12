import { CSSProperties, ReactNode } from 'react';
import { wikiPageUrl } from '../utils/wikiUrls';

export interface WikiLinkProps {
  /** Wiki page title of the record. */
  title: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Link to a record's wiki page, opened in a new tab. */
export default function WikiLink({ title, style, children }: WikiLinkProps) {
  return (
    <a href={wikiPageUrl(title)} target="_blank" rel="noopener noreferrer" style={style}>
      {children}
    </a>
  );
}
