// Core entity types for LTET Employee Trust Portal

export interface User {
  userId: string;
  employeeId: string;
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    address: Address;
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
  dependents: Dependent[];
  roles: UserRole[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface Dependent {
  name: string;
  relationship: string;
  dateOfBirth: Date;
  documents: string[];
}

export type UserRole = 'employee' | 'approver' | 'finance' | 'admin' | 'head' | 'system_admin';

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
  documentRequirements: DocumentRequirement[];
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

export interface DocumentRequirement {
  type: string;
  mandatory: boolean;
  validationRules: Record<string, any>;
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
  documents: ApplicationDocument[];
  workflow: {
    currentStatus: ApplicationStatus;
    approvalHistory: ApprovalAction[];
    slaDeadline: Date;
    escalationLevel: number;
  };
  paymentInfo?: {
    approvedAmount: number;
    paymentStatus: 'pending' | 'processed' | 'failed';
    transactionId?: string;
    processedAt?: Date;
  };
  auditTrail: AuditEntry[];
}

export type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'disbursed';

export interface ApplicationDocument {
  documentId: string;
  type: string;
  uploadedAt: Date;
  validationStatus: 'pending' | 'validated' | 'failed';
}

export interface ApprovalAction {
  approverId: string;
  action: 'approve' | 'reject' | 'clarify';
  comments: string;
  timestamp: Date;
}

export interface AuditEntry {
  action: string;
  userId: string;
  timestamp: Date;
  details: Record<string, any>;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Authentication types
export interface LoginRequest {
  employeeId: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
  expiresIn: number;
}

export interface JWTPayload {
  userId: string;
  employeeId: string;
  roles: UserRole[];
  iat: number;
  exp: number;
}