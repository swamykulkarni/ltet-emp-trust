import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AuthenticatedRequest } from './auth.middleware';
import { MFAService } from '../services/mfa.service';
import { AuditLoggerService } from '@ltet/shared-utils';

/**
 * Security middleware for enhanced protection
 */
export class SecurityMiddleware {
  private mfaService: MFAService;
  private auditLogger: AuditLoggerService;

  constructor() {
    this.mfaService = new MFAService();
    this.auditLogger = AuditLoggerService.getInstance();
  }

  /**
   * Rate limiting for login attempts
   */
  static loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
      success: false,
      error: 'Too many login attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Rate limit by IP and employee ID combination
      const employeeId = req.body?.employeeId || 'unknown';
      return `${req.ip}-${employeeId}`;
    },
    handler: (req: Request, res: Response) => {
      // Log rate limit violation
      AuditLoggerService.getInstance().logSecurityEvent({
        userId: req.body?.employeeId || 'unknown',
        userRole: 'unknown',
        action: 'rate_limit_exceeded',
        resource: 'login',
        details: {
          limit: 5,
          window: '15 minutes',
          violation: 'login_attempts'
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
        sessionId: 'rate_limited',
        success: false,
        errorMessage: 'Rate limit exceeded for login attempts'
      });

      res.status(429).json({
        success: false,
        error: 'Too many login attempts. Please try again later.'
      });
    }
  });

  /**
   * Rate limiting for API requests
   */
  static apiRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
      success: false,
      error: 'Too many requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.ip,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.'
      });
    }
  });

  /**
   * Security headers middleware
   */
  static securityHeaders = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false, // Disable for API compatibility
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    }
  });

  /**
   * Require MFA for elevated operations
   */
  requireMFA = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Check if MFA is required for user's roles
      if (!this.mfaService.isRequiredForUser(req.user.roles)) {
        next();
        return;
      }

      // Check if user has MFA enabled
      const mfaStatus = await this.mfaService.getMFAStatus(req.user.userId);
      if (!mfaStatus.enabled) {
        res.status(403).json({
          success: false,
          error: 'Multi-factor authentication must be enabled for your role',
          requiresMFASetup: true
        });
        return;
      }

      // Check if MFA verification is recent enough for this session
      const sessionAge = Date.now() - (req.user.iat * 1000);
      const requiresReauth = await this.mfaService.isMFARequired(req.user.userId, sessionAge);

      if (requiresReauth) {
        res.status(403).json({
          success: false,
          error: 'Multi-factor authentication required for this operation',
          requiresMFAVerification: true
        });
        return;
      }

      next();
    } catch (error) {
      console.error('MFA middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Security verification failed'
      });
    }
  };

  /**
   * Log all requests for audit purposes
   */
  auditLogger = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    // Capture response data
    const originalSend = res.send;
    let responseBody: any;

    res.send = function(body: any) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // Continue with request
    next();

    // Log after response is sent
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      const success = res.statusCode < 400;

      try {
        await this.auditLogger.logDataAccess(
          req.user?.userId || 'anonymous',
          req.user?.roles?.join(',') || 'anonymous',
          this.getActionFromMethod(req.method),
          this.getResourceFromPath(req.path),
          req.params?.id || req.params?.userId || 'unknown',
          req.ip,
          req.get('User-Agent') || '',
          req.sessionID || 'unknown',
          success,
          {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            userAgent: req.get('User-Agent'),
            referer: req.get('Referer')
          },
          success ? undefined : this.getErrorFromResponse(responseBody)
        );
      } catch (error) {
        console.error('Audit logging failed:', error);
      }
    });
  };

  /**
   * Validate request origin and prevent CSRF
   */
  static validateOrigin = (req: Request, res: Response, next: NextFunction): void => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:4200',
      process.env.ADMIN_URL || 'http://localhost:4201',
      'http://localhost:3000' // API Gateway
    ];

    const origin = req.get('Origin');
    const referer = req.get('Referer');

    // Allow requests without origin (direct API calls, mobile apps)
    if (!origin && !referer) {
      next();
      return;
    }

    // Check if origin is allowed
    if (origin && allowedOrigins.includes(origin)) {
      next();
      return;
    }

    // Check if referer is from allowed origin
    if (referer && allowedOrigins.some(allowed => referer.startsWith(allowed))) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: 'Request origin not allowed'
    });
  };

  /**
   * Detect and prevent suspicious activities
   */
  suspiciousActivityDetection = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        next();
        return;
      }

      const suspiciousIndicators = [];

      // Check for unusual IP address
      const userAgent = req.get('User-Agent') || '';
      if (this.isUnusualUserAgent(userAgent)) {
        suspiciousIndicators.push('unusual_user_agent');
      }

      // Check for rapid requests (potential bot activity)
      if (this.isRapidRequests(req.user.userId, req.ip)) {
        suspiciousIndicators.push('rapid_requests');
      }

      // Check for privilege escalation attempts
      if (this.isPrivilegeEscalation(req)) {
        suspiciousIndicators.push('privilege_escalation');
      }

      // Log suspicious activity
      if (suspiciousIndicators.length > 0) {
        await this.auditLogger.logSecurityEvent({
          userId: req.user.userId,
          userRole: req.user.roles.join(','),
          action: 'suspicious_activity_detected',
          resource: 'security_monitoring',
          details: {
            indicators: suspiciousIndicators,
            path: req.path,
            method: req.method,
            userAgent
          },
          ipAddress: req.ip,
          userAgent,
          sessionId: req.sessionID || 'unknown',
          success: false,
          errorMessage: `Suspicious activity detected: ${suspiciousIndicators.join(', ')}`
        });

        // For high-risk activities, require additional verification
        if (suspiciousIndicators.includes('privilege_escalation')) {
          res.status(403).json({
            success: false,
            error: 'Additional verification required for this operation',
            requiresAdditionalAuth: true
          });
          return;
        }
      }

      next();
    } catch (error) {
      console.error('Suspicious activity detection error:', error);
      next(); // Continue on error to avoid blocking legitimate requests
    }
  };

  private getActionFromMethod(method: string): string {
    const methodMap: Record<string, string> = {
      'GET': 'read',
      'POST': 'create',
      'PUT': 'update',
      'PATCH': 'update',
      'DELETE': 'delete'
    };
    return methodMap[method] || 'unknown';
  }

  private getResourceFromPath(path: string): string {
    // Extract resource from API path
    const segments = path.split('/').filter(Boolean);
    if (segments.length > 1) {
      return segments[1]; // Usually /api/resource/id
    }
    return 'unknown';
  }

  private getErrorFromResponse(responseBody: any): string | undefined {
    if (typeof responseBody === 'string') {
      try {
        const parsed = JSON.parse(responseBody);
        return parsed.error || parsed.message;
      } catch {
        return undefined;
      }
    }
    return responseBody?.error || responseBody?.message;
  }

  private isUnusualUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private isRapidRequests(userId: string, ip: string): boolean {
    // This would typically check against a cache/database
    // For now, return false as this is a placeholder
    return false;
  }

  private isPrivilegeEscalation(req: AuthenticatedRequest): boolean {
    // Check if user is trying to access resources above their privilege level
    const adminPaths = ['/admin', '/system', '/config'];
    const userRoles = req.user?.roles || [];
    const isAdminPath = adminPaths.some(path => req.path.includes(path));
    const hasAdminRole = userRoles.includes('admin') || userRoles.includes('system_admin');

    return isAdminPath && !hasAdminRole;
  }
}