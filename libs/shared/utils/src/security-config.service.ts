/**
 * Security configuration service for centralized security settings
 * Implements security best practices and compliance requirements
 */
export class SecurityConfigService {
  private static instance: SecurityConfigService;

  private constructor() {}

  static getInstance(): SecurityConfigService {
    if (!SecurityConfigService.instance) {
      SecurityConfigService.instance = new SecurityConfigService();
    }
    return SecurityConfigService.instance;
  }

  /**
   * Get encryption configuration
   */
  getEncryptionConfig() {
    return {
      algorithm: 'aes-256-gcm',
      keyLength: 32, // 256 bits
      ivLength: 16,  // 128 bits
      tagLength: 16, // 128 bits
      saltLength: 32, // 256 bits
      iterations: 100000, // PBKDF2 iterations
      hashAlgorithm: 'sha256'
    };
  }

  /**
   * Get password policy configuration
   */
  getPasswordPolicy() {
    return {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      preventCommonPasswords: true,
      preventUserInfoInPassword: true,
      maxAge: 90, // days
      historyCount: 12, // prevent reuse of last 12 passwords
      lockoutThreshold: 3,
      lockoutDuration: 30 // minutes
    };
  }

  /**
   * Get session security configuration
   */
  getSessionConfig() {
    return {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      renewThreshold: 4 * 60 * 60 * 1000, // 4 hours
      absoluteTimeout: 8 * 60 * 60 * 1000, // 8 hours
      sameSite: 'strict' as const,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxConcurrentSessions: 3,
      trackLocation: true,
      trackDevice: true
    };
  }

  /**
   * Get MFA configuration
   */
  getMFAConfig() {
    return {
      issuer: 'L&T Employee Trust Portal',
      algorithm: 'SHA1',
      digits: 6,
      period: 30, // seconds
      window: 2, // allow 2 time steps tolerance
      backupCodeLength: 8,
      backupCodeCount: 10,
      qrCodeSize: 200,
      secretLength: 32,
      requiredRoles: ['admin', 'system_admin', 'finance', 'head'],
      gracePeriod: 7 * 24 * 60 * 60 * 1000, // 7 days to setup MFA
      reauthInterval: 4 * 60 * 60 * 1000 // 4 hours
    };
  }

  /**
   * Get audit logging configuration
   */
  getAuditConfig() {
    return {
      retentionPeriod: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
      batchSize: 100,
      flushInterval: 5000, // 5 seconds
      encryptSensitiveFields: true,
      includeRequestBody: false, // for privacy
      includeResponseBody: false, // for privacy
      logLevels: {
        authentication: 'all',
        dataAccess: 'all',
        adminActions: 'all',
        systemEvents: 'errors_only',
        financialTransactions: 'all'
      },
      alertThresholds: {
        failedLogins: 5,
        suspiciousActivity: 3,
        privilegeEscalation: 1,
        dataExfiltration: 1
      }
    };
  }

  /**
   * Get rate limiting configuration
   */
  getRateLimitConfig() {
    return {
      login: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // attempts per window
        skipSuccessfulRequests: true
      },
      api: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // requests per window
        skipSuccessfulRequests: false
      },
      passwordReset: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // attempts per window
        skipSuccessfulRequests: true
      },
      mfaVerification: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // attempts per window
        skipSuccessfulRequests: true
      }
    };
  }

  /**
   * Get data classification levels
   */
  getDataClassification() {
    return {
      public: {
        encryption: false,
        accessLogging: false,
        retentionPeriod: 365 * 24 * 60 * 60 * 1000 // 1 year
      },
      internal: {
        encryption: true,
        accessLogging: true,
        retentionPeriod: 3 * 365 * 24 * 60 * 60 * 1000 // 3 years
      },
      confidential: {
        encryption: true,
        accessLogging: true,
        retentionPeriod: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
        requiresApproval: true
      },
      restricted: {
        encryption: true,
        accessLogging: true,
        retentionPeriod: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
        requiresApproval: true,
        requiresMFA: true,
        auditTrail: true
      }
    };
  }

  /**
   * Get security headers configuration
   */
  getSecurityHeaders() {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'Content-Security-Policy': this.getCSPHeader()
    };
  }

  /**
   * Get Content Security Policy header
   */
  private getCSPHeader(): string {
    const directives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Allow inline scripts for development
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "child-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ];

    return directives.join('; ');
  }

  /**
   * Get compliance configuration
   */
  getComplianceConfig() {
    return {
      standards: ['ISO 27001', 'SOC 2 Type II', 'GDPR'],
      dataRetention: {
        personalData: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
        auditLogs: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
        sessionData: 30 * 24 * 60 * 60 * 1000, // 30 days
        temporaryFiles: 24 * 60 * 60 * 1000 // 24 hours
      },
      encryption: {
        atRest: 'AES-256',
        inTransit: 'TLS 1.2+',
        keyRotation: 90 * 24 * 60 * 60 * 1000 // 90 days
      },
      accessControl: {
        principleOfLeastPrivilege: true,
        roleBasedAccess: true,
        regularAccessReview: true,
        accessReviewInterval: 90 * 24 * 60 * 60 * 1000 // 90 days
      }
    };
  }

  /**
   * Get incident response configuration
   */
  getIncidentResponseConfig() {
    return {
      severityLevels: {
        low: {
          responseTime: 24 * 60 * 60 * 1000, // 24 hours
          escalation: false,
          notification: ['security_team']
        },
        medium: {
          responseTime: 4 * 60 * 60 * 1000, // 4 hours
          escalation: true,
          notification: ['security_team', 'management']
        },
        high: {
          responseTime: 1 * 60 * 60 * 1000, // 1 hour
          escalation: true,
          notification: ['security_team', 'management', 'ciso']
        },
        critical: {
          responseTime: 15 * 60 * 1000, // 15 minutes
          escalation: true,
          notification: ['security_team', 'management', 'ciso', 'ceo']
        }
      },
      automaticActions: {
        suspiciousLogin: 'lock_account',
        multipleFailedAttempts: 'temporary_lock',
        privilegeEscalation: 'alert_and_log',
        dataExfiltration: 'block_and_alert'
      }
    };
  }

  /**
   * Validate security configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate encryption keys
    const mfaKey = process.env.MFA_ENCRYPTION_KEY;
    const auditKey = process.env.AUDIT_ENCRYPTION_KEY;
    const dbKey = process.env.DB_ENCRYPTION_KEY;

    if (!mfaKey || mfaKey.length < 32) {
      errors.push('MFA_ENCRYPTION_KEY must be at least 32 characters');
    }

    if (!auditKey || auditKey.length < 32) {
      errors.push('AUDIT_ENCRYPTION_KEY must be at least 32 characters');
    }

    if (!dbKey || dbKey.length < 32) {
      errors.push('DB_ENCRYPTION_KEY must be at least 32 characters');
    }

    // Validate JWT secret
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters');
    }

    // Validate production settings
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.HTTPS_ENABLED) {
        errors.push('HTTPS must be enabled in production');
      }

      if (jwtSecret === 'dev-jwt-secret-key') {
        errors.push('Default JWT secret detected in production');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get security recommendations based on current configuration
   */
  getSecurityRecommendations(): string[] {
    const recommendations: string[] = [];

    const validation = this.validateConfiguration();
    if (!validation.valid) {
      recommendations.push(...validation.errors);
    }

    // Additional recommendations
    if (process.env.NODE_ENV === 'production') {
      recommendations.push(
        'Implement regular security audits',
        'Set up automated vulnerability scanning',
        'Configure security monitoring and alerting',
        'Implement backup and disaster recovery procedures',
        'Conduct regular penetration testing',
        'Implement security awareness training',
        'Set up incident response procedures'
      );
    }

    return recommendations;
  }
}