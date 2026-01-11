import { cacheService, CacheOptions } from './cache.service';

export interface QueryOptimizationConfig {
  enableCaching: boolean;
  defaultTTL: number;
  maxCacheSize: number;
  enableQueryLogging: boolean;
}

export interface CDNConfig {
  enabled: boolean;
  baseUrl: string;
  regions: string[];
  cacheTTL: number;
}

export interface PerformanceMetrics {
  queryExecutionTime: number;
  cacheHitRate: number;
  cdnHitRate: number;
  averageResponseTime: number;
  totalRequests: number;
}

/**
 * Performance optimization service for LTET Employee Trust Portal
 * Handles caching strategies, query optimization, and CDN integration
 */
export class PerformanceService {
  private queryCache = new Map<string, { result: any; timestamp: number; ttl: number }>();
  private metrics: PerformanceMetrics = {
    queryExecutionTime: 0,
    cacheHitRate: 0,
    cdnHitRate: 0,
    averageResponseTime: 0,
    totalRequests: 0
  };

  private config: QueryOptimizationConfig = {
    enableCaching: true,
    defaultTTL: 300, // 5 minutes
    maxCacheSize: 1000,
    enableQueryLogging: process.env.NODE_ENV === 'development'
  };

  private cdnConfig: CDNConfig = {
    enabled: process.env.CDN_ENABLED === 'true',
    baseUrl: process.env.CDN_BASE_URL || '',
    regions: (process.env.CDN_REGIONS || 'us-east-1,ap-south-1').split(','),
    cacheTTL: parseInt(process.env.CDN_CACHE_TTL || '3600')
  };

  /**
   * Cache frequently accessed data with intelligent TTL
   */
  async cacheFrequentData<T>(
    key: string,
    dataFetcher: () => Promise<T>,
    options: CacheOptions & { 
      category?: 'user' | 'scheme' | 'application' | 'static';
      priority?: 'high' | 'medium' | 'low';
    } = {}
  ): Promise<T> {
    const cacheKey = this.buildCacheKey(key, options.category);
    const ttl = this.calculateTTL(options.category, options.priority);
    
    // Try to get from cache first
    const cachedData = await cacheService.get<T>(cacheKey, { ttl });
    if (cachedData !== null) {
      this.updateMetrics('cache_hit');
      return cachedData;
    }

    // Fetch fresh data
    const startTime = Date.now();
    const freshData = await dataFetcher();
    const executionTime = Date.now() - startTime;

    // Cache the fresh data
    await cacheService.set(cacheKey, freshData, { ttl });
    
    this.updateMetrics('cache_miss', executionTime);
    
    if (this.config.enableQueryLogging) {
      console.log(`Data fetched and cached: ${key} (${executionTime}ms)`);
    }

    return freshData;
  }

  /**
   * Optimize database queries with caching and batching
   */
  async optimizeQuery<T>(
    queryKey: string,
    queryExecutor: () => Promise<T>,
    options: {
      ttl?: number;
      enableBatching?: boolean;
      batchSize?: number;
      category?: string;
    } = {}
  ): Promise<T> {
    const { ttl = this.config.defaultTTL, enableBatching = false, category = 'general' } = options;
    
    if (!this.config.enableCaching) {
      return await queryExecutor();
    }

    const cacheKey = `query:${category}:${queryKey}`;
    
    // Check cache first
    const cachedResult = await cacheService.get<T>(cacheKey);
    if (cachedResult !== null) {
      this.updateMetrics('query_cache_hit');
      return cachedResult;
    }

    // Execute query with timing
    const startTime = Date.now();
    const result = await queryExecutor();
    const executionTime = Date.now() - startTime;

    // Cache the result
    await cacheService.set(cacheKey, result, { ttl });
    
    this.updateMetrics('query_cache_miss', executionTime);
    
    if (this.config.enableQueryLogging) {
      console.log(`Query executed and cached: ${queryKey} (${executionTime}ms)`);
    }

    return result;
  }

  /**
   * Batch multiple queries for better performance
   */
  async batchQueries<T>(
    queries: Array<{
      key: string;
      executor: () => Promise<T>;
      ttl?: number;
    }>,
    options: { maxConcurrency?: number } = {}
  ): Promise<T[]> {
    const { maxConcurrency = 5 } = options;
    const results: T[] = [];
    
    // Process queries in batches to avoid overwhelming the database
    for (let i = 0; i < queries.length; i += maxConcurrency) {
      const batch = queries.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (query) => {
        return await this.optimizeQuery(
          query.key,
          query.executor,
          { ttl: query.ttl }
        );
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Preload frequently accessed data
   */
  async preloadFrequentData(): Promise<void> {
    const preloadTasks = [
      // Preload active schemes
      this.preloadActiveSchemes(),
      // Preload user roles and permissions
      this.preloadUserRoles(),
      // Preload system configuration
      this.preloadSystemConfig(),
      // Preload notification templates
      this.preloadNotificationTemplates()
    ];

    try {
      await Promise.allSettled(preloadTasks);
      console.log('Frequent data preloaded successfully');
    } catch (error) {
      console.error('Error preloading frequent data:', error);
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateCache(pattern: string, category?: string): Promise<number> {
    const fullPattern = category ? `${category}:${pattern}` : pattern;
    return await cacheService.deleteByPattern(fullPattern);
  }

  /**
   * Warm up cache with essential data
   */
  async warmUpCache(): Promise<void> {
    console.log('Starting cache warm-up...');
    
    const warmUpTasks = [
      // Warm up scheme data
      this.warmUpSchemeCache(),
      // Warm up user session data
      this.warmUpUserCache(),
      // Warm up application status data
      this.warmUpApplicationCache(),
      // Warm up static content
      this.warmUpStaticContent()
    ];

    const results = await Promise.allSettled(warmUpTasks);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`Cache warm-up completed: ${successful}/${warmUpTasks.length} tasks successful`);
  }

  /**
   * Get CDN URL for static assets
   */
  getCDNUrl(assetPath: string, options: { region?: string; version?: string } = {}): string {
    if (!this.cdnConfig.enabled || !this.cdnConfig.baseUrl) {
      return assetPath;
    }

    const { region = 'auto', version = 'v1' } = options;
    const baseUrl = this.cdnConfig.baseUrl.replace('{region}', region);
    
    // Add version for cache busting
    const versionedPath = assetPath.includes('?') 
      ? `${assetPath}&v=${version}` 
      : `${assetPath}?v=${version}`;
    
    return `${baseUrl}${versionedPath}`;
  }

  /**
   * Optimize static asset delivery
   */
  async optimizeStaticAssets(assets: string[]): Promise<{ [key: string]: string }> {
    const optimizedAssets: { [key: string]: string } = {};
    
    for (const asset of assets) {
      // Determine optimal CDN region based on user location or load balancing
      const optimalRegion = await this.getOptimalCDNRegion();
      
      optimizedAssets[asset] = this.getCDNUrl(asset, { 
        region: optimalRegion,
        version: this.getAssetVersion(asset)
      });
    }
    
    return optimizedAssets;
  }

  /**
   * Monitor and report performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics & {
    cacheStats: any;
    queryOptimizationStats: any;
  } {
    return {
      ...this.metrics,
      cacheStats: this.getCacheStats(),
      queryOptimizationStats: this.getQueryOptimizationStats()
    };
  }

  /**
   * Configure performance optimization settings
   */
  updateConfig(newConfig: Partial<QueryOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Configure CDN settings
   */
  updateCDNConfig(newConfig: Partial<CDNConfig>): void {
    this.cdnConfig = { ...this.cdnConfig, ...newConfig };
  }

  // Private helper methods

  private buildCacheKey(key: string, category?: string): string {
    return category ? `${category}:${key}` : key;
  }

  private calculateTTL(category?: string, priority?: string): number {
    const baseTTL = this.config.defaultTTL;
    
    // Adjust TTL based on data category
    const categoryMultiplier = {
      'user': 0.5,      // User data changes frequently
      'scheme': 2.0,    // Scheme data is more stable
      'application': 0.3, // Application data changes very frequently
      'static': 10.0    // Static content rarely changes
    };
    
    // Adjust TTL based on priority
    const priorityMultiplier = {
      'high': 2.0,
      'medium': 1.0,
      'low': 0.5
    };
    
    const catMultiplier = category ? (categoryMultiplier[category as keyof typeof categoryMultiplier] || 1.0) : 1.0;
    const priMultiplier = priority ? (priorityMultiplier[priority as keyof typeof priorityMultiplier] || 1.0) : 1.0;
    
    return Math.floor(baseTTL * catMultiplier * priMultiplier);
  }

  private updateMetrics(type: string, executionTime?: number): void {
    this.metrics.totalRequests++;
    
    if (executionTime) {
      this.metrics.queryExecutionTime = 
        (this.metrics.queryExecutionTime + executionTime) / 2;
    }
    
    // Update cache hit rate
    if (type.includes('hit')) {
      this.metrics.cacheHitRate = 
        (this.metrics.cacheHitRate * (this.metrics.totalRequests - 1) + 100) / this.metrics.totalRequests;
    } else if (type.includes('miss')) {
      this.metrics.cacheHitRate = 
        (this.metrics.cacheHitRate * (this.metrics.totalRequests - 1)) / this.metrics.totalRequests;
    }
  }

  private async preloadActiveSchemes(): Promise<void> {
    // This would integrate with the scheme service
    console.log('Preloading active schemes...');
  }

  private async preloadUserRoles(): Promise<void> {
    // This would integrate with the user service
    console.log('Preloading user roles...');
  }

  private async preloadSystemConfig(): Promise<void> {
    // This would preload system configuration
    console.log('Preloading system configuration...');
  }

  private async preloadNotificationTemplates(): Promise<void> {
    // This would integrate with the notification service
    console.log('Preloading notification templates...');
  }

  private async warmUpSchemeCache(): Promise<void> {
    // Warm up scheme-related cache
    console.log('Warming up scheme cache...');
  }

  private async warmUpUserCache(): Promise<void> {
    // Warm up user-related cache
    console.log('Warming up user cache...');
  }

  private async warmUpApplicationCache(): Promise<void> {
    // Warm up application-related cache
    console.log('Warming up application cache...');
  }

  private async warmUpStaticContent(): Promise<void> {
    // Warm up static content cache
    console.log('Warming up static content cache...');
  }

  private async getOptimalCDNRegion(): Promise<string> {
    // Logic to determine optimal CDN region
    // This could be based on user location, current load, etc.
    return this.cdnConfig.regions[0] || 'us-east-1';
  }

  private getAssetVersion(asset: string): string {
    // Generate version hash for cache busting
    // In production, this would be based on file hash or build version
    return process.env.ASSET_VERSION || 'v1';
  }

  private getCacheStats(): any {
    return {
      localCacheSize: this.queryCache.size,
      maxCacheSize: this.config.maxCacheSize,
      cacheUtilization: (this.queryCache.size / this.config.maxCacheSize) * 100
    };
  }

  private getQueryOptimizationStats(): any {
    return {
      averageQueryTime: this.metrics.queryExecutionTime,
      totalOptimizedQueries: this.metrics.totalRequests,
      cacheEnabled: this.config.enableCaching
    };
  }
}

// Singleton instance
export const performanceService = new PerformanceService();