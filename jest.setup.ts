// Global test setup for LTET Employee Trust Portal

import 'jest-extended';

// Mock environment variables for tests
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/ltet_test';
process.env['REDIS_URL'] = 'redis://localhost:6379';

// Mock external services
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    upload: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Location: 'test-s3-url' })
    }),
    getObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Body: Buffer.from('test-file-content') })
    })
  })),
  config: {
    update: jest.fn()
  }
}));

// Global test utilities
global.testUtils = {
  createMockUser: () => ({
    userId: 'test-user-id',
    employeeId: 'TEST001',
    personalInfo: {
      name: 'Test User',
      email: 'test@example.com',
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
      department: 'Test Department',
      ic: 'TEST_IC',
      joiningDate: new Date('2020-01-01'),
      status: 'active' as const
    },
    roles: ['employee' as const],
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  createMockScheme: () => ({
    schemeId: 'test-scheme-id',
    name: 'Test Scheme',
    category: 'medical' as const,
    description: 'Test scheme description',
    eligibilityRules: {
      serviceYears: 1,
      salaryRange: { min: 0, max: 1000000 }
    },
    documentRequirements: [],
    approvalWorkflow: {
      levels: ['approver'],
      slaHours: 72,
      escalationRules: {}
    },
    budgetInfo: {
      maxAmount: 100000,
      fiscalYear: '2024-25',
      utilizationLimit: 80
    },
    status: 'active' as const,
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2024-12-31')
  }),

  createMockApplication: () => ({
    applicationId: 'test-application-id',
    userId: 'test-user-id',
    schemeId: 'test-scheme-id',
    applicationData: {
      claimAmount: 50000,
      purpose: 'Test purpose',
      beneficiary: 'Test beneficiary',
      customFields: {}
    },
    documents: [],
    workflow: {
      currentStatus: 'draft' as const,
      approvalHistory: [],
      slaDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
      escalationLevel: 0
    },
    auditTrail: []
  })
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidEmail(): R;
      toBeValidPhone(): R;
      toBeValidIFSC(): R;
    }
  }

  var testUtils: {
    createMockUser: () => any;
    createMockScheme: () => any;
    createMockApplication: () => any;
  };
}

// Custom matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass
    };
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid email`,
      pass
    };
  },

  toBeValidPhone(received: string) {
    const phoneRegex = /^[6-9]\d{9}$/;
    const pass = phoneRegex.test(received.replace(/\D/g, ''));
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid phone number`,
      pass
    };
  },

  toBeValidIFSC(received: string) {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    const pass = ifscRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid IFSC code`,
      pass
    };
  }
});

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});