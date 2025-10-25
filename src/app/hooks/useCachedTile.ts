import { useState, useCallback } from 'react';
import { tileCache } from '../utils/tileCache';

interface UseCachedTileReturn {
  src: string | null;
  loading: boolean;
  error: boolean;
  loadTile: (url: string) => Promise<void>;
}

export const useCachedTile = (): UseCachedTileReturn => {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadTile = useCallback(async (url: string) => {
    setLoading(true);
    setError(false);

    try {
      // First, try to get from cache
      const cachedBlob = await tileCache.getTile(url);
      
      if (cachedBlob) {
        // Use cached tile
        const objectUrl = URL.createObjectURL(cachedBlob);
        setSrc(objectUrl);
        setLoading(false);
        return;
      }

      // If not in cache, fetch from network
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch tile: ${response.status}`);
      }

      const blob = await response.blob();
      
      // Cache the tile for future use
      await tileCache.setTile(url, blob);
      
      // Create object URL for the image
      const objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
      
    } catch (err) {
      console.error('Failed to load tile:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  return { src, loading, error, loadTile };
};
