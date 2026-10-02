import { CSSProperties } from 'react';
import { sanitizeScrapedHtml } from '../utils/sanitizeHtml';
import styles from './ScrapedHtml.module.css';

export interface ScrapedHtmlProps {
  html: string | undefined;
  style?: CSSProperties;
}

/**
 * The single place that renders wiki effect/rules HTML. The markup is passed through the
 * allowlist sanitizer and handed to the DOM unchanged; the container must stay a plain <div>.
 */
export default function ScrapedHtml({ html, style }: ScrapedHtmlProps) {
  return (
    <div
      className={styles.scrapedHtml}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitizeScrapedHtml(html) }}
    />
  );
}
