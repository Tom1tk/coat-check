import React, { useEffect, useState } from 'react';
import { useCachedTile } from '../hooks/useCachedTile';

interface CachedTileImageProps {
  src: string;
  alt: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
}

export const CachedTileImage: React.FC<CachedTileImageProps> = ({
  src,
  alt,
  style,
  onLoad,
  onError,
}) => {
  const { src: cachedSrc, loading, error, loadTile } = useCachedTile();
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (src) {
      loadTile(src);
    }
  }, [src, loadTile]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    onLoad?.();
  };

  const handleImageError = () => {
    onError?.();
  };

  // Show loading state
  if (loading && !cachedSrc) {
    return (
      <div
        style={{
          ...style,
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: '#666',
        }}
      >
        Loading...
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div
        style={{
          ...style,
          backgroundColor: '#ffebee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: '#d32f2f',
        }}
      >
        Failed to load
      </div>
    );
  }

  // Show cached or loaded image
  if (cachedSrc) {
    return (
      <img
        src={cachedSrc}
        alt={alt}
        style={style}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    );
  }

  // Fallback to original src if caching fails
  return (
    <img
      src={src}
      alt={alt}
      style={style}
      onLoad={handleImageLoad}
      onError={handleImageError}
    />
  );
};
