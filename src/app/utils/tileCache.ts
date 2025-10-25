// Tile caching utilities for base map tiles
const CACHE_NAME = 'coat-check-map-tiles';
const CACHE_VERSION = '1.0';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB limit

interface CachedTile {
  url: string;
  blob: Blob;
  timestamp: number;
  size: number;
}

class TileCache {
  private cache: Cache | null = null;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    try {
      // Initialize Cache API
      this.cache = await caches.open(`${CACHE_NAME}-${CACHE_VERSION}`);
      
      // Initialize IndexedDB for metadata
      await this.initIndexedDB();
    } catch (error) {
      console.warn('Failed to initialize tile cache:', error);
    }
  }

  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('TileCacheDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('tiles')) {
          const store = db.createObjectStore('tiles', { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async getTile(url: string): Promise<Blob | null> {
    if (!this.cache) return null;

    try {
      // First check Cache API
      const response = await this.cache.match(url);
      if (response) {
        return await response.blob();
      }

      // Check IndexedDB as fallback
      if (this.db) {
        const transaction = this.db.transaction(['tiles'], 'readonly');
        const store = transaction.objectStore('tiles');
        const request = store.get(url);
        
        return new Promise((resolve) => {
          request.onsuccess = () => {
            const result = request.result as CachedTile | undefined;
            if (result && result.blob) {
              resolve(result.blob);
            } else {
              resolve(null);
            }
          };
          request.onerror = () => resolve(null);
        });
      }
    } catch (error) {
      console.warn('Failed to get cached tile:', error);
    }

    return null;
  }

  async setTile(url: string, blob: Blob): Promise<void> {
    if (!this.cache) return;

    try {
      // Store in Cache API
      const response = new Response(blob, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'max-age=86400', // 24 hours
        },
      });
      await this.cache.put(url, response);

      // Store metadata in IndexedDB
      if (this.db) {
        const transaction = this.db.transaction(['tiles'], 'readwrite');
        const store = transaction.objectStore('tiles');
        const tileData: CachedTile = {
          url,
          blob,
          timestamp: Date.now(),
          size: blob.size,
        };
        await store.put(tileData);
      }

      // Clean up old tiles if cache is too large
      await this.cleanupCache();
    } catch (error) {
      console.warn('Failed to cache tile:', error);
    }
  }

  private async cleanupCache(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(['tiles'], 'readwrite');
      const store = transaction.objectStore('tiles');
      const index = store.index('timestamp');
      
      // Get all tiles sorted by timestamp
      const request = index.getAll();
      
      request.onsuccess = async () => {
        const tiles = request.result as CachedTile[];
        let totalSize = tiles.reduce((sum, tile) => sum + tile.size, 0);
        
        // Remove oldest tiles if cache exceeds limit
        if (totalSize > MAX_CACHE_SIZE) {
          const tilesToRemove = [];
          for (const tile of tiles) {
            tilesToRemove.push(tile);
            totalSize -= tile.size;
            if (totalSize <= MAX_CACHE_SIZE * 0.8) break; // Remove until 80% of limit
          }
          
          for (const tile of tilesToRemove) {
            await store.delete(tile.url);
            if (this.cache) {
              await this.cache.delete(tile.url);
            }
          }
        }
      };
    } catch (error) {
      console.warn('Failed to cleanup cache:', error);
    }
  }

  async clearCache(): Promise<void> {
    try {
      if (this.cache) {
        await this.cache.delete(`${CACHE_NAME}-${CACHE_VERSION}`);
      }
      
      if (this.db) {
        const transaction = this.db.transaction(['tiles'], 'readwrite');
        const store = transaction.objectStore('tiles');
        await store.clear();
      }
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }
}

// Singleton instance
export const tileCache = new TileCache();

// Initialize cache on module load
if (typeof window !== 'undefined') {
  tileCache.init();
}
