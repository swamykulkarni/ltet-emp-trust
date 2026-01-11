import { createClient } from 'redis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
}

/**
 * Redis-based caching service for LTET Employee Trust Portal
 * Provides high-performance caching with TTL support and cache statistics
 */
export class CacheService {
  private client: ReturnType<typeof createClient>;
  private isConnected: boolean = false;
  private stats = {
    hits: 0,
    misses: 0
  };

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000
      }
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('Redis Client Disconnected');
      this.isConnected = false;
    });
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      await this.connect();
      
      const fullKey = this.buildKey(key, options.prefix);
      const value = await this.client.get(fullKey);
      
      if (value !== null) {
        this.stats.hits++;
        return JSON.parse(value);
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      await this.connect();
      
      const fullKey = this.buildKey(key, options.prefix);
      const serializedValue = JSON.stringify(value);
      
      if (options.ttl) {
        await this.client.setEx(fullKey, options.ttl, serializedValue);
      } else {
        await this.client.set(fullKey, serializedValue);
      }
      
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      await this.connect();
      
      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.client.del(fullKey);
      
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      await this.connect();
      
      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.client.exists(fullKey);
      
      return result > 0;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    try {
      await this.connect();
      
      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.client.expire(fullKey, ttl);
      
      return result;
    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    try {
      await this.connect();
      
      const fullKeys = keys.map(key => this.buildKey(key, options.prefix));
      const values = await this.client.mGet(fullKeys);
      
      return values.map(value => {
        if (value !== null) {
          this.stats.hits++;
          return JSON.parse(value);
        } else {
          this.stats.misses++;
          return null;
        }
      });
    } catch (error) {
      console.error('Cache mget error:', error);
      this.stats.misses += keys.length;
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(keyValuePairs: Array<{ key: string; value: T; ttl?: number }>, options: CacheOptions = {}): Promise<boolean> {
    try {
      await this.connect();
      
      const pipeline = this.client.multi();
      
      for (const pair of keyValuePairs) {
        const fullKey = this.buildKey(pair.key, options.prefix);
        const serializedValue = JSON.stringify(pair.value);
        
        if (pair.ttl) {
          pipeline.setEx(fullKey, pair.ttl, serializedValue);
        } else {
          pipeline.set(fullKey, serializedValue);
        }
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Delete keys by pattern
   */
  async deleteByPattern(pattern: string, options: CacheOptions = {}): Promise<number> {
    try {
      await this.connect();
      
      const fullPattern = this.buildKey(pattern, options.prefix);
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length > 0) {
        const result = await this.client.del(keys);
        return result;
      }
      
      return 0;
    } catch (error) {
      console.error('Cache deleteByPattern error:', error);
      return 0;
    }
  }

  /**
   * Increment a numeric value in cache
   */
  async increment(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
    try {
      await this.connect();
      
      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.client.incrBy(fullKey, amount);
      
      if (options.ttl) {
        await this.client.expire(fullKey, options.ttl);
      }
      
      return result;
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * Add item to a set
   */
  async sadd(key: string, members: string[], options: CacheOptions = {}): Promise<number> {
    try {
      await this.connect();
      
      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.client.sAdd(fullKey, members);
      
      if (options.ttl) {
        await this.client.expire(fullKey, options.ttl);
      }
      
      return result;
    } catch (error) {
      console.error('Cache sadd error:', error);
      return 0;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string, options: CacheOptions = {}): Promise<string[]> {
    try {
      await this.connect();
      
      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.client.sMembers(fullKey);
      
      return result;
    } catch (error) {
      console.error('Cache smembers error:', error);
      return [];
    }
  }

  /**
   * Check if member exists in set
   */
  async sismember(key: string, member: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      await this.connect();
      
      const fullKey = this.buildKey(key, options.prefix);
      const result = await this.client.sIsMember(fullKey, member);
      
      return result;
    } catch (error) {
      console.error('Cache sismember error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      await this.connect();
      
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      // Parse memory usage from info
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0;
      
      // Parse total keys from keyspace info
      const keysMatch = keyspace.match(/keys=(\d+)/);
      const totalKeys = keysMatch ? parseInt(keysMatch[1]) : 0;
      
      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
      
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        totalKeys,
        memoryUsage
      };
    } catch (error) {
      console.error('Cache getStats error:', error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: 0,
        totalKeys: 0,
        memoryUsage: 0
      };
    }
  }

  /**
   * Clear all cache statistics
   */
  clearStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Flush all cache data
   */
  async flushAll(): Promise<boolean> {
    try {
      await this.connect();
      await this.client.flushAll();
      return true;
    } catch (error) {
      console.error('Cache flushAll error:', error);
      return false;
    }
  }

  /**
   * Build full cache key with optional prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const basePrefix = 'ltet:';
    const fullPrefix = prefix ? `${basePrefix}${prefix}:` : basePrefix;
    return `${fullPrefix}${key}`;
  }

  /**
   * Get Redis client for advanced operations
   */
  getClient(): ReturnType<typeof createClient> {
    return this.client;
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
    try {
      const start = Date.now();
      await this.connect();
      await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency
      };
    } catch (error) {
      return {
        status: 'unhealthy'
      };
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();