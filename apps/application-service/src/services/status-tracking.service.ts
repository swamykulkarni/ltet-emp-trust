import { ApplicationRepository } from '../repositories/application.repository';
import { Application, ApplicationStatus, AuditTrailEntry } from '../models/application.model';

export interface TimelineEntry {
  timestamp: Date;
  status: ApplicationStatus;
  action: string;
  actor: string;
  comments?: string;
  details?: Record<string, any>;
}

export interface StatusUpdate {
  applicationId: string;
  previousStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
  updatedBy: string;
  comments?: string;
  timestamp: Date;
}

export interface ClarificationRequest {
  requestId: string;
  applicationId: string;
  requestedBy: string;
  requestedAt: Date;
  message: string;
  requiredDocuments?: string[];
  dueDate: Date;
  status: 'pending' | 'responded' | 'overdue';
}

export interface DocumentResubmission {
  resubmissionId: string;
  applicationId: string;
  originalDocumentId: string;
  newDocumentId: string;
  reason: string;
  submittedBy: string;
  submittedAt: Date;
}

export class StatusTrackingService {
  private applicationRepository: ApplicationRepository;

  constructor() {
    this.applicationRepository = new ApplicationRepository();
  }

  async getApplicationTimeline(applicationId: string): Promise<TimelineEntry[]> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    const timeline: TimelineEntry[] = [];

    // Add creation entry
    timeline.push({
      timestamp: application.createdAt,
      status: 'draft',
      action: 'application_created',
      actor: application.userId,
      comments: 'Application created'
    });

    // Add entries from audit trail
    for (const auditEntry of application.auditTrail) {
      timeline.push({
        timestamp: auditEntry.timestamp,
        status: this.extractStatusFromAuditEntry(auditEntry),
        action: auditEntry.action,
        actor: auditEntry.userId,
        comments: this.formatAuditEntryComments(auditEntry),
        details: auditEntry.details
      });
    }

    // Add entries from approval history
    for (const approval of application.workflow.approvalHistory) {
      const status = this.mapApprovalActionToStatus(approval.action);
      timeline.push({
        timestamp: approval.timestamp,
        status: status,
        action: `application_${approval.action}`,
        actor: approval.approverId,
        comments: approval.comments
      });
    }

    // Sort timeline by timestamp
    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async addStatusComment(
    applicationId: string, 
    userId: string, 
    comment: string, 
    isInternal: boolean = false
  ): Promise<Application> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    const auditEntry: AuditTrailEntry = {
      action: isInternal ? 'internal_comment_added' : 'comment_added',
      userId: userId,
      timestamp: new Date(),
      details: {
        comment,
        isInternal,
        currentStatus: application.workflow.currentStatus
      }
    };

    const updatedApplication = await this.applicationRepository.updateApplication(applicationId, {
      auditTrail: [...application.auditTrail, auditEntry]
    });

    if (!updatedApplication) {
      throw new Error('Failed to add comment');
    }

    return updatedApplication;
  }

  async requestClarification(
    applicationId: string,
    requestedBy: string,
    message: string,
    requiredDocuments?: string[],
    dueDays: number = 7
  ): Promise<ClarificationRequest> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    if (application.workflow.currentStatus !== 'under_review') {
      throw new Error('Can only request clarification for applications under review');
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    const clarificationRequest: ClarificationRequest = {
      requestId: `clarification-${Date.now()}`,
      applicationId,
      requestedBy,
      requestedAt: new Date(),
      message,
      requiredDocuments,
      dueDate,
      status: 'pending'
    };

    // Update application status back to submitted for clarification
    const updatedWorkflow = {
      ...application.workflow,
      currentStatus: 'submitted' as ApplicationStatus,
      slaDeadline: dueDate // Reset SLA to clarification due date
    };

    const auditEntry: AuditTrailEntry = {
      action: 'clarification_requested',
      userId: requestedBy,
      timestamp: new Date(),
      details: {
        message,
        requiredDocuments,
        dueDate,
        requestId: clarificationRequest.requestId,
        previousStatus: application.workflow.currentStatus
      }
    };

    await this.applicationRepository.updateApplication(applicationId, {
      workflow: updatedWorkflow,
      auditTrail: [...application.auditTrail, auditEntry]
    });

    return clarificationRequest;
  }

  async respondToClarification(
    applicationId: string,
    userId: string,
    response: string,
    newDocuments?: string[]
  ): Promise<Application> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    if (application.userId !== userId) {
      throw new Error('Only the applicant can respond to clarification requests');
    }

    // Find the latest clarification request in audit trail
    const clarificationEntry = application.auditTrail
      .filter(entry => entry.action === 'clarification_requested')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (!clarificationEntry) {
      throw new Error('No clarification request found');
    }

    const auditEntry: AuditTrailEntry = {
      action: 'clarification_responded',
      userId: userId,
      timestamp: new Date(),
      details: {
        response,
        newDocuments,
        originalRequestId: clarificationEntry.details?.requestId
      }
    };

    // Update application status back to under_review
    const updatedWorkflow = {
      ...application.workflow,
      currentStatus: 'under_review' as ApplicationStatus,
      slaDeadline: this.calculateNewSLADeadline() // Reset SLA for review
    };

    const updatedApplication = await this.applicationRepository.updateApplication(applicationId, {
      workflow: updatedWorkflow,
      auditTrail: [...application.auditTrail, auditEntry]
    });

    if (!updatedApplication) {
      throw new Error('Failed to respond to clarification');
    }

    return updatedApplication;
  }

  async resubmitDocument(
    applicationId: string,
    userId: string,
    originalDocumentId: string,
    newDocumentId: string,
    reason: string
  ): Promise<DocumentResubmission> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    if (application.userId !== userId) {
      throw new Error('Only the applicant can resubmit documents');
    }

    // Check if original document exists in application
    const originalDocument = application.documents.find(doc => doc.documentId === originalDocumentId);
    if (!originalDocument) {
      throw new Error('Original document not found in application');
    }

    const resubmission: DocumentResubmission = {
      resubmissionId: `resubmission-${Date.now()}`,
      applicationId,
      originalDocumentId,
      newDocumentId,
      reason,
      submittedBy: userId,
      submittedAt: new Date()
    };

    // Update documents array - replace the original document with new one
    const updatedDocuments = application.documents.map(doc => 
      doc.documentId === originalDocumentId 
        ? { ...doc, documentId: newDocumentId, uploadedAt: new Date(), validationStatus: 'pending' as const }
        : doc
    );

    const auditEntry: AuditTrailEntry = {
      action: 'document_resubmitted',
      userId: userId,
      timestamp: new Date(),
      details: {
        originalDocumentId,
        newDocumentId,
        reason,
        resubmissionId: resubmission.resubmissionId,
        documentType: originalDocument.type
      }
    };

    await this.applicationRepository.updateApplication(applicationId, {
      documents: updatedDocuments,
      auditTrail: [...application.auditTrail, auditEntry]
    });

    return resubmission;
  }

  async getApplicationsByStatusWithTimeline(status: ApplicationStatus): Promise<Array<Application & { timeline: TimelineEntry[] }>> {
    const applications = await this.applicationRepository.getApplicationsByStatus(status);
    
    const applicationsWithTimeline = await Promise.all(
      applications.map(async (app) => {
        const timeline = await this.getApplicationTimeline(app.applicationId);
        return { ...app, timeline };
      })
    );

    return applicationsWithTimeline;
  }

  async getOverdueApplications(): Promise<Application[]> {
    const applications = await this.applicationRepository.getApplicationsByStatus('under_review');
    const now = new Date();
    
    return applications.filter(app => app.workflow.slaDeadline < now);
  }

  async getApplicationComments(applicationId: string, includeInternal: boolean = false): Promise<AuditTrailEntry[]> {
    const application = await this.applicationRepository.getApplicationById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    return application.auditTrail.filter(entry => {
      const isComment = entry.action === 'comment_added' || entry.action === 'internal_comment_added';
      if (!isComment) return false;
      
      if (!includeInternal && entry.action === 'internal_comment_added') {
        return false;
      }
      
      return true;
    });
  }

  // Private helper methods
  private extractStatusFromAuditEntry(auditEntry: AuditTrailEntry): ApplicationStatus {
    if (auditEntry.details?.newStatus) {
      return auditEntry.details.newStatus;
    }
    
    // Map common actions to statuses
    const actionStatusMap: Record<string, ApplicationStatus> = {
      'application_created': 'draft',
      'application_submitted': 'submitted',
      'approver_assigned': 'under_review',
      'application_approved': 'approved',
      'application_rejected': 'rejected',
      'clarification_requested': 'submitted',
      'clarification_responded': 'under_review'
    };

    return actionStatusMap[auditEntry.action] || 'draft';
  }

  private formatAuditEntryComments(auditEntry: AuditTrailEntry): string {
    switch (auditEntry.action) {
      case 'application_submitted':
        return 'Application submitted for review';
      case 'approver_assigned':
        return `Assigned to approver: ${auditEntry.details?.approverId}`;
      case 'application_escalated':
        return `Escalated to level ${auditEntry.details?.escalationLevel}`;
      case 'clarification_requested':
        return `Clarification requested: ${auditEntry.details?.message}`;
      case 'clarification_responded':
        return 'Clarification provided by applicant';
      case 'document_resubmitted':
        return `Document resubmitted: ${auditEntry.details?.reason}`;
      case 'comment_added':
        return auditEntry.details?.comment || 'Comment added';
      default:
        return auditEntry.action.replace(/_/g, ' ');
    }
  }

  private mapApprovalActionToStatus(action: string): ApplicationStatus {
    switch (action) {
      case 'approve':
        return 'approved';
      case 'reject':
        return 'rejected';
      case 'clarify':
        return 'submitted';
      default:
        return 'under_review';
    }
  }

  private calculateNewSLADeadline(): Date {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7); // 7 days default SLA
    return deadline;
  }
}