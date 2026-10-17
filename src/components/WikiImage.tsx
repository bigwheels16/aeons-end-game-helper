import { imageUrl } from '../utils/wikiUrls';

export interface WikiImageProps {
  /** Image file name from the dataset, e.g. "Jade.webp" or "Brama_Front.webp". */
  name: string;
}

/** Lazily loaded hosted image that opens on its own in a new tab; the alt text is the name without its extension, with spaces for underscores. */
export default function WikiImage({ name }: WikiImageProps) {
  const url = imageUrl(name);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt={name.replace(/\.[^.]*$/, '').replace(/_/g, ' ')}
        loading="lazy"
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }}
      />
    </a>
  );
}
