import { ApplicationService } from '../application.service';
import { ApplicationRepository } from '../../repositories/application.repository';

// Mock the repository
jest.mock('../../repositories/application.repository');

describe('ApplicationService', () => {
  let applicationService: ApplicationService;
  let mockApplicationRepository: jest.Mocked<ApplicationRepository>;

  beforeEach(() => {
    applicationService = new ApplicationService();
    mockApplicationRepository = new ApplicationRepository() as jest.Mocked<ApplicationRepository>;
    (applicationService as any).applicationRepository = mockApplicationRepository;
  });

  describe('createApplication', () => {
    it('should create an application with draft status', async () => {
      const mockApplication = {
        applicationId: 'test-app-id',
        userId: 'test-user-id',
        schemeId: 'test-scheme-id',
        applicationData: {
          claimAmount: 10000,
          purpose: 'Medical treatment',
          beneficiary: 'Self',
          customFields: {}
        },
        documents: [],
        workflow: {
          currentStatus: 'draft' as const,
          approvalHistory: [],
          slaDeadline: expect.any(Date),
          escalationLevel: 0
        },
        auditTrail: [{
          action: 'application_created',
          userId: 'test-user-id',
          timestamp: expect.any(Date),
          details: { status: 'draft' }
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockApplicationRepository.createApplication.mockResolvedValue(mockApplication);

      const result = await applicationService.createApplication({
        userId: 'test-user-id',
        schemeId: 'test-scheme-id',
        claimAmount: 10000,
        purpose: 'Medical treatment',
        beneficiary: 'Self'
      });

      expect(result).toEqual(mockApplication);
      expect(mockApplicationRepository.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-id',
          schemeId: 'test-scheme-id',
          applicationData: {
            claimAmount: 10000,
            purpose: 'Medical treatment',
            beneficiary: 'Self',
            customFields: {}
          },
          workflow: expect.objectContaining({
            currentStatus: 'draft'
          })
        })
      );
    });
  });

  describe('submitApplication', () => {
    it('should submit a draft application', async () => {
      const mockDraftApplication = {
        applicationId: 'test-app-id',
        userId: 'test-user-id',
        schemeId: 'test-scheme-id',
        applicationData: {
          claimAmount: 10000,
          purpose: 'Medical treatment',
          beneficiary: 'Self',
          customFields: {}
        },
        documents: [{
          documentId: 'doc-1',
          type: 'medical-bill',
          uploadedAt: new Date(),
          validationStatus: 'validated' as const
        }],
        workflow: {
          currentStatus: 'draft' as const,
          approvalHistory: [],
          slaDeadline: new Date(),
          escalationLevel: 0
        },
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockSubmittedApplication = {
        ...mockDraftApplication,
        workflow: {
          ...mockDraftApplication.workflow,
          currentStatus: 'submitted' as const
        }
      };

      mockApplicationRepository.getApplicationById.mockResolvedValue(mockDraftApplication);
      mockApplicationRepository.updateApplication.mockResolvedValue(mockSubmittedApplication);

      const result = await applicationService.submitApplication('test-app-id', 'test-user-id');

      expect(result).toEqual(mockSubmittedApplication);
      expect(mockApplicationRepository.updateApplication).toHaveBeenCalledWith(
        'test-app-id',
        expect.objectContaining({
          workflow: expect.objectContaining({
            currentStatus: 'submitted'
          })
        })
      );
    });

    it('should throw error if application not found', async () => {
      mockApplicationRepository.getApplicationById.mockResolvedValue(null);

      await expect(
        applicationService.submitApplication('non-existent-id', 'test-user-id')
      ).rejects.toThrow('Application not found');
    });

    it('should throw error for unauthorized access', async () => {
      const mockApplication = {
        applicationId: 'test-app-id',
        userId: 'different-user-id',
        schemeId: 'test-scheme-id',
        applicationData: {
          claimAmount: 10000,
          purpose: 'Medical treatment',
          beneficiary: 'Self',
          customFields: {}
        },
        documents: [],
        workflow: {
          currentStatus: 'draft' as const,
          approvalHistory: [],
          slaDeadline: new Date(),
          escalationLevel: 0
        },
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockApplicationRepository.getApplicationById.mockResolvedValue(mockApplication);

      await expect(
        applicationService.submitApplication('test-app-id', 'test-user-id')
      ).rejects.toThrow('Unauthorized access to application');
    });
  });

  describe('processApprovalAction', () => {
    it('should approve an application', async () => {
      const mockApplication = {
        applicationId: 'test-app-id',
        userId: 'test-user-id',
        schemeId: 'test-scheme-id',
        applicationData: {
          claimAmount: 10000,
          purpose: 'Medical treatment',
          beneficiary: 'Self',
          customFields: {}
        },
        documents: [],
        workflow: {
          currentStatus: 'under_review' as const,
          approvalHistory: [],
          slaDeadline: new Date(),
          escalationLevel: 0
        },
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockApprovedApplication = {
        ...mockApplication,
        workflow: {
          ...mockApplication.workflow,
          currentStatus: 'approved' as const,
          approvalHistory: [{
            approverId: 'approver-1',
            action: 'approve' as const,
            comments: 'Approved for processing',
            timestamp: expect.any(Date)
          }]
        }
      };

      mockApplicationRepository.getApplicationById.mockResolvedValue(mockApplication);
      mockApplicationRepository.updateApplication.mockResolvedValue(mockApprovedApplication);

      const result = await applicationService.processApprovalAction(
        'test-app-id',
        'approver-1',
        'approve',
        'Approved for processing'
      );

      expect(result).toEqual(mockApprovedApplication);
      expect(mockApplicationRepository.updateApplication).toHaveBeenCalledWith(
        'test-app-id',
        expect.objectContaining({
          workflow: expect.objectContaining({
            currentStatus: 'approved',
            approvalHistory: expect.arrayContaining([
              expect.objectContaining({
                approverId: 'approver-1',
                action: 'approve',
                comments: 'Approved for processing'
              })
            ])
          })
        })
      );
    });
  });
});