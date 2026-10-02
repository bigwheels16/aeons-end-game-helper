import { wikiImageUrl } from '../utils/wikiUrls';

export interface WikiImageProps {
  /** Wiki image name, e.g. "Jade" or "Brama Front"; also the alt text. */
  name: string;
}

/** Lazily loaded wiki image that opens full size in a new tab. */
export default function WikiImage({ name }: WikiImageProps) {
  const url = wikiImageUrl(name);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt={name}
        loading="lazy"
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }}
      />
    </a>
  );
}
