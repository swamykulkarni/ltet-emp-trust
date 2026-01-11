import { performanceService } from './performance.service';

export interface CDNAsset {
  path: string;
  url: string;
  version: string;
  size?: number;
  contentType?: string;
  lastModified?: Date;
}

export interface CDNUploadOptions {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  public?: boolean;
}

export interface CDNStats {
  totalAssets: number;
  totalSize: number;
  hitRate: number;
  bandwidth: number;
  requests: number;
}

/**
 * CDN integration service for LTET Employee Trust Portal
 * Handles static asset optimization, delivery, and caching
 */
export class CDNService {
  private baseUrl: string;
  private regions: string[];
  private enabled: boolean;
  private assetVersion: string;
  private stats: CDNStats = {
    totalAssets: 0,
    totalSize: 0,
    hitRate: 0,
    bandwidth: 0,
    requests: 0
  };

  constructor() {
    this.enabled = process.env.CDN_ENABLED === 'true';
    this.baseUrl = process.env.CDN_BASE_URL || '';
    this.regions = (process.env.CDN_REGIONS || 'us-east-1,ap-south-1').split(',');
    this.assetVersion = process.env.ASSET_VERSION || 'v1';
  }

  /**
   * Get optimized URL for static asset
   */
  getAssetUrl(
    assetPath: string, 
    options: {
      region?: string;
      version?: string;
      optimization?: 'auto' | 'webp' | 'avif' | 'original';
      quality?: number;
      width?: number;
      height?: number;
    } = {}
  ): string {
    if (!this.enabled || !this.baseUrl) {
      return assetPath;
    }

    const {
      region = 'auto',
      version = this.assetVersion,
      optimization = 'auto',
      quality = 85,
      width,
      height
    } = options;

    // Build optimized URL
    let optimizedUrl = this.baseUrl.replace('{region}', region);
    
    // Add optimization parameters for images
    if (this.isImageAsset(assetPath)) {
      const params = new URLSearchParams();
      
      if (optimization !== 'original') {
        params.set('format', optimization);
      }
      
      if (quality !== 85) {
        params.set('quality', quality.toString());
      }
      
      if (width) {
        params.set('width', width.toString());
      }
      
      if (height) {
        params.set('height', height.toString());
      }
      
      if (params.toString()) {
        optimizedUrl += `/transform?${params.toString()}`;
      }
    }
    
    // Add version for cache busting
    const versionedPath = assetPath.includes('?') 
      ? `${assetPath}&v=${version}` 
      : `${assetPath}?v=${version}`;
    
    this.updateStats('request');
    
    return `${optimizedUrl}${versionedPath}`;
  }

  /**
   * Get multiple optimized asset URLs
   */
  getAssetUrls(
    assets: Array<{
      path: string;
      options?: Parameters<typeof this.getAssetUrl>[1];
    }>
  ): { [key: string]: string } {
    const optimizedAssets: { [key: string]: string } = {};
    
    for (const asset of assets) {
      optimizedAssets[asset.path] = this.getAssetUrl(asset.path, asset.options);
    }
    
    return optimizedAssets;
  }

  /**
   * Preload critical assets
   */
  async preloadCriticalAssets(assets: string[]): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const preloadPromises = assets.map(async (asset) => {
      try {
        const optimizedUrl = this.getAssetUrl(asset, { optimization: 'auto' });
        
        // Use link prefetch for critical assets
        if (typeof document !== 'undefined') {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = optimizedUrl;
          document.head.appendChild(link);
        }
        
        this.updateStats('preload');
      } catch (error) {
        console.error(`Failed to preload asset: ${asset}`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Generate responsive image URLs for different screen sizes
   */
  getResponsiveImageUrls(
    imagePath: string,
    breakpoints: Array<{ width: number; suffix?: string }> = [
      { width: 320, suffix: 'mobile' },
      { width: 768, suffix: 'tablet' },
      { width: 1024, suffix: 'desktop' },
      { width: 1920, suffix: 'large' }
    ]
  ): { [key: string]: string } {
    const responsiveUrls: { [key: string]: string } = {};
    
    for (const breakpoint of breakpoints) {
      const suffix = breakpoint.suffix || `${breakpoint.width}w`;
      responsiveUrls[suffix] = this.getAssetUrl(imagePath, {
        width: breakpoint.width,
        optimization: 'auto',
        quality: 85
      });
    }
    
    return responsiveUrls;
  }

  /**
   * Generate srcset string for responsive images
   */
  generateSrcSet(
    imagePath: string,
    breakpoints: Array<{ width: number; density?: number }> = [
      { width: 320 },
      { width: 768 },
      { width: 1024 },
      { width: 1920 }
    ]
  ): string {
    const srcSetEntries = breakpoints.map(breakpoint => {
      const url = this.getAssetUrl(imagePath, {
        width: breakpoint.width,
        optimization: 'auto'
      });
      
      const descriptor = breakpoint.density 
        ? `${breakpoint.density}x` 
        : `${breakpoint.width}w`;
      
      return `${url} ${descriptor}`;
    });
    
    return srcSetEntries.join(', ');
  }

  /**
   * Upload asset to CDN (for admin functionality)
   */
  async uploadAsset(
    file: Buffer | Uint8Array,
    path: string,
    options: CDNUploadOptions = {}
  ): Promise<CDNAsset> {
    if (!this.enabled) {
      throw new Error('CDN is not enabled');
    }

    try {
      // This would integrate with actual CDN service (AWS CloudFront, Cloudflare, etc.)
      // For now, we'll simulate the upload
      
      const asset: CDNAsset = {
        path,
        url: this.getAssetUrl(path),
        version: this.assetVersion,
        size: file.length,
        contentType: options.contentType || this.getContentType(path),
        lastModified: new Date()
      };

      // Update stats
      this.stats.totalAssets++;
      this.stats.totalSize += file.length;
      
      console.log(`Asset uploaded to CDN: ${path}`);
      
      return asset;
    } catch (error) {
      console.error(`Failed to upload asset to CDN: ${path}`, error);
      throw error;
    }
  }

  /**
   * Delete asset from CDN
   */
  async deleteAsset(path: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      // This would integrate with actual CDN service
      console.log(`Asset deleted from CDN: ${path}`);
      
      this.stats.totalAssets = Math.max(0, this.stats.totalAssets - 1);
      
      return true;
    } catch (error) {
      console.error(`Failed to delete asset from CDN: ${path}`, error);
      return false;
    }
  }

  /**
   * Purge CDN cache for specific assets or patterns
   */
  async purgeCache(paths: string[] | string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const pathArray = Array.isArray(paths) ? paths : [paths];
      
      // This would integrate with actual CDN service purge API
      console.log(`CDN cache purged for paths:`, pathArray);
      
      return true;
    } catch (error) {
      console.error('Failed to purge CDN cache:', error);
      return false;
    }
  }

  /**
   * Get CDN statistics and performance metrics
   */
  async getStats(): Promise<CDNStats & {
    regions: string[];
    enabled: boolean;
    baseUrl: string;
  }> {
    return {
      ...this.stats,
      regions: this.regions,
      enabled: this.enabled,
      baseUrl: this.baseUrl
    };
  }

  /**
   * Optimize images for web delivery
   */
  async optimizeImage(
    imagePath: string,
    options: {
      format?: 'webp' | 'avif' | 'jpeg' | 'png';
      quality?: number;
      width?: number;
      height?: number;
      progressive?: boolean;
    } = {}
  ): Promise<string> {
    const {
      format = 'webp',
      quality = 85,
      width,
      height,
      progressive = true
    } = options;

    return this.getAssetUrl(imagePath, {
      optimization: format === 'jpeg' || format === 'png' ? 'original' : format,
      quality,
      width,
      height
    });
  }

  /**
   * Generate CSS with optimized asset URLs
   */
  generateOptimizedCSS(css: string): string {
    if (!this.enabled) {
      return css;
    }

    // Replace asset URLs in CSS with CDN URLs
    return css.replace(
      /url\(['"]?([^'")\s]+)['"]?\)/g,
      (match, url) => {
        if (url.startsWith('http') || url.startsWith('//')) {
          return match; // Skip absolute URLs
        }
        
        const optimizedUrl = this.getAssetUrl(url);
        return `url('${optimizedUrl}')`;
      }
    );
  }

  /**
   * Check if asset is an image
   */
  private isImageAsset(path: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
    const extension = path.toLowerCase().substring(path.lastIndexOf('.'));
    return imageExtensions.includes(extension);
  }

  /**
   * Get content type from file extension
   */
  private getContentType(path: string): string {
    const extension = path.toLowerCase().substring(path.lastIndexOf('.'));
    
    const contentTypes: { [key: string]: string } = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    };
    
    return contentTypes[extension] || 'application/octet-stream';
  }

  /**
   * Update CDN statistics
   */
  private updateStats(type: 'request' | 'preload' | 'hit' | 'miss'): void {
    switch (type) {
      case 'request':
        this.stats.requests++;
        break;
      case 'hit':
        this.stats.requests++;
        this.stats.hitRate = (this.stats.hitRate * (this.stats.requests - 1) + 100) / this.stats.requests;
        break;
      case 'miss':
        this.stats.requests++;
        this.stats.hitRate = (this.stats.hitRate * (this.stats.requests - 1)) / this.stats.requests;
        break;
    }
  }

  /**
   * Health check for CDN service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
    regions: string[];
  }> {
    if (!this.enabled) {
      return {
        status: 'healthy',
        regions: []
      };
    }

    try {
      const start = Date.now();
      
      // Test CDN connectivity with a simple request
      const testUrl = this.getAssetUrl('/health-check.txt');
      
      // In a real implementation, you would make an actual HTTP request
      // For now, we'll simulate the check
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
        regions: this.regions
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        regions: this.regions
      };
    }
  }
}

// Singleton instance
export const cdnService = new CDNService();