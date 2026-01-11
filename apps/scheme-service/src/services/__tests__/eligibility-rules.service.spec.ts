import { EligibilityRulesService } from '../eligibility-rules.service';
import { User, Scheme } from '@ltet/shared-types';

describe('EligibilityRulesService', () => {
  let eligibilityService: EligibilityRulesService;

  beforeEach(() => {
    eligibilityService = new EligibilityRulesService();
  });

  describe('evaluateEligibility', () => {
    const mockUser: User = {
      userId: 'test-user-id',
      employeeId: 'EMP001',
      personalInfo: {
        name: 'Test User',
        email: 'test@ltet.com',
        phone: '9999999999',
        address: {
          street: 'Test Street',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
          country: 'India'
        }
      },
      employmentInfo: {
        department: 'IT',
        ic: 'LTET',
        joiningDate: new Date('2020-01-01'),
        status: 'active'
      },
      dependents: [
        {
          name: 'Test Dependent',
          relationship: 'child',
          dateOfBirth: new Date('2015-01-01'),
          documents: []
        }
      ],
      roles: ['employee'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockScheme: Scheme = {
      schemeId: 'test-scheme-id',
      name: 'Test Scheme',
      category: 'medical',
      description: 'Test description',
      eligibilityRules: {},
      documentRequirements: [],
      approvalWorkflow: { levels: [], slaHours: 24, escalationRules: {} },
      budgetInfo: { maxAmount: 10000, fiscalYear: '2024', utilizationLimit: 100 },
      status: 'active',
      validFrom: new Date(),
      validTo: new Date()
    };

    it('should return true for user meeting all criteria', async () => {
      const scheme = {
        ...mockScheme,
        eligibilityRules: {
          serviceYears: 3,
          icRestrictions: ['LTET']
        }
      };

      const result = await eligibilityService.evaluateEligibility(mockUser, scheme);
      expect(result).toBe(true);
    });

    it('should return false for user not meeting service years requirement', async () => {
      const scheme = {
        ...mockScheme,
        eligibilityRules: {
          serviceYears: 10 // User has only ~4 years
        }
      };

      const result = await eligibilityService.evaluateEligibility(mockUser, scheme);
      expect(result).toBe(false);
    });

    it('should return false for user not in allowed IC', async () => {
      const scheme = {
        ...mockScheme,
        eligibilityRules: {
          icRestrictions: ['OTHER_IC']
        }
      };

      const result = await eligibilityService.evaluateEligibility(mockUser, scheme);
      expect(result).toBe(false);
    });

    it('should return false when dependent age requirement not met', async () => {
      const scheme = {
        ...mockScheme,
        eligibilityRules: {
          dependentAge: 5 // User's dependent is ~9 years old
        }
      };

      const result = await eligibilityService.evaluateEligibility(mockUser, scheme);
      expect(result).toBe(false);
    });

    it('should return true when dependent age requirement is met', async () => {
      const scheme = {
        ...mockScheme,
        eligibilityRules: {
          dependentAge: 15 // User's dependent is ~9 years old
        }
      };

      const result = await eligibilityService.evaluateEligibility(mockUser, scheme);
      expect(result).toBe(true);
    });
  });

  describe('createRuleBuilder', () => {
    it('should create empty rule builder when no existing rules', () => {
      const ruleBuilder = eligibilityService.createRuleBuilder();

      expect(ruleBuilder.rules).toEqual([]);
      expect(ruleBuilder.logic).toBe('AND');
    });

    it('should create rule builder from existing rules', () => {
      const existingRules = {
        serviceYears: 5,
        icRestrictions: ['LTET', 'OTHER'],
        dependentAge: 18
      };

      const ruleBuilder = eligibilityService.createRuleBuilder(existingRules);

      expect(ruleBuilder.rules).toHaveLength(3);
      expect(ruleBuilder.rules[0].type).toBe('service_years');
      expect(ruleBuilder.rules[0].value).toBe(5);
      expect(ruleBuilder.rules[1].type).toBe('ic_restriction');
      expect(ruleBuilder.rules[1].value).toEqual(['LTET', 'OTHER']);
      expect(ruleBuilder.rules[2].type).toBe('dependent_age');
      expect(ruleBuilder.rules[2].value).toBe(18);
    });
  });

  describe('validateRuleBuilder', () => {
    it('should validate correct rule builder', () => {
      const ruleBuilder = {
        rules: [
          {
            id: 'service_years',
            type: 'service_years' as const,
            operator: 'greater_than' as const,
            value: 5,
            description: 'Service years must be greater than 5'
          }
        ],
        logic: 'AND' as const
      };

      const validation = eligibilityService.validateRuleBuilder(ruleBuilder);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should return errors for invalid rule builder', () => {
      const ruleBuilder = {
        rules: [
          {
            id: 'service_years',
            type: 'service_years' as const,
            operator: 'greater_than' as const,
            value: -1, // Invalid negative value
            description: 'Invalid service years'
          }
        ],
        logic: 'AND' as const
      };

      const validation = eligibilityService.validateRuleBuilder(ruleBuilder);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Service years must be a positive number');
    });
  });

  describe('getAvailableRuleTypes', () => {
    it('should return all available rule types', () => {
      const ruleTypes = eligibilityService.getAvailableRuleTypes();

      expect(ruleTypes).toHaveLength(4);
      expect(ruleTypes.map(rt => rt.type)).toEqual([
        'service_years',
        'salary_range',
        'ic_restriction',
        'dependent_age'
      ]);
    });
  });
});