import { cacheService } from './cache.service';
import { performanceService } from './performance.service';
import { databaseOptimizerService } from './database-optimizer.service';
import { cdnService } from './cdn.service';

export interface StartupOptions {
  enableCaching?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableDatabaseOptimization?: boolean;
  enableCDN?: boolean;
  preloadData?: boolean;
  warmupCache?: boolean;
}

/**
 * Startup service for initializing performance and caching infrastructure
 */
export class StartupService {
  private initialized = false;

  /**
   * Initialize all performance and caching services
   */
  async initialize(options: StartupOptions = {}): Promise<void> {
    if (this.initialized) {
      console.log('Performance services already initialized');
      return;
    }

    const {
      enableCaching = true,
      enablePerformanceMonitoring = true,
      enableDatabaseOptimization = true,
      enableCDN = process.env.CDN_ENABLED === 'true',
      preloadData = true,
      warmupCache = true
    } = options;

    console.log('Initializing LTET Performance Services...');

    try {
      // Initialize Redis cache connection
      if (enableCaching) {
        await this.initializeCache();
      }

      // Initialize database optimizer
      if (enableDatabaseOptimization) {
        await this.initializeDatabaseOptimizer();
      }

      // Initialize CDN service
      if (enableCDN) {
        await this.initializeCDN();
      }

      // Preload frequently accessed data
      if (preloadData) {
        await this.preloadData();
      }

      // Warm up cache with essential data
      if (warmupCache && enableCaching) {
        await this.warmupCache();
      }

      this.initialized = true;
      console.log('✅ LTET Performance Services initialized successfully');

      // Log initialization summary
      await this.logInitializationSummary();

    } catch (error) {
      console.error('❌ Failed to initialize performance services:', error);
      throw error;
    }
  }

  /**
   * Graceful shutdown of all services
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    console.log('Shutting down LTET Performance Services...');

    try {
      // Disconnect from Redis
      await cacheService.disconnect();
      
      // Close database connections
      await databaseOptimizerService.close();
      
      console.log('✅ Performance services shut down gracefully');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }

    this.initialized = false;
  }

  /**
   * Health check for all performance services
   */
  async healthCheck(): Promise<{
    overall: 'healthy' | 'unhealthy';
    services: {
      cache: any;
      database: any;
      cdn: any;
    };
  }> {
    const results = {
      overall: 'healthy' as 'healthy' | 'unhealthy',
      services: {
        cache: await cacheService.healthCheck(),
        database: await databaseOptimizerService.healthCheck(),
        cdn: await cdnService.healthCheck()
      }
    };

    // Determine overall health
    const unhealthyServices = Object.values(results.services)
      .filter(service => service.status === 'unhealthy');
    
    if (unhealthyServices.length > 0) {
      results.overall = 'unhealthy';
    }

    return results;
  }

  /**
   * Get comprehensive performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    cache: any;
    database: any;
    cdn: any;
    performance: any;
  }> {
    return {
      cache: await cacheService.getStats(),
      database: databaseOptimizerService.getMetrics(),
      cdn: await cdnService.getStats(),
      performance: performanceService.getPerformanceMetrics()
    };
  }

  /**
   * Optimize system performance
   */
  async optimizePerformance(): Promise<{
    cacheOptimization: any;
    databaseOptimization: any;
    recommendations: string[];
  }> {
    console.log('Running performance optimization...');

    const recommendations: string[] = [];

    // Clear old cache entries
    const cacheStats = await cacheService.getStats();
    if (cacheStats.hitRate < 50) {
      recommendations.push('Cache hit rate is low. Consider adjusting TTL values or cache keys.');
    }

    // Analyze database performance
    const dbOptimization = await databaseOptimizerService.analyzeAndOptimizeIndexes();
    if (dbOptimization.unusedIndexes.length > 0) {
      recommendations.push(`Found ${dbOptimization.unusedIndexes.length} unused database indexes.`);
    }
    if (dbOptimization.missingIndexes.length > 0) {
      recommendations.push(`Found ${dbOptimization.missingIndexes.length} potential missing indexes.`);
    }

    // Preload frequently accessed data
    await performanceService.preloadFrequentData();

    return {
      cacheOptimization: cacheStats,
      databaseOptimization: dbOptimization,
      recommendations
    };
  }

  /**
   * Initialize cache service
   */
  private async initializeCache(): Promise<void> {
    console.log('🔄 Initializing Redis cache...');
    
    await cacheService.connect();
    
    const healthCheck = await cacheService.healthCheck();
    if (healthCheck.status === 'healthy') {
      console.log(`✅ Redis cache connected (${healthCheck.latency}ms latency)`);
    } else {
      throw new Error('Failed to connect to Redis cache');
    }
  }

  /**
   * Initialize database optimizer
   */
  private async initializeDatabaseOptimizer(): Promise<void> {
    console.log('🔄 Initializing database optimizer...');
    
    const healthCheck = await databaseOptimizerService.healthCheck();
    if (healthCheck.status === 'healthy') {
      console.log(`✅ Database optimizer connected (${healthCheck.latency}ms latency)`);
    } else {
      throw new Error('Failed to connect to database');
    }
  }

  /**
   * Initialize CDN service
   */
  private async initializeCDN(): Promise<void> {
    console.log('🔄 Initializing CDN service...');
    
    const healthCheck = await cdnService.healthCheck();
    if (healthCheck.status === 'healthy') {
      console.log(`✅ CDN service initialized (regions: ${healthCheck.regions.join(', ')})`);
    } else {
      console.warn('⚠️ CDN service not available, static assets will be served locally');
    }
  }

  /**
   * Preload frequently accessed data
   */
  private async preloadData(): Promise<void> {
    console.log('🔄 Preloading frequently accessed data...');
    
    try {
      await performanceService.preloadFrequentData();
      console.log('✅ Frequent data preloaded');
    } catch (error) {
      console.warn('⚠️ Failed to preload some data:', error);
    }
  }

  /**
   * Warm up cache with essential data
   */
  private async warmupCache(): Promise<void> {
    console.log('🔄 Warming up cache...');
    
    try {
      await performanceService.warmUpCache();
      console.log('✅ Cache warmed up');
    } catch (error) {
      console.warn('⚠️ Failed to warm up cache:', error);
    }
  }

  /**
   * Log initialization summary
   */
  private async logInitializationSummary(): Promise<void> {
    const metrics = await this.getPerformanceMetrics();
    
    console.log('\n📊 Performance Services Summary:');
    console.log(`   Cache: ${metrics.cache.totalKeys} keys, ${(metrics.cache.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Database: ${metrics.database.connectionPoolStats.totalConnections} connections`);
    console.log(`   CDN: ${metrics.cdn.enabled ? 'Enabled' : 'Disabled'}`);
    console.log('');
  }

  /**
   * Check if services are initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const startupService = new StartupService();

// Auto-initialize on import in production
if (process.env.NODE_ENV === 'production') {
  startupService.initialize().catch(console.error);
}