import { Pool, PoolClient } from 'pg';
import { cacheService } from './cache.service';

export interface QueryOptimization {
  useIndex?: string[];
  limit?: number;
  offset?: number;
  orderBy?: string;
  groupBy?: string[];
  having?: string;
}

export interface QueryPlan {
  query: string;
  estimatedCost: number;
  estimatedRows: number;
  actualTime?: number;
  usesCaching: boolean;
}

export interface DatabaseMetrics {
  totalQueries: number;
  averageQueryTime: number;
  slowQueries: number;
  cacheHitRate: number;
  connectionPoolStats: {
    totalConnections: number;
    idleConnections: number;
    activeConnections: number;
  };
}

/**
 * Database query optimization service for PostgreSQL
 * Provides intelligent query optimization, connection pooling, and performance monitoring
 */
export class DatabaseOptimizerService {
  private pool: Pool;
  private metrics: DatabaseMetrics = {
    totalQueries: 0,
    averageQueryTime: 0,
    slowQueries: 0,
    cacheHitRate: 0,
    connectionPoolStats: {
      totalConnections: 0,
      idleConnections: 0,
      activeConnections: 0
    }
  };

  private slowQueryThreshold = 1000; // 1 second
  private queryCache = new Map<string, { result: any; timestamp: number; ttl: number }>();

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'ltet_portal',
      user: process.env.DB_USER || 'ltet_user',
      password: process.env.DB_PASSWORD || 'ltet_password',
      // Connection pool optimization
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      min: parseInt(process.env.DB_POOL_MIN || '5'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
      // Performance optimizations
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
      // SSL configuration for production
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Monitor pool events
    this.pool.on('connect', () => {
      this.updateConnectionStats();
    });

    this.pool.on('remove', () => {
      this.updateConnectionStats();
    });

    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });
  }

  /**
   * Execute optimized query with caching and performance monitoring
   */
  async executeOptimizedQuery<T>(
    query: string,
    params: any[] = [],
    options: {
      cacheTTL?: number;
      cacheKey?: string;
      enableCaching?: boolean;
      optimization?: QueryOptimization;
    } = {}
  ): Promise<T[]> {
    const {
      cacheTTL = 300,
      cacheKey,
      enableCaching = true,
      optimization
    } = options;

    // Generate cache key if not provided
    const finalCacheKey = cacheKey || this.generateCacheKey(query, params);

    // Try cache first if enabled
    if (enableCaching) {
      const cachedResult = await cacheService.get<T[]>(finalCacheKey);
      if (cachedResult !== null) {
        this.updateMetrics('cache_hit');
        return cachedResult;
      }
    }

    // Optimize query if optimization options provided
    const optimizedQuery = optimization ? this.optimizeQuery(query, optimization) : query;

    // Execute query with timing
    const startTime = Date.now();
    let result: T[];

    try {
      const queryResult = await this.pool.query(optimizedQuery, params);
      result = queryResult.rows;
      
      const executionTime = Date.now() - startTime;
      this.updateMetrics('query_executed', executionTime);

      // Log slow queries
      if (executionTime > this.slowQueryThreshold) {
        console.warn(`Slow query detected (${executionTime}ms):`, {
          query: optimizedQuery,
          params,
          executionTime
        });
        this.metrics.slowQueries++;
      }

      // Cache the result if enabled
      if (enableCaching) {
        await cacheService.set(finalCacheKey, result, { ttl: cacheTTL });
      }

      return result;
    } catch (error) {
      console.error('Database query error:', {
        query: optimizedQuery,
        params,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute query with transaction support
   */
  async executeTransaction<T>(
    queries: Array<{ query: string; params?: any[] }>,
    options: { isolationLevel?: 'READ COMMITTED' | 'SERIALIZABLE' } = {}
  ): Promise<T[][]> {
    const client = await this.pool.connect();
    const results: T[][] = [];

    try {
      await client.query('BEGIN');
      
      if (options.isolationLevel) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
      }

      for (const { query, params = [] } of queries) {
        const startTime = Date.now();
        const result = await client.query(query, params);
        const executionTime = Date.now() - startTime;
        
        this.updateMetrics('query_executed', executionTime);
        results.push(result.rows);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Batch execute multiple queries for better performance
   */
  async batchExecute<T>(
    queries: Array<{ query: string; params?: any[]; cacheKey?: string; cacheTTL?: number }>,
    options: { maxConcurrency?: number; enableCaching?: boolean } = {}
  ): Promise<T[][]> {
    const { maxConcurrency = 5, enableCaching = true } = options;
    const results: T[][] = [];

    // Process queries in batches to avoid overwhelming the connection pool
    for (let i = 0; i < queries.length; i += maxConcurrency) {
      const batch = queries.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async ({ query, params = [], cacheKey, cacheTTL }) => {
        return await this.executeOptimizedQuery<T>(query, params, {
          cacheKey,
          cacheTTL,
          enableCaching
        });
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get query execution plan for optimization analysis
   */
  async getQueryPlan(query: string, params: any[] = []): Promise<QueryPlan> {
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
    
    try {
      const result = await this.pool.query(explainQuery, params);
      const plan = result.rows[0]['QUERY PLAN'][0];
      
      return {
        query,
        estimatedCost: plan['Total Cost'] || 0,
        estimatedRows: plan['Plan Rows'] || 0,
        actualTime: plan['Actual Total Time'] || 0,
        usesCaching: false // Will be determined by caching logic
      };
    } catch (error) {
      console.error('Error getting query plan:', error);
      return {
        query,
        estimatedCost: 0,
        estimatedRows: 0,
        usesCaching: false
      };
    }
  }

  /**
   * Optimize query based on provided optimization options
   */
  private optimizeQuery(query: string, optimization: QueryOptimization): string {
    let optimizedQuery = query;

    // Add index hints (PostgreSQL specific)
    if (optimization.useIndex && optimization.useIndex.length > 0) {
      // PostgreSQL doesn't have explicit index hints, but we can add comments for monitoring
      optimizedQuery = `/* USE INDEX: ${optimization.useIndex.join(', ')} */ ${optimizedQuery}`;
    }

    // Add LIMIT clause if not present
    if (optimization.limit && !optimizedQuery.toLowerCase().includes('limit')) {
      optimizedQuery += ` LIMIT ${optimization.limit}`;
    }

    // Add OFFSET clause if not present
    if (optimization.offset && !optimizedQuery.toLowerCase().includes('offset')) {
      optimizedQuery += ` OFFSET ${optimization.offset}`;
    }

    // Add ORDER BY clause if not present
    if (optimization.orderBy && !optimizedQuery.toLowerCase().includes('order by')) {
      optimizedQuery += ` ORDER BY ${optimization.orderBy}`;
    }

    // Add GROUP BY clause if not present
    if (optimization.groupBy && optimization.groupBy.length > 0 && !optimizedQuery.toLowerCase().includes('group by')) {
      optimizedQuery += ` GROUP BY ${optimization.groupBy.join(', ')}`;
    }

    // Add HAVING clause if not present
    if (optimization.having && !optimizedQuery.toLowerCase().includes('having')) {
      optimizedQuery += ` HAVING ${optimization.having}`;
    }

    return optimizedQuery;
  }

  /**
   * Generate cache key for query and parameters
   */
  private generateCacheKey(query: string, params: any[]): string {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const paramsString = JSON.stringify(params);
    return `db:query:${Buffer.from(normalizedQuery + paramsString).toString('base64')}`;
  }

  /**
   * Update database metrics
   */
  private updateMetrics(type: 'cache_hit' | 'query_executed', executionTime?: number): void {
    if (type === 'query_executed') {
      this.metrics.totalQueries++;
      if (executionTime) {
        this.metrics.averageQueryTime = 
          (this.metrics.averageQueryTime * (this.metrics.totalQueries - 1) + executionTime) / this.metrics.totalQueries;
      }
    }

    // Update cache hit rate
    const totalRequests = this.metrics.totalQueries;
    if (type === 'cache_hit' && totalRequests > 0) {
      this.metrics.cacheHitRate = 
        (this.metrics.cacheHitRate * (totalRequests - 1) + 100) / totalRequests;
    }
  }

  /**
   * Update connection pool statistics
   */
  private updateConnectionStats(): void {
    this.metrics.connectionPoolStats = {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      activeConnections: this.pool.totalCount - this.pool.idleCount
    };
  }

  /**
   * Get database performance metrics
   */
  getMetrics(): DatabaseMetrics {
    this.updateConnectionStats();
    return { ...this.metrics };
  }

  /**
   * Clear query cache
   */
  async clearQueryCache(): Promise<void> {
    await cacheService.deleteByPattern('db:query:*');
    this.queryCache.clear();
  }

  /**
   * Optimize database indexes based on query patterns
   */
  async analyzeAndOptimizeIndexes(): Promise<{
    recommendations: string[];
    unusedIndexes: string[];
    missingIndexes: string[];
  }> {
    const recommendations: string[] = [];
    const unusedIndexes: string[] = [];
    const missingIndexes: string[] = [];

    try {
      // Get unused indexes
      const unusedIndexQuery = `
        SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE idx_tup_read = 0 AND idx_tup_fetch = 0
        AND indexname NOT LIKE '%_pkey'
      `;
      
      const unusedResult = await this.pool.query(unusedIndexQuery);
      unusedIndexes.push(...unusedResult.rows.map(row => 
        `${row.schemaname}.${row.tablename}.${row.indexname}`
      ));

      // Get table statistics for missing index recommendations
      const tableStatsQuery = `
        SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
        FROM pg_stat_user_tables
        WHERE seq_scan > idx_scan AND seq_tup_read > 1000
      `;
      
      const tableStatsResult = await this.pool.query(tableStatsQuery);
      missingIndexes.push(...tableStatsResult.rows.map(row => 
        `Consider adding index to ${row.schemaname}.${row.tablename} (seq_scan: ${row.seq_scan}, seq_tup_read: ${row.seq_tup_read})`
      ));

      // General recommendations
      if (unusedIndexes.length > 0) {
        recommendations.push(`Consider dropping ${unusedIndexes.length} unused indexes to improve write performance`);
      }
      
      if (missingIndexes.length > 0) {
        recommendations.push(`Consider adding indexes to ${missingIndexes.length} tables with high sequential scan ratios`);
      }

      return { recommendations, unusedIndexes, missingIndexes };
    } catch (error) {
      console.error('Error analyzing indexes:', error);
      return { recommendations: [], unusedIndexes: [], missingIndexes: [] };
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
    connectionPool?: any;
  }> {
    try {
      const start = Date.now();
      await this.pool.query('SELECT 1');
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
        connectionPool: this.metrics.connectionPoolStats
      };
    } catch (error) {
      return {
        status: 'unhealthy'
      };
    }
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Singleton instance
export const databaseOptimizerService = new DatabaseOptimizerService();