export interface ApplicationDocument {
  documentId: string;
  type: string;
  uploadedAt: Date;
  validationStatus: 'pending' | 'validated' | 'failed';
}

export interface ApprovalHistoryEntry {
  approverId: string;
  action: 'approve' | 'reject' | 'clarify';
  comments: string;
  timestamp: Date;
}

export interface ApplicationWorkflow {
  currentStatus: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'disbursed';
  approvalHistory: ApprovalHistoryEntry[];
  slaDeadline: Date;
  escalationLevel: number;
}

export interface PaymentInfo {
  approvedAmount: number;
  paymentStatus: 'pending' | 'processed' | 'failed';
  transactionId?: string;
  processedAt?: Date;
}

export interface AuditTrailEntry {
  action: string;
  userId: string;
  timestamp: Date;
  details: Record<string, any>;
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
  workflow: ApplicationWorkflow;
  paymentInfo?: PaymentInfo;
  auditTrail: AuditTrailEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationDraft {
  draftId: string;
  userId: string;
  schemeId: string;
  applicationData: Partial<Application['applicationData']>;
  documents: ApplicationDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export type ApplicationStatus = Application['workflow']['currentStatus'];
export type ApprovalAction = ApprovalHistoryEntry['action'];

// State machine transitions
export const APPLICATION_STATE_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  'draft': ['submitted'],
  'submitted': ['under_review', 'rejected'],
  'under_review': ['approved', 'rejected', 'submitted'], // submitted for clarification
  'approved': ['disbursed'],
  'rejected': [],
  'disbursed': []
};

export const isValidStateTransition = (from: ApplicationStatus, to: ApplicationStatus): boolean => {
  return APPLICATION_STATE_TRANSITIONS[from]?.includes(to) || false;
};