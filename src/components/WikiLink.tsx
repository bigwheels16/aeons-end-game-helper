import { CSSProperties, ReactNode } from 'react';

export interface WikiLinkProps {
  /** Wiki page URL of the record. */
  url: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Link to a record's wiki page, opened in a new tab. */
export default function WikiLink({ url, style, children }: WikiLinkProps) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={style}>
      {children}
    </a>
  );
}
