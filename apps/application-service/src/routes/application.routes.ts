import { Router } from 'express';
import { ApplicationController } from '../controllers/application.controller';
import { ApprovalWorkflowController } from '../controllers/approval-workflow.controller';
import { StatusTrackingController } from '../controllers/status-tracking.controller';

const router = Router();
const applicationController = new ApplicationController();
const approvalWorkflowController = new ApprovalWorkflowController();
const statusTrackingController = new StatusTrackingController();

// Application management routes
router.post('/applications', applicationController.createApplication);
router.get('/applications/:id', applicationController.getApplication);
router.get('/users/:userId/applications', applicationController.getUserApplications);
router.post('/applications/:id/submit', applicationController.submitApplication);

// Approval workflow routes
router.post('/applications/:id/approve', applicationController.approveApplication);
router.post('/applications/:id/reject', applicationController.rejectApplication);
router.post('/applications/:id/clarify', applicationController.requestClarification);
router.get('/applications/status/:status', applicationController.getApplicationsByStatus);

// Advanced approval workflow routes
router.post('/applications/:applicationId/assign-approver', approvalWorkflowController.assignApprover);
router.post('/applications/:applicationId/conditional-approve', approvalWorkflowController.processConditionalApproval);
router.get('/approvers/:approverId/workload', approvalWorkflowController.getApproverWorkload);

// Status tracking and timeline routes
router.get('/applications/:applicationId/timeline', statusTrackingController.getApplicationTimeline);
router.post('/applications/:applicationId/comments', statusTrackingController.addStatusComment);
router.get('/applications/:applicationId/comments', statusTrackingController.getApplicationComments);
router.post('/applications/:applicationId/request-clarification', statusTrackingController.requestClarification);
router.post('/applications/:applicationId/respond-clarification', statusTrackingController.respondToClarification);
router.post('/applications/:applicationId/resubmit-document', statusTrackingController.resubmitDocument);
router.get('/status/:status/timeline', statusTrackingController.getApplicationsByStatusWithTimeline);
router.get('/applications/overdue', statusTrackingController.getOverdueApplications);

// Draft management routes
router.post('/drafts', applicationController.saveDraft);
router.put('/drafts/:id', applicationController.updateDraft);
router.get('/users/:userId/drafts', applicationController.getUserDrafts);
router.post('/drafts/:id/convert', applicationController.convertDraftToApplication);
router.delete('/drafts/:id', applicationController.deleteDraft);

// SLA and escalation routes
router.get('/sla/violations', applicationController.getSLAViolations);
router.post('/applications/:id/escalate', applicationController.escalateApplication);
router.post('/sla/bulk-escalate', approvalWorkflowController.bulkEscalateViolations);

export default router;