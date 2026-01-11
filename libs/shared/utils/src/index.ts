// Shared utility functions for LTET Employee Trust Portal

/**
 * User role type definition
 */
export type UserRole = 'employee' | 'approver' | 'finance' | 'admin' | 'head' | 'system_admin';

/**
 * Date utility functions
 */
export class DateUtils {
  static formatDate(date: Date): string {
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  static formatDateTime(date: Date): string {
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  static isExpired(date: Date): boolean {
    return date < new Date();
  }

  static daysBetween(start: Date, end: Date): number {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

/**
 * String utility functions
 */
export class StringUtils {
  static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  static camelToTitle(str: string): string {
    return str
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  static generateId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}${timestamp}${random}`.toUpperCase();
  }

  static maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (data.length <= visibleChars) return data;
    const visible = data.slice(-visibleChars);
    const masked = '*'.repeat(data.length - visibleChars);
    return masked + visible;
  }
}

/**
 * Validation utility functions
 */
export class ValidationUtils {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  }

  static isValidIFSC(ifsc: string): boolean {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifsc);
  }

  static isValidPAN(pan: string): boolean {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  }

  static isValidPincode(pincode: string): boolean {
    const pincodeRegex = /^[1-9][0-9]{5}$/;
    return pincodeRegex.test(pincode);
  }

  static isStrongPassword(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }
}

/**
 * Role and permission utility functions
 */
export class RoleUtils {
  static hasRole(userRoles: UserRole[], requiredRole: UserRole): boolean {
    return userRoles.includes(requiredRole);
  }

  static hasAnyRole(userRoles: UserRole[], requiredRoles: UserRole[]): boolean {
    return requiredRoles.some(role => userRoles.includes(role));
  }

  static canApprove(userRoles: UserRole[]): boolean {
    return this.hasAnyRole(userRoles, ['approver', 'admin', 'head']);
  }

  static canManageFinance(userRoles: UserRole[]): boolean {
    return this.hasAnyRole(userRoles, ['finance', 'admin']);
  }

  static canAdminister(userRoles: UserRole[]): boolean {
    return this.hasAnyRole(userRoles, ['admin', 'system_admin']);
  }

  static getRoleDisplayName(role: UserRole): string {
    const roleNames: Record<UserRole, string> = {
      employee: 'Employee',
      approver: 'Approver',
      finance: 'Finance User',
      admin: 'Administrator',
      head: 'Head',
      system_admin: 'System Administrator'
    };
    return roleNames[role];
  }
}

/**
 * File utility functions
 */
export class FileUtils {
  static readonly ALLOWED_DOCUMENT_TYPES = ['pdf', 'jpg', 'jpeg', 'png'];
  static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  static isValidFileType(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? this.ALLOWED_DOCUMENT_TYPES.includes(extension) : false;
  }

  static isValidFileSize(size: number): boolean {
    return size <= this.MAX_FILE_SIZE;
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }
}

/**
 * Currency utility functions
 */
export class CurrencyUtils {
  static formatINR(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  }

  static formatNumber(num: number): string {
    return new Intl.NumberFormat('en-IN').format(num);
  }
}

/**
 * Error handling utilities
 */
export class ErrorUtils {
  static createError(message: string, code?: string, details?: any): Error {
    const error = new Error(message);
    (error as any).code = code;
    (error as any).details = details;
    return error;
  }

  static isNetworkError(error: any): boolean {
    return error.code === 'NETWORK_ERROR' || 
           error.message?.includes('network') ||
           error.message?.includes('fetch');
  }

  static getErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    return 'An unexpected error occurred';
  }
}

// Export security services
export { EncryptionService } from './encryption.service';
export { AuditLoggerService } from './audit-logger.service';
export type { AuditLogEntry, AuditQuery, AuditSummary } from './audit-logger.service';

// Export backup and disaster recovery services
export { BackupService, createBackupService, backupService } from './backup.service';
export type { 
  BackupConfiguration, 
  BackupMetadata, 
  RecoveryOptions, 
  DisasterRecoveryPlan 
} from './backup.service';
export { DisasterRecoveryService, createDisasterRecoveryService, disasterRecoveryService } from './disaster-recovery.service';
export type { 
  DisasterRecoveryConfiguration, 
  HealthCheckResult, 
  FailoverEvent, 
  RecoveryPlan, 
  RecoveryStep 
} from './disaster-recovery.service';

// Export performance and caching services
export { CacheService, cacheService } from './cache.service';
export type { CacheOptions, CacheStats } from './cache.service';
export { PerformanceService, performanceService } from './performance.service';
export type { QueryOptimizationConfig, CDNConfig, PerformanceMetrics } from './performance.service';
export { DatabaseOptimizerService, databaseOptimizerService } from './database-optimizer.service';
export type { QueryOptimization, QueryPlan, DatabaseMetrics } from './database-optimizer.service';
export { CDNService, cdnService } from './cdn.service';
export type { CDNAsset, CDNUploadOptions, CDNStats } from './cdn.service';
export { PerformanceMiddleware, performanceMiddleware } from './performance-middleware';
export type { PerformanceMiddlewareOptions, RequestMetrics } from './performance-middleware';
export { StartupService, startupService } from './startup.service';
export type { StartupOptions } from './startup.service';