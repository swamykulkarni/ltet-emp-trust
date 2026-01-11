import { Request, Response, NextFunction } from 'express';
import { performanceService } from './performance.service';
import { cacheService } from './cache.service';

export interface PerformanceMiddlewareOptions {
  enableCaching?: boolean;
  enableMetrics?: boolean;
  enableSlowQueryLogging?: boolean;
  slowQueryThreshold?: number;
  cacheKeyGenerator?: (req: Request) => string;
  cacheTTL?: number;
  excludePaths?: string[];
}

export interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  cacheHit?: boolean;
}

/**
 * Performance monitoring middleware for Express applications
 * Provides request timing, caching, and performance metrics collection
 */
export class PerformanceMiddleware {
  private metrics: RequestMetrics[] = [];
  private options: Required<PerformanceMiddlewareOptions>;

  constructor(options: PerformanceMiddlewareOptions = {}) {
    this.options = {
      enableCaching: options.enableCaching ?? true,
      enableMetrics: options.enableMetrics ?? true,
      enableSlowQueryLogging: options.enableSlowQueryLogging ?? true,
      slowQueryThreshold: options.slowQueryThreshold ?? 1000,
      cacheKeyGenerator: options.cacheKeyGenerator ?? this.defaultCacheKeyGenerator,
      cacheTTL: options.cacheTTL ?? 300,
      excludePaths: options.excludePaths ?? ['/health', '/metrics', '/favicon.ico']
    };
  }

  /**
   * Express middleware for performance monitoring
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Skip excluded paths
      if (this.shouldExcludePath(req.path)) {
        return next();
      }

      // Try to serve from cache for GET requests
      if (req.method === 'GET' && this.options.enableCaching) {
        const cacheKey = this.options.cacheKeyGenerator(req);
        const cachedResponse = await cacheService.get(cacheKey);
        
        if (cachedResponse) {
          const responseTime = Date.now() - startTime;
          
          if (this.options.enableMetrics) {
            this.recordMetrics(req, res, responseTime, true);
          }
          
          res.set('X-Cache', 'HIT');
          res.set('X-Response-Time', `${responseTime}ms`);
          
          return res.json(cachedResponse);
        }
      }

      // Capture original res.json to intercept response
      const originalJson = res.json.bind(res);
      let responseData: any;

      res.json = function(data: any) {
        responseData = data;
        return originalJson(data);
      };

      // Continue with request processing
      res.on('finish', async () => {
        const responseTime = Date.now() - startTime;
        
        // Cache successful GET responses
        if (
          req.method === 'GET' && 
          res.statusCode >= 200 && 
          res.statusCode < 300 && 
          responseData &&
          this.options.enableCaching
        ) {
          const cacheKey = this.options.cacheKeyGenerator(req);
          await cacheService.set(cacheKey, responseData, { ttl: this.options.cacheTTL });
          res.set('X-Cache', 'MISS');
        }

        // Record metrics
        if (this.options.enableMetrics) {
          this.recordMetrics(req, res, responseTime, false);
        }

        // Log slow requests
        if (this.options.enableSlowQueryLogging && responseTime > this.options.slowQueryThreshold) {
          console.warn(`Slow request detected: ${req.method} ${req.path} (${responseTime}ms)`, {
            method: req.method,
            path: req.path,
            query: req.query,
            responseTime,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          });
        }

        // Add performance headers
        res.set('X-Response-Time', `${responseTime}ms`);
        res.set('X-Powered-By', 'LTET Performance Engine');
      });

      next();
    };
  }

  /**
   * Middleware for API response caching
   */
  cacheMiddleware(ttl: number = 300) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = this.options.cacheKeyGenerator(req);
      const cachedResponse = await cacheService.get(cacheKey);

      if (cachedResponse) {
        res.set('X-Cache', 'HIT');
        res.set('Cache-Control', `public, max-age=${ttl}`);
        return res.json(cachedResponse);
      }

      // Capture response for caching
      const originalJson = res.json.bind(res);
      
      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(cacheKey, data, { ttl });
          res.set('X-Cache', 'MISS');
          res.set('Cache-Control', `public, max-age=${ttl}`);
        }
        return originalJson(data);
      };

      next();
    };
  }

  /**
   * Middleware for request rate limiting with Redis
   */
  rateLimitMiddleware(options: {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (req: Request) => string;
  }) {
    const { windowMs, maxRequests, keyGenerator = (req) => req.ip } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
      const key = `rate_limit:${keyGenerator(req)}`;
      const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
      const windowKey = `${key}:${windowStart}`;

      try {
        const currentCount = await cacheService.increment(windowKey, 1, { ttl: Math.ceil(windowMs / 1000) });

        if (currentCount > maxRequests) {
          res.set('X-RateLimit-Limit', maxRequests.toString());
          res.set('X-RateLimit-Remaining', '0');
          res.set('X-RateLimit-Reset', (windowStart + windowMs).toString());
          
          return res.status(429).json({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`
          });
        }

        res.set('X-RateLimit-Limit', maxRequests.toString());
        res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount).toString());
        res.set('X-RateLimit-Reset', (windowStart + windowMs).toString());

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        next(); // Continue on error to avoid blocking requests
      }
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    totalRequests: number;
    averageResponseTime: number;
    slowRequests: number;
    errorRate: number;
    requestsByMethod: Record<string, number>;
    requestsByPath: Record<string, number>;
    recentRequests: RequestMetrics[];
  } {
    const totalRequests = this.metrics.length;
    const averageResponseTime = totalRequests > 0 
      ? this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests 
      : 0;
    
    const slowRequests = this.metrics.filter(m => m.responseTime > this.options.slowQueryThreshold).length;
    const errorRequests = this.metrics.filter(m => m.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    const requestsByMethod: Record<string, number> = {};
    const requestsByPath: Record<string, number> = {};

    this.metrics.forEach(metric => {
      requestsByMethod[metric.method] = (requestsByMethod[metric.method] || 0) + 1;
      requestsByPath[metric.path] = (requestsByPath[metric.path] || 0) + 1;
    });

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      slowRequests,
      errorRate: Math.round(errorRate * 100) / 100,
      requestsByMethod,
      requestsByPath,
      recentRequests: this.metrics.slice(-100) // Last 100 requests
    };
  }

  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): string {
    const metrics = this.getMetrics();
    
    // Export in Prometheus format
    let output = '';
    output += `# HELP http_requests_total Total number of HTTP requests\n`;
    output += `# TYPE http_requests_total counter\n`;
    output += `http_requests_total ${metrics.totalRequests}\n\n`;
    
    output += `# HELP http_request_duration_ms Average HTTP request duration in milliseconds\n`;
    output += `# TYPE http_request_duration_ms gauge\n`;
    output += `http_request_duration_ms ${metrics.averageResponseTime}\n\n`;
    
    output += `# HELP http_requests_slow_total Total number of slow HTTP requests\n`;
    output += `# TYPE http_requests_slow_total counter\n`;
    output += `http_requests_slow_total ${metrics.slowRequests}\n\n`;
    
    output += `# HELP http_requests_error_rate HTTP request error rate percentage\n`;
    output += `# TYPE http_requests_error_rate gauge\n`;
    output += `http_requests_error_rate ${metrics.errorRate}\n\n`;

    return output;
  }

  /**
   * Default cache key generator
   */
  private defaultCacheKeyGenerator(req: Request): string {
    const { method, path, query } = req;
    const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : '';
    return `api:${method}:${path}:${Buffer.from(queryString).toString('base64')}`;
  }

  /**
   * Check if path should be excluded from monitoring
   */
  private shouldExcludePath(path: string): boolean {
    return this.options.excludePaths.some(excludePath => 
      path.startsWith(excludePath) || path === excludePath
    );
  }

  /**
   * Record request metrics
   */
  private recordMetrics(req: Request, res: Response, responseTime: number, cacheHit: boolean): void {
    const metric: RequestMetrics = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      timestamp: new Date(),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      cacheHit
    };

    this.metrics.push(metric);

    // Keep only last 10000 metrics to prevent memory issues
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000);
    }
  }
}

// Create default instance
export const performanceMiddleware = new PerformanceMiddleware();