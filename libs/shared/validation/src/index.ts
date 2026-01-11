// Shared validation schemas and functions for LTET Employee Trust Portal

// Local validation utilities
class LocalValidationUtils {
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

  static isStrongPassword(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }
}

// Re-export types locally to avoid circular dependencies
export interface User {
  userId: string;
  employeeId: string;
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
    };
  };
  employmentInfo: {
    department: string;
    ic: string;
    joiningDate: Date;
    retirementDate?: Date;
    status: 'active' | 'retired';
  };
  bankDetails?: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
  dependents: Array<{
    name: string;
    relationship: string;
    dateOfBirth: Date;
    documents: string[];
  }>;
  roles: Array<'employee' | 'approver' | 'finance' | 'admin' | 'head' | 'system_admin'>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Scheme {
  schemeId: string;
  name: string;
  category: 'medical' | 'education' | 'skill_building';
  description: string;
  eligibilityRules: {
    serviceYears?: number;
    salaryRange?: {
      min: number;
      max: number;
    };
    dependentAge?: number;
    icRestrictions?: string[];
  };
  documentRequirements: Array<{
    type: string;
    mandatory: boolean;
    validationRules: Record<string, any>;
  }>;
  approvalWorkflow: {
    levels: string[];
    slaHours: number;
    escalationRules: Record<string, any>;
  };
  budgetInfo: {
    maxAmount: number;
    fiscalYear: string;
    utilizationLimit: number;
  };
  status: 'active' | 'inactive' | 'draft';
  validFrom: Date;
  validTo: Date;
}

export interface Application {
  applicationId: string;
  userId: string;
  schemeId: string;
  applicationData: {
    claimAmount: number;
    purpose: string;
    beneficiary: string;
    customFields: Record<string, any>;
  };
  documents: Array<{
    documentId: string;
    type: string;
    uploadedAt: Date;
    validationStatus: 'pending' | 'validated' | 'failed';
  }>;
  workflow: {
    currentStatus: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'disbursed';
    approvalHistory: Array<{
      approverId: string;
      action: 'approve' | 'reject' | 'clarify';
      comments: string;
      timestamp: Date;
    }>;
    slaDeadline: Date;
    escalationLevel: number;
  };
  auditTrail: Array<{
    action: string;
    userId: string;
    timestamp: Date;
    details: Record<string, any>;
  }>;
}

export interface LoginRequest {
  employeeId: string;
  password: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Base validator class
 */
export abstract class BaseValidator<T> {
  abstract validate(data: T): ValidationResult;

  protected createError(field: string, message: string, code: string): ValidationError {
    return { field, message, code };
  }

  protected createResult(errors: ValidationError[]): ValidationResult {
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * User validation
 */
export class UserValidator extends BaseValidator<Partial<User>> {
  validate(user: Partial<User>): ValidationResult {
    const errors: ValidationError[] = [];

    // Personal info validation
    if (user.personalInfo) {
      if (!user.personalInfo.name?.trim()) {
        errors.push(this.createError('personalInfo.name', 'Name is required', 'REQUIRED'));
      }

      if (!user.personalInfo.email) {
        errors.push(this.createError('personalInfo.email', 'Email is required', 'REQUIRED'));
      } else if (!LocalValidationUtils.isValidEmail(user.personalInfo.email)) {
        errors.push(this.createError('personalInfo.email', 'Invalid email format', 'INVALID_FORMAT'));
      }

      if (!user.personalInfo.phone) {
        errors.push(this.createError('personalInfo.phone', 'Phone number is required', 'REQUIRED'));
      } else if (!LocalValidationUtils.isValidPhone(user.personalInfo.phone)) {
        errors.push(this.createError('personalInfo.phone', 'Invalid phone number format', 'INVALID_FORMAT'));
      }
    }

    // Employment info validation
    if (user.employmentInfo) {
      if (!user.employmentInfo.department?.trim()) {
        errors.push(this.createError('employmentInfo.department', 'Department is required', 'REQUIRED'));
      }

      if (!user.employmentInfo.ic?.trim()) {
        errors.push(this.createError('employmentInfo.ic', 'IC is required', 'REQUIRED'));
      }

      if (!user.employmentInfo.joiningDate) {
        errors.push(this.createError('employmentInfo.joiningDate', 'Joining date is required', 'REQUIRED'));
      }
    }

    // Bank details validation
    if (user.bankDetails) {
      if (!user.bankDetails.accountNumber?.trim()) {
        errors.push(this.createError('bankDetails.accountNumber', 'Account number is required', 'REQUIRED'));
      }

      if (!user.bankDetails.ifscCode) {
        errors.push(this.createError('bankDetails.ifscCode', 'IFSC code is required', 'REQUIRED'));
      } else if (!LocalValidationUtils.isValidIFSC(user.bankDetails.ifscCode)) {
        errors.push(this.createError('bankDetails.ifscCode', 'Invalid IFSC code format', 'INVALID_FORMAT'));
      }

      if (!user.bankDetails.bankName?.trim()) {
        errors.push(this.createError('bankDetails.bankName', 'Bank name is required', 'REQUIRED'));
      }
    }

    return this.createResult(errors);
  }
}

/**
 * Login validation
 */
export class LoginValidator extends BaseValidator<LoginRequest> {
  validate(loginData: LoginRequest): ValidationResult {
    const errors: ValidationError[] = [];

    if (!loginData.employeeId?.trim()) {
      errors.push(this.createError('employeeId', 'Employee ID is required', 'REQUIRED'));
    }

    if (!loginData.password) {
      errors.push(this.createError('password', 'Password is required', 'REQUIRED'));
    }

    return this.createResult(errors);
  }
}

/**
 * Password validation
 */
export class PasswordValidator extends BaseValidator<string> {
  validate(password: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!password) {
      errors.push(this.createError('password', 'Password is required', 'REQUIRED'));
      return this.createResult(errors);
    }

    if (password.length < 8) {
      errors.push(this.createError('password', 'Password must be at least 8 characters long', 'MIN_LENGTH'));
    }

    if (!/[a-z]/.test(password)) {
      errors.push(this.createError('password', 'Password must contain at least one lowercase letter', 'MISSING_LOWERCASE'));
    }

    if (!/[A-Z]/.test(password)) {
      errors.push(this.createError('password', 'Password must contain at least one uppercase letter', 'MISSING_UPPERCASE'));
    }

    if (!/\d/.test(password)) {
      errors.push(this.createError('password', 'Password must contain at least one number', 'MISSING_NUMBER'));
    }

    if (!/[@$!%*?&]/.test(password)) {
      errors.push(this.createError('password', 'Password must contain at least one special character (@$!%*?&)', 'MISSING_SPECIAL'));
    }

    return this.createResult(errors);
  }
}

/**
 * Application validation
 */
export class ApplicationValidator extends BaseValidator<Partial<Application>> {
  validate(application: Partial<Application>): ValidationResult {
    const errors: ValidationError[] = [];

    if (!application.userId?.trim()) {
      errors.push(this.createError('userId', 'User ID is required', 'REQUIRED'));
    }

    if (!application.schemeId?.trim()) {
      errors.push(this.createError('schemeId', 'Scheme ID is required', 'REQUIRED'));
    }

    if (application.applicationData) {
      if (!application.applicationData.claimAmount || application.applicationData.claimAmount <= 0) {
        errors.push(this.createError('applicationData.claimAmount', 'Valid claim amount is required', 'INVALID_AMOUNT'));
      }

      if (!application.applicationData.purpose?.trim()) {
        errors.push(this.createError('applicationData.purpose', 'Purpose is required', 'REQUIRED'));
      }

      if (!application.applicationData.beneficiary?.trim()) {
        errors.push(this.createError('applicationData.beneficiary', 'Beneficiary is required', 'REQUIRED'));
      }
    }

    return this.createResult(errors);
  }
}

/**
 * File upload validation
 */
export class FileUploadValidator extends BaseValidator<{ name: string; size: number; type: string }> {
  private static readonly ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  private static readonly MAX_SIZE = 5 * 1024 * 1024; // 5MB

  validate(file: { name: string; size: number; type: string }): ValidationResult {
    const errors: ValidationError[] = [];

    if (!file) {
      errors.push(this.createError('file', 'File is required', 'REQUIRED'));
      return this.createResult(errors);
    }

    if (!FileUploadValidator.ALLOWED_TYPES.includes(file.type)) {
      errors.push(this.createError('file', 'File type not allowed. Only PDF, JPG, and PNG files are supported', 'INVALID_TYPE'));
    }

    if (file.size > FileUploadValidator.MAX_SIZE) {
      errors.push(this.createError('file', 'File size exceeds 5MB limit', 'FILE_TOO_LARGE'));
    }

    if (file.size === 0) {
      errors.push(this.createError('file', 'File is empty', 'EMPTY_FILE'));
    }

    return this.createResult(errors);
  }
}

/**
 * Scheme validation
 */
export class SchemeValidator extends BaseValidator<Partial<Scheme>> {
  validate(scheme: Partial<Scheme>): ValidationResult {
    const errors: ValidationError[] = [];

    if (!scheme.name?.trim()) {
      errors.push(this.createError('name', 'Scheme name is required', 'REQUIRED'));
    }

    if (!scheme.category) {
      errors.push(this.createError('category', 'Scheme category is required', 'REQUIRED'));
    } else if (!['medical', 'education', 'skill_building'].includes(scheme.category)) {
      errors.push(this.createError('category', 'Invalid scheme category', 'INVALID_CATEGORY'));
    }

    if (!scheme.description?.trim()) {
      errors.push(this.createError('description', 'Scheme description is required', 'REQUIRED'));
    }

    if (!scheme.validFrom) {
      errors.push(this.createError('validFrom', 'Valid from date is required', 'REQUIRED'));
    }

    if (!scheme.validTo) {
      errors.push(this.createError('validTo', 'Valid to date is required', 'REQUIRED'));
    }

    if (scheme.validFrom && scheme.validTo && scheme.validFrom >= scheme.validTo) {
      errors.push(this.createError('validTo', 'Valid to date must be after valid from date', 'INVALID_DATE_RANGE'));
    }

    if (scheme.budgetInfo) {
      if (!scheme.budgetInfo.maxAmount || scheme.budgetInfo.maxAmount <= 0) {
        errors.push(this.createError('budgetInfo.maxAmount', 'Valid maximum amount is required', 'INVALID_AMOUNT'));
      }

      if (!scheme.budgetInfo.fiscalYear?.trim()) {
        errors.push(this.createError('budgetInfo.fiscalYear', 'Fiscal year is required', 'REQUIRED'));
      }
    }

    return this.createResult(errors);
  }
}

/**
 * Validation factory for creating validators
 */
export class ValidationFactory {
  static createUserValidator(): UserValidator {
    return new UserValidator();
  }

  static createLoginValidator(): LoginValidator {
    return new LoginValidator();
  }

  static createPasswordValidator(): PasswordValidator {
    return new PasswordValidator();
  }

  static createApplicationValidator(): ApplicationValidator {
    return new ApplicationValidator();
  }

  static createFileUploadValidator(): FileUploadValidator {
    return new FileUploadValidator();
  }

  static createSchemeValidator(): SchemeValidator {
    return new SchemeValidator();
  }
}

/**
 * Validation middleware helper
 */
export class ValidationHelper {
  static validateAndThrow<T>(validator: BaseValidator<T>, data: T): void {
    const result = validator.validate(data);
    if (!result.isValid) {
      const error = new Error('Validation failed');
      (error as any).validationErrors = result.errors;
      throw error;
    }
  }

  static formatValidationErrors(errors: ValidationError[]): string {
    return errors.map(error => `${error.field}: ${error.message}`).join(', ');
  }
}