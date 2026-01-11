import pool from '../database/connection';
import { Application, ApplicationDraft, ApplicationStatus, ApprovalHistoryEntry, AuditTrailEntry } from '../models/application.model';

export class ApplicationRepository {
  async createApplication(application: Omit<Application, 'applicationId' | 'createdAt' | 'updatedAt'>): Promise<Application> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const applicationResult = await client.query(
        `INSERT INTO applications.applications (
          user_id, scheme_id, application_data, workflow, 
          payment_info, status, sla_deadline, escalation_level, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) 
        RETURNING application_id, created_at, updated_at`,
        [
          application.userId,
          application.schemeId,
          JSON.stringify(application.applicationData),
          JSON.stringify(application.workflow),
          JSON.stringify(application.paymentInfo),
          application.workflow.currentStatus,
          application.workflow.slaDeadline,
          application.workflow.escalationLevel
        ]
      );

      // Insert audit trail entries
      for (const auditEntry of application.auditTrail) {
        await client.query(
          `INSERT INTO audit.audit_trail (user_id, action, resource_type, resource_id, new_values, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            auditEntry.userId,
            auditEntry.action,
            'application',
            applicationResult.rows[0].application_id,
            JSON.stringify(auditEntry.details),
            auditEntry.timestamp
          ]
        );
      }

      await client.query('COMMIT');

      return {
        ...application,
        applicationId: applicationResult.rows[0].application_id,
        createdAt: applicationResult.rows[0].created_at,
        updatedAt: applicationResult.rows[0].updated_at
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getApplicationById(applicationId: string): Promise<Application | null> {
    const result = await pool.query(
      `SELECT a.*, 
              COALESCE(
                json_agg(
                  json_build_object(
                    'action', at.action,
                    'userId', at.user_id,
                    'timestamp', at.created_at,
                    'details', at.new_values
                  ) ORDER BY at.created_at
                ) FILTER (WHERE at.audit_id IS NOT NULL), 
                '[]'::json
              ) as audit_trail
       FROM applications.applications a
       LEFT JOIN audit.audit_trail at ON at.resource_id = a.application_id AND at.resource_type = 'application'
       WHERE a.application_id = $1
       GROUP BY a.application_id`,
      [applicationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    // Get documents for this application
    const documentsResult = await pool.query(
      `SELECT document_id, document_type, validation_status, uploaded_at
       FROM documents.documents 
       WHERE application_id = $1`,
      [applicationId]
    );

    const documents = documentsResult.rows.map(doc => ({
      documentId: doc.document_id,
      type: doc.document_type,
      uploadedAt: doc.uploaded_at,
      validationStatus: doc.validation_status
    }));

    // Get approval history
    const approvalResult = await pool.query(
      `SELECT approver_id, action, comments, created_at
       FROM applications.approval_history 
       WHERE application_id = $1
       ORDER BY created_at`,
      [applicationId]
    );

    const approvalHistory = approvalResult.rows.map(approval => ({
      approverId: approval.approver_id,
      action: approval.action,
      comments: approval.comments,
      timestamp: approval.created_at
    }));

    return {
      applicationId: row.application_id,
      userId: row.user_id,
      schemeId: row.scheme_id,
      applicationData: JSON.parse(row.application_data),
      documents: documents,
      workflow: {
        currentStatus: row.status,
        approvalHistory: approvalHistory,
        slaDeadline: row.sla_deadline,
        escalationLevel: row.escalation_level
      },
      paymentInfo: row.payment_info ? JSON.parse(row.payment_info) : undefined,
      auditTrail: row.audit_trail,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async updateApplication(applicationId: string, updates: Partial<Application>): Promise<Application | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      if (updates.applicationData) {
        setClause.push(`application_data = $${paramIndex++}`);
        values.push(JSON.stringify(updates.applicationData));
      }
      if (updates.workflow) {
        setClause.push(`status = $${paramIndex++}`);
        values.push(updates.workflow.currentStatus);
        setClause.push(`sla_deadline = $${paramIndex++}`);
        values.push(updates.workflow.slaDeadline);
        setClause.push(`escalation_level = $${paramIndex++}`);
        values.push(updates.workflow.escalationLevel);
      }
      if (updates.paymentInfo) {
        setClause.push(`payment_info = $${paramIndex++}`);
        values.push(JSON.stringify(updates.paymentInfo));
      }

      setClause.push(`updated_at = NOW()`);
      values.push(applicationId);

      const result = await client.query(
        `UPDATE applications.applications SET ${setClause.join(', ')} 
         WHERE application_id = $${paramIndex} 
         RETURNING *`,
        values
      );

      // Insert new approval history entries if workflow was updated
      if (updates.workflow && updates.workflow.approvalHistory) {
        const lastApproval = updates.workflow.approvalHistory[updates.workflow.approvalHistory.length - 1];
        if (lastApproval) {
          await client.query(
            `INSERT INTO applications.approval_history (application_id, approver_id, action, comments, created_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              applicationId,
              lastApproval.approverId,
              lastApproval.action,
              lastApproval.comments,
              lastApproval.timestamp
            ]
          );
        }
      }

      // Insert audit trail entries if provided
      if (updates.auditTrail) {
        for (const auditEntry of updates.auditTrail) {
          await client.query(
            `INSERT INTO audit.audit_trail (user_id, action, resource_type, resource_id, new_values, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              auditEntry.userId,
              auditEntry.action,
              'application',
              applicationId,
              JSON.stringify(auditEntry.details),
              auditEntry.timestamp
            ]
          );
        }
      }

      await client.query('COMMIT');

      if (result.rows.length === 0) {
        return null;
      }

      // Return the updated application by fetching it again
      return await this.getApplicationById(applicationId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getApplicationsByUserId(userId: string): Promise<Application[]> {
    const result = await pool.query(
      `SELECT * FROM applications.applications WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    const applications = [];
    for (const row of result.rows) {
      const app = await this.getApplicationById(row.application_id);
      if (app) applications.push(app);
    }

    return applications;
  }

  async getApplicationsByStatus(status: ApplicationStatus): Promise<Application[]> {
    const result = await pool.query(
      `SELECT * FROM applications.applications WHERE status = $1 ORDER BY created_at ASC`,
      [status]
    );

    const applications = [];
    for (const row of result.rows) {
      const app = await this.getApplicationById(row.application_id);
      if (app) applications.push(app);
    }

    return applications;
  }

  // Draft management methods
  async createDraft(draft: Omit<ApplicationDraft, 'draftId' | 'createdAt' | 'updatedAt'>): Promise<ApplicationDraft> {
    const result = await pool.query(
      `INSERT INTO applications.application_drafts (
        user_id, scheme_id, application_data, documents, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW()) 
      RETURNING draft_id, created_at, updated_at`,
      [
        draft.userId,
        draft.schemeId,
        JSON.stringify(draft.applicationData),
        JSON.stringify(draft.documents)
      ]
    );

    return {
      ...draft,
      draftId: result.rows[0].draft_id,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };
  }

  async getDraftById(draftId: string): Promise<ApplicationDraft | null> {
    const result = await pool.query(
      `SELECT * FROM applications.application_drafts WHERE draft_id = $1`,
      [draftId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      draftId: row.draft_id,
      userId: row.user_id,
      schemeId: row.scheme_id,
      applicationData: JSON.parse(row.application_data),
      documents: JSON.parse(row.documents),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getDraftsByUserId(userId: string): Promise<ApplicationDraft[]> {
    const result = await pool.query(
      `SELECT * FROM applications.application_drafts WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      draftId: row.draft_id,
      userId: row.user_id,
      schemeId: row.scheme_id,
      applicationData: JSON.parse(row.application_data),
      documents: JSON.parse(row.documents),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async updateDraft(draftId: string, updates: Partial<ApplicationDraft>): Promise<ApplicationDraft | null> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (updates.applicationData) {
      setClause.push(`application_data = $${paramIndex++}`);
      values.push(JSON.stringify(updates.applicationData));
    }
    if (updates.documents) {
      setClause.push(`documents = $${paramIndex++}`);
      values.push(JSON.stringify(updates.documents));
    }

    setClause.push(`updated_at = NOW()`);
    values.push(draftId);

    const result = await pool.query(
      `UPDATE applications.application_drafts SET ${setClause.join(', ')} 
       WHERE draft_id = $${paramIndex} 
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      draftId: row.draft_id,
      userId: row.user_id,
      schemeId: row.scheme_id,
      applicationData: JSON.parse(row.application_data),
      documents: JSON.parse(row.documents),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async deleteDraft(draftId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM applications.application_drafts WHERE draft_id = $1`,
      [draftId]
    );

    return result.rowCount > 0;
  }
}