import { createClient, RedisClientType } from 'redis';
import { environment } from '../environments/environment';

export class RedisService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      socket: {
        host: environment.redis.host,
        port: environment.redis.port
      },
      password: environment.redis.password
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('❌ Redis disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.ensureConnected();
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    await this.ensureConnected();
    return await this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.ensureConnected();
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    await this.ensureConnected();
    const result = await this.client.exists(key);
    return result === 1;
  }

  async incr(key: string): Promise<number> {
    await this.ensureConnected();
    return await this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.ensureConnected();
    await this.client.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    await this.ensureConnected();
    return await this.client.ttl(key);
  }

  async setHash(key: string, field: string, value: string): Promise<void> {
    await this.ensureConnected();
    await this.client.hSet(key, field, value);
  }

  async getHash(key: string, field: string): Promise<string | undefined> {
    await this.ensureConnected();
    return await this.client.hGet(key, field);
  }

  async getAllHash(key: string): Promise<Record<string, string>> {
    await this.ensureConnected();
    return await this.client.hGetAll(key);
  }

  async delHash(key: string, field: string): Promise<void> {
    await this.ensureConnected();
    await this.client.hDel(key, field);
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  // Helper methods for common patterns
  async setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.set(key, value, ttlSeconds);
  }

  async getAndDelete(key: string): Promise<string | null> {
    await this.ensureConnected();
    const value = await this.get(key);
    if (value) {
      await this.del(key);
    }
    return value;
  }
}

// Export singleton instance
export const redisService = new RedisService();