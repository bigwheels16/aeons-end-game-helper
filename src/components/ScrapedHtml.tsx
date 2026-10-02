import { CSSProperties } from 'react';
import styles from './ScrapedHtml.module.css';

export interface ScrapedHtmlProps {
  html: string | undefined;
  style?: CSSProperties;
}

/** Renders effect/rules HTML. */
export default function ScrapedHtml({ html, style }: ScrapedHtmlProps) {
  return <div className={styles.scrapedHtml} style={style} dangerouslySetInnerHTML={{ __html: html ?? '' }} />;
}
