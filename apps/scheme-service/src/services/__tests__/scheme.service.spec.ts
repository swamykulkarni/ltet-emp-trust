import { SchemeService } from '../scheme.service';
import { SchemeRepository } from '../../repositories/scheme.repository';
import { EligibilityRulesService } from '../eligibility-rules.service';
import { CreateSchemeRequest } from '../../models/scheme.model';

// Mock the dependencies
jest.mock('../../repositories/scheme.repository');
jest.mock('../eligibility-rules.service');

describe('SchemeService', () => {
  let schemeService: SchemeService;
  let mockSchemeRepository: jest.Mocked<SchemeRepository>;
  let mockEligibilityService: jest.Mocked<EligibilityRulesService>;

  beforeEach(() => {
    mockSchemeRepository = new SchemeRepository() as jest.Mocked<SchemeRepository>;
    mockEligibilityService = new EligibilityRulesService() as jest.Mocked<EligibilityRulesService>;
    
    schemeService = new SchemeService();
    (schemeService as any).schemeRepository = mockSchemeRepository;
    (schemeService as any).eligibilityService = mockEligibilityService;
  });

  describe('createScheme', () => {
    it('should create a scheme successfully', async () => {
      const schemeData: CreateSchemeRequest = {
        name: 'Test Medical Scheme',
        category: 'medical',
        description: 'A test medical scheme',
        eligibilityRules: {
          serviceYears: 2
        },
        documentRequirements: [
          {
            type: 'medical_certificate',
            mandatory: true,
            validationRules: {}
          }
        ],
        approvalWorkflow: {
          levels: ['approver'],
          slaHours: 48,
          escalationRules: {}
        },
        budgetInfo: {
          maxAmount: 50000,
          fiscalYear: '2024-25',
          utilizationLimit: 100
        },
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2024-12-31')
      };

      const expectedScheme = {
        schemeId: 'test-scheme-id',
        ...schemeData,
        status: 'draft' as const
      };

      mockSchemeRepository.create.mockResolvedValue(expectedScheme);

      const result = await schemeService.createScheme(schemeData, 'test-user-id');

      expect(mockSchemeRepository.create).toHaveBeenCalledWith(schemeData, 'test-user-id');
      expect(result).toEqual(expectedScheme);
    });

    it('should throw error for invalid scheme data', async () => {
      const invalidSchemeData = {
        name: '',
        category: 'medical',
        description: 'Test description'
      } as CreateSchemeRequest;

      await expect(schemeService.createScheme(invalidSchemeData, 'test-user-id'))
        .rejects.toThrow('Scheme name is required');
    });
  });

  describe('getSchemeById', () => {
    it('should return scheme when found', async () => {
      const expectedScheme = {
        schemeId: 'test-scheme-id',
        name: 'Test Scheme',
        category: 'medical' as const,
        description: 'Test description',
        eligibilityRules: {},
        documentRequirements: [],
        approvalWorkflow: { levels: [], slaHours: 24, escalationRules: {} },
        budgetInfo: { maxAmount: 10000, fiscalYear: '2024', utilizationLimit: 100 },
        status: 'active' as const,
        validFrom: new Date(),
        validTo: new Date()
      };

      mockSchemeRepository.findById.mockResolvedValue(expectedScheme);

      const result = await schemeService.getSchemeById('test-scheme-id');

      expect(mockSchemeRepository.findById).toHaveBeenCalledWith('test-scheme-id');
      expect(result).toEqual(expectedScheme);
    });

    it('should return null when scheme not found', async () => {
      mockSchemeRepository.findById.mockResolvedValue(null);

      const result = await schemeService.getSchemeById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('publishScheme', () => {
    it('should publish a draft scheme successfully', async () => {
      const draftScheme = {
        schemeId: 'test-scheme-id',
        name: 'Test Scheme',
        category: 'medical' as const,
        description: 'Test description',
        eligibilityRules: {},
        documentRequirements: [{ type: 'test', mandatory: true, validationRules: {} }],
        approvalWorkflow: { levels: ['approver'], slaHours: 24, escalationRules: {} },
        budgetInfo: { maxAmount: 10000, fiscalYear: '2024', utilizationLimit: 100 },
        status: 'draft' as const,
        validFrom: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Next year
      };

      const publishedScheme = { ...draftScheme, status: 'active' as const };

      mockSchemeRepository.findById.mockResolvedValue(draftScheme);
      mockSchemeRepository.publish.mockResolvedValue(publishedScheme);

      const result = await schemeService.publishScheme('test-scheme-id');

      expect(mockSchemeRepository.publish).toHaveBeenCalledWith('test-scheme-id');
      expect(result).toEqual(publishedScheme);
    });

    it('should throw error when trying to publish non-draft scheme', async () => {
      const activeScheme = {
        schemeId: 'test-scheme-id',
        status: 'active' as const
      } as any;

      mockSchemeRepository.findById.mockResolvedValue(activeScheme);

      await expect(schemeService.publishScheme('test-scheme-id'))
        .rejects.toThrow('Only draft schemes can be published');
    });
  });
});