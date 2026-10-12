import { wikiImageUrl } from '../utils/wikiUrls';

export interface WikiImageProps {
  /** Wiki image file name, e.g. "Jade.jpg" or "Brama_Front.jpg". */
  file: string;
}

/** Lazily loaded wiki image that opens full size in a new tab; the alt text is the file name without its extension. */
export default function WikiImage({ file }: WikiImageProps) {
  const url = wikiImageUrl(file);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt={file.replace(/\.[^.]*$/, '').replace(/_/g, ' ')}
        loading="lazy"
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }}
      />
    </a>
  );
}
