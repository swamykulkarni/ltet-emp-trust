import { CacheService } from '../cache.service';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService();
  });

  afterEach(async () => {
    await cacheService.disconnect();
  });

  describe('basic operations', () => {
    it('should set and get a value', async () => {
      const key = 'test-key';
      const value = { message: 'Hello, World!' };

      const setResult = await cacheService.set(key, value);
      expect(setResult).toBe(true);

      const getValue = await cacheService.get(key);
      expect(getValue).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const getValue = await cacheService.get('non-existent-key');
      expect(getValue).toBeNull();
    });

    it('should delete a key', async () => {
      const key = 'delete-test';
      const value = 'test-value';

      await cacheService.set(key, value);
      const deleteResult = await cacheService.delete(key);
      expect(deleteResult).toBe(true);

      const getValue = await cacheService.get(key);
      expect(getValue).toBeNull();
    });

    it('should check if key exists', async () => {
      const key = 'exists-test';
      const value = 'test-value';

      let exists = await cacheService.exists(key);
      expect(exists).toBe(false);

      await cacheService.set(key, value);
      exists = await cacheService.exists(key);
      expect(exists).toBe(true);
    });
  });

  describe('TTL operations', () => {
    it('should set value with TTL', async () => {
      const key = 'ttl-test';
      const value = 'test-value';
      const ttl = 1; // 1 second

      await cacheService.set(key, value, { ttl });
      
      let getValue = await cacheService.get(key);
      expect(getValue).toBe(value);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      getValue = await cacheService.get(key);
      expect(getValue).toBeNull();
    });

    it('should set expiration for existing key', async () => {
      const key = 'expire-test';
      const value = 'test-value';

      await cacheService.set(key, value);
      const expireResult = await cacheService.expire(key, 1);
      expect(expireResult).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const getValue = await cacheService.get(key);
      expect(getValue).toBeNull();
    });
  });

  describe('bulk operations', () => {
    it('should get multiple values', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = ['value1', 'value2', 'value3'];

      // Set values
      for (let i = 0; i < keys.length; i++) {
        await cacheService.set(keys[i], values[i]);
      }

      const getValues = await cacheService.mget(keys);
      expect(getValues).toEqual(values);
    });

    it('should set multiple values', async () => {
      const keyValuePairs = [
        { key: 'mset1', value: 'value1' },
        { key: 'mset2', value: 'value2' },
        { key: 'mset3', value: 'value3' }
      ];

      const setResult = await cacheService.mset(keyValuePairs);
      expect(setResult).toBe(true);

      // Verify values were set
      for (const pair of keyValuePairs) {
        const getValue = await cacheService.get(pair.key);
        expect(getValue).toBe(pair.value);
      }
    });
  });

  describe('set operations', () => {
    it('should add members to set', async () => {
      const key = 'test-set';
      const members = ['member1', 'member2', 'member3'];

      const addResult = await cacheService.sadd(key, members);
      expect(addResult).toBeGreaterThan(0);

      const setMembers = await cacheService.smembers(key);
      expect(setMembers).toEqual(expect.arrayContaining(members));
    });

    it('should check set membership', async () => {
      const key = 'membership-test';
      const member = 'test-member';

      await cacheService.sadd(key, [member]);
      
      const isMember = await cacheService.sismember(key, member);
      expect(isMember).toBe(true);

      const isNotMember = await cacheService.sismember(key, 'non-member');
      expect(isNotMember).toBe(false);
    });
  });

  describe('increment operations', () => {
    it('should increment numeric value', async () => {
      const key = 'counter';

      const result1 = await cacheService.increment(key, 1);
      expect(result1).toBe(1);

      const result2 = await cacheService.increment(key, 5);
      expect(result2).toBe(6);
    });
  });

  describe('pattern operations', () => {
    it('should delete keys by pattern', async () => {
      const keys = ['test:1', 'test:2', 'other:1'];
      
      // Set test keys
      for (const key of keys) {
        await cacheService.set(key, 'value');
      }

      // Delete keys matching pattern
      const deletedCount = await cacheService.deleteByPattern('test:*');
      expect(deletedCount).toBe(2);

      // Verify only matching keys were deleted
      const testKey1 = await cacheService.get('test:1');
      const testKey2 = await cacheService.get('test:2');
      const otherKey = await cacheService.get('other:1');

      expect(testKey1).toBeNull();
      expect(testKey2).toBeNull();
      expect(otherKey).toBe('value');
    });
  });

  describe('statistics', () => {
    it('should track cache statistics', async () => {
      // Perform some operations to generate stats
      await cacheService.set('stats-test', 'value');
      await cacheService.get('stats-test'); // Hit
      await cacheService.get('non-existent'); // Miss

      const stats = await cacheService.getStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('totalKeys');
      expect(stats).toHaveProperty('memoryUsage');
      
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
    });

    it('should clear statistics', async () => {
      // Generate some stats
      await cacheService.get('test');
      
      cacheService.clearStats();
      
      const stats = await cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('health check', () => {
    it('should perform health check', async () => {
      const health = await cacheService.healthCheck();
      
      expect(health).toHaveProperty('status');
      expect(['healthy', 'unhealthy']).toContain(health.status);
      
      if (health.status === 'healthy') {
        expect(health).toHaveProperty('latency');
        expect(typeof health.latency).toBe('number');
      }
    });
  });
});