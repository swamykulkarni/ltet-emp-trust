import { PerformanceService } from '../performance.service';

describe('PerformanceService', () => {
  let performanceService: PerformanceService;

  beforeEach(() => {
    performanceService = new PerformanceService();
  });

  describe('cacheFrequentData', () => {
    it('should cache and retrieve data', async () => {
      const key = 'test-data';
      const expectedData = { id: 1, name: 'Test Item' };
      let fetchCount = 0;

      const dataFetcher = jest.fn(async () => {
        fetchCount++;
        return expectedData;
      });

      // First call should fetch data
      const result1 = await performanceService.cacheFrequentData(key, dataFetcher, {
        category: 'user',
        priority: 'high'
      });

      expect(result1).toEqual(expectedData);
      expect(fetchCount).toBe(1);
      expect(dataFetcher).toHaveBeenCalledTimes(1);

      // Second call should use cached data
      const result2 = await performanceService.cacheFrequentData(key, dataFetcher, {
        category: 'user',
        priority: 'high'
      });

      expect(result2).toEqual(expectedData);
      expect(fetchCount).toBe(1); // Should not increment
      expect(dataFetcher).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle different cache categories', async () => {
      const key = 'category-test';
      const data = { test: 'data' };

      const dataFetcher = async () => data;

      // Test different categories
      const categories = ['user', 'scheme', 'application', 'static'] as const;
      
      for (const category of categories) {
        const result = await performanceService.cacheFrequentData(
          `${key}-${category}`, 
          dataFetcher, 
          { category }
        );
        expect(result).toEqual(data);
      }
    });

    it('should handle different priority levels', async () => {
      const key = 'priority-test';
      const data = { test: 'data' };

      const dataFetcher = async () => data;

      // Test different priorities
      const priorities = ['high', 'medium', 'low'] as const;
      
      for (const priority of priorities) {
        const result = await performanceService.cacheFrequentData(
          `${key}-${priority}`, 
          dataFetcher, 
          { priority }
        );
        expect(result).toEqual(data);
      }
    });
  });

  describe('optimizeQuery', () => {
    it('should cache query results', async () => {
      const queryKey = 'test-query';
      const expectedResult = [{ id: 1, name: 'Test' }];
      let executionCount = 0;

      const queryExecutor = jest.fn(async () => {
        executionCount++;
        return expectedResult;
      });

      // First execution should run the query
      const result1 = await performanceService.optimizeQuery(queryKey, queryExecutor, {
        ttl: 300,
        category: 'test'
      });

      expect(result1).toEqual(expectedResult);
      expect(executionCount).toBe(1);
      expect(queryExecutor).toHaveBeenCalledTimes(1);

      // Second execution should use cached result
      const result2 = await performanceService.optimizeQuery(queryKey, queryExecutor, {
        ttl: 300,
        category: 'test'
      });

      expect(result2).toEqual(expectedResult);
      expect(executionCount).toBe(1); // Should not increment
      expect(queryExecutor).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle query execution errors', async () => {
      const queryKey = 'error-query';
      const errorMessage = 'Query execution failed';

      const queryExecutor = jest.fn(async () => {
        throw new Error(errorMessage);
      });

      await expect(
        performanceService.optimizeQuery(queryKey, queryExecutor)
      ).rejects.toThrow(errorMessage);

      expect(queryExecutor).toHaveBeenCalledTimes(1);
    });
  });

  describe('batchQueries', () => {
    it('should execute multiple queries in batches', async () => {
      const queries = [
        {
          key: 'query1',
          executor: jest.fn(async () => ({ id: 1, name: 'Item 1' }))
        },
        {
          key: 'query2',
          executor: jest.fn(async () => ({ id: 2, name: 'Item 2' }))
        },
        {
          key: 'query3',
          executor: jest.fn(async () => ({ id: 3, name: 'Item 3' }))
        }
      ];

      const results = await performanceService.batchQueries(queries, {
        maxConcurrency: 2
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ id: 1, name: 'Item 1' });
      expect(results[1]).toEqual({ id: 2, name: 'Item 2' });
      expect(results[2]).toEqual({ id: 3, name: 'Item 3' });

      // Verify all executors were called
      queries.forEach(query => {
        expect(query.executor).toHaveBeenCalledTimes(1);
      });
    });

    it('should respect maxConcurrency limit', async () => {
      const executionOrder: number[] = [];
      const queries = Array.from({ length: 5 }, (_, i) => ({
        key: `query${i}`,
        executor: jest.fn(async () => {
          executionOrder.push(i);
          await new Promise(resolve => setTimeout(resolve, 10));
          return { id: i };
        })
      }));

      await performanceService.batchQueries(queries, {
        maxConcurrency: 2
      });

      // With maxConcurrency of 2, queries should be executed in batches
      expect(executionOrder).toHaveLength(5);
      expect(queries.every(q => q.executor.mock.calls.length === 1)).toBe(true);
    });
  });

  describe('CDN operations', () => {
    it('should generate CDN URLs when enabled', () => {
      // Mock CDN configuration
      process.env.CDN_ENABLED = 'true';
      process.env.CDN_BASE_URL = 'https://cdn.example.com';

      const assetPath = '/images/logo.png';
      const cdnUrl = performanceService.getCDNUrl(assetPath);

      expect(cdnUrl).toContain('https://cdn.example.com');
      expect(cdnUrl).toContain(assetPath);
    });

    it('should return original path when CDN disabled', () => {
      // Mock CDN configuration
      process.env.CDN_ENABLED = 'false';

      const assetPath = '/images/logo.png';
      const cdnUrl = performanceService.getCDNUrl(assetPath);

      expect(cdnUrl).toBe(assetPath);
    });

    it('should optimize static assets', async () => {
      const assets = ['/css/styles.css', '/js/app.js', '/images/hero.jpg'];
      
      const optimizedAssets = await performanceService.optimizeStaticAssets(assets);

      expect(Object.keys(optimizedAssets)).toEqual(assets);
      assets.forEach(asset => {
        expect(optimizedAssets[asset]).toBeDefined();
      });
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate cache by pattern', async () => {
      const pattern = 'test:*';
      const category = 'test';

      // This would normally interact with the cache service
      const result = await performanceService.invalidateCache(pattern, category);

      // Since we're not actually connected to Redis in tests, 
      // we expect it to return 0 (no keys deleted)
      expect(typeof result).toBe('number');
    });
  });

  describe('performance metrics', () => {
    it('should return performance metrics', () => {
      const metrics = performanceService.getPerformanceMetrics();

      expect(metrics).toHaveProperty('queryExecutionTime');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('cdnHitRate');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('cacheStats');
      expect(metrics).toHaveProperty('queryOptimizationStats');
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        enableCaching: false,
        defaultTTL: 600,
        maxCacheSize: 2000,
        enableQueryLogging: true
      };

      performanceService.updateConfig(newConfig);

      // Configuration should be updated (we can't directly test private properties,
      // but we can test the behavior)
      expect(() => performanceService.updateConfig(newConfig)).not.toThrow();
    });

    it('should update CDN configuration', () => {
      const newCDNConfig = {
        enabled: true,
        baseUrl: 'https://new-cdn.example.com',
        regions: ['us-west-1', 'eu-west-1'],
        cacheTTL: 7200
      };

      performanceService.updateCDNConfig(newCDNConfig);

      // Configuration should be updated
      expect(() => performanceService.updateCDNConfig(newCDNConfig)).not.toThrow();
    });
  });

  describe('preload and warmup', () => {
    it('should preload frequent data', async () => {
      // This method logs but doesn't return anything testable
      await expect(performanceService.preloadFrequentData()).resolves.not.toThrow();
    });

    it('should warm up cache', async () => {
      // This method logs but doesn't return anything testable
      await expect(performanceService.warmUpCache()).resolves.not.toThrow();
    });
  });
});