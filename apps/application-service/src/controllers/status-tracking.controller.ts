import { Request, Response } from 'express';
import { StatusTrackingService } from '../services/status-tracking.service';

export class StatusTrackingController {
  private statusTrackingService: StatusTrackingService;

  constructor() {
    this.statusTrackingService = new StatusTrackingService();
  }

  getApplicationTimeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      
      const timeline = await this.statusTrackingService.getApplicationTimeline(applicationId);

      res.json({
        success: true,
        data: timeline,
        count: timeline.length
      });
    } catch (error) {
      res.status(404).json({
        error: error instanceof Error ? error.message : 'Failed to get application timeline'
      });
    }
  };

  addStatusComment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { userId, comment, isInternal } = req.body;

      if (!userId || !comment) {
        res.status(400).json({
          error: 'userId and comment are required'
        });
        return;
      }

      const application = await this.statusTrackingService.addStatusComment(
        applicationId,
        userId,
        comment,
        isInternal || false
      );

      res.json({
        success: true,
        data: application,
        message: 'Comment added successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to add comment'
      });
    }
  };

  requestClarification = async (req: Request, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { requestedBy, message, requiredDocuments, dueDays } = req.body;

      if (!requestedBy || !message) {
        res.status(400).json({
          error: 'requestedBy and message are required'
        });
        return;
      }

      const clarificationRequest = await this.statusTrackingService.requestClarification(
        applicationId,
        requestedBy,
        message,
        requiredDocuments,
        dueDays
      );

      res.json({
        success: true,
        data: clarificationRequest,
        message: 'Clarification requested successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to request clarification'
      });
    }
  };

  respondToClarification = async (req: Request, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { userId, response, newDocuments } = req.body;

      if (!userId || !response) {
        res.status(400).json({
          error: 'userId and response are required'
        });
        return;
      }

      const application = await this.statusTrackingService.respondToClarification(
        applicationId,
        userId,
        response,
        newDocuments
      );

      res.json({
        success: true,
        data: application,
        message: 'Clarification response submitted successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to respond to clarification'
      });
    }
  };

  resubmitDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { userId, originalDocumentId, newDocumentId, reason } = req.body;

      if (!userId || !originalDocumentId || !newDocumentId || !reason) {
        res.status(400).json({
          error: 'userId, originalDocumentId, newDocumentId, and reason are required'
        });
        return;
      }

      const resubmission = await this.statusTrackingService.resubmitDocument(
        applicationId,
        userId,
        originalDocumentId,
        newDocumentId,
        reason
      );

      res.json({
        success: true,
        data: resubmission,
        message: 'Document resubmitted successfully'
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to resubmit document'
      });
    }
  };

  getApplicationsByStatusWithTimeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.params;
      const validStatuses = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'disbursed'];
      
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          error: `Invalid status. Valid statuses: ${validStatuses.join(', ')}`
        });
        return;
      }

      const applications = await this.statusTrackingService.getApplicationsByStatusWithTimeline(status as any);

      res.json({
        success: true,
        data: applications,
        count: applications.length
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get applications with timeline'
      });
    }
  };

  getOverdueApplications = async (req: Request, res: Response): Promise<void> => {
    try {
      const overdueApplications = await this.statusTrackingService.getOverdueApplications();

      res.json({
        success: true,
        data: overdueApplications,
        count: overdueApplications.length,
        message: `Found ${overdueApplications.length} overdue applications`
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get overdue applications'
      });
    }
  };

  getApplicationComments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { includeInternal } = req.query;

      const comments = await this.statusTrackingService.getApplicationComments(
        applicationId,
        includeInternal === 'true'
      );

      res.json({
        success: true,
        data: comments,
        count: comments.length
      });
    } catch (error) {
      res.status(404).json({
        error: error instanceof Error ? error.message : 'Failed to get application comments'
      });
    }
  };
}