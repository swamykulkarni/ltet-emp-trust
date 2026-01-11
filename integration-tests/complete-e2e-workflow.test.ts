import axios from 'axios';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Service endpoints
const SERVICES = {
  USER_SERVICE: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  SCHEME_SERVICE: process.env.SCHEME_SERVICE_URL || 'http://localhost:3002',
  APPLICATION_SERVICE: process.env.APPLICATION_SERVICE_URL || 'http://localhost:3003',
  DOCUMENT_SERVICE: process.env.DOCUMENT_SERVICE_URL || 'http://localhost:3004',
  NOTIFICATION_SERVICE: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005'
};

// Test data for complete workflow
const TEST_DATA = {
  employee: {
    employeeId: 'EMP_E2E_001',
    email: 'e2e.employee@lnt.com',
    password: 'TestPassword123!',
    personalInfo: {
      name: 'E2E Test Employee',
      phone: '9876543210',
      address: {
        street: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        country: 'India'
      }
    },
    employmentInfo: {
      department: 'Engineering',
      ic: 'LTTS',
      joiningDate: new Date('2020-01-01'),
      status: 'active'
    },
    bankDetails: {
      accountNumber: '1234567890123456',
      ifscCode: 'HDFC0000123',
      bankName: 'HDFC Bank'
    },
    dependents: [
      {
        name: 'Test Dependent',
        relationship: 'spouse',
        dateOfBirth: new Date('1990-01-01')
      }
    ],
    roles: ['employee']
  },
  approver: {
    employeeId: 'APP_E2E_001',
    email: 'e2e.approver@lnt.com',
    password: 'ApproverPassword123!',
    personalInfo: {
      name: 'E2E Test Approver',
      phone: '9876543211'
    },
    roles: ['employee', 'approver']
  },
  financeUser: {
    employeeId: 'FIN_E2E_001',
    email: 'e2e.finance@lnt.com',
    password: 'FinancePassword123!',
    personalInfo: {
      name: 'E2E Test Finance User',
      phone: '9876543212'
    },
    roles: ['employee', 'finance']
  },
  scheme: {
    name: 'E2E Medical Scheme',
    category: 'medical',
    description: 'Comprehensive medical scheme for E2E testing',
    eligibilityRules: {
      serviceYears: 1,
      salaryRange: { min: 0, max: 2000000 },
      icRestrictions: [],
      dependentAge: 65
    },
    documentRequirements: [
      {
        type: 'medical_bill',
        mandatory: true,
        validationRules: {
          maxSize: 5242880, // 5MB
          allowedFormats: ['pdf', 'jpg', 'png']
        }
      },
      {
        type: 'prescription',
        mandatory: true,
        validationRules: {
          maxSize: 5242880,
          allowedFormats: ['pdf', 'jpg', 'png']
        }
      }
    ],
    approvalWorkflow: {
      levels: ['approver'],
      slaHours: 72,
      escalationRules: {
        escalateAfterHours: 48,
        escalateTo: 'senior_approver'
      }
    },
    budgetInfo: {
      maxAmount: 100000,
      fiscalYear: '2024-25',
      utilizationLimit: 80
    },
    status: 'active',
    validFrom: new Date(),
    validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  }
};

let testTokens: { [key: string]: string } = {};
let testUserIds: { [key: string]: string } = {};
let testSchemeId: string;
let testApplicationId: string;
let testDocumentIds: string[] = [];

describe('Complete End-to-End Application Lifecycle', () => {
  beforeAll(async () => {
    console.log('🚀 Starting Complete E2E Workflow Tests');
    await waitForAllServices();
    await setupTestUsers();
    await setupTestScheme();
  }, 60000);

  describe('1. User Management and Authentication Flow', () => {
    test('Should create employee user with complete profile', async () => {
      const response = await axios.post(`${SERVICES.USER_SERVICE}/api/users`, TEST_DATA.employee);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data.employeeId).toBe(TEST_DATA.employee.employeeId);
      
      testUserIds.employee = response.data.data.userId;
    });

    test('Should authenticate employee and receive valid token', async () => {
      const response = await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, {
        email: TEST_DATA.employee.email,
        password: TEST_DATA.employee.password
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.token).toBeDefined();
      expect(response.data.data.user.roles).toContain('employee');

      testTokens.employee = response.data.data.token;
    });

    test('Should update employee profile with bank details', async () => {
      const response = await axios.put(
        `${SERVICES.USER_SERVICE}/api/users/${testUserIds.employee}/profile`,
        {
          bankDetails: TEST_DATA.employee.bankDetails,
          dependents: TEST_DATA.employee.dependents
        },
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.bankDetails.ifscCode).toBe(TEST_DATA.employee.bankDetails.ifscCode);
    });

    test('Should validate IFSC code during bank details update', async () => {
      const response = await axios.get(
        `${SERVICES.USER_SERVICE}/api/validate/ifsc/${TEST_DATA.employee.bankDetails.ifscCode}`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.valid).toBe(true);
    });
  });

  describe('2. Scheme Discovery and Eligibility Flow', () => {
    test('Should discover eligible schemes for employee', async () => {
      const response = await axios.get(
        `${SERVICES.SCHEME_SERVICE}/api/schemes/eligible`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);
      
      const testScheme = response.data.data.find((s: any) => s.schemeId === testSchemeId);
      expect(testScheme).toBeDefined();
    });

    test('Should check specific scheme eligibility', async () => {
      const response = await axios.get(
        `${SERVICES.SCHEME_SERVICE}/api/schemes/${testSchemeId}/eligibility`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.data.eligible).toBe(true);
      expect(response.data.data.reasons).toBeDefined();
    });

    test('Should filter schemes by category', async () => {
      const response = await axios.get(
        `${SERVICES.SCHEME_SERVICE}/api/schemes?category=medical`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
      
      const medicalSchemes = response.data.data.filter((s: any) => s.category === 'medical');
      expect(medicalSchemes.length).toBeGreaterThan(0);
    });

    test('Should get scheme details with document requirements', async () => {
      const response = await axios.get(
        `${SERVICES.SCHEME_SERVICE}/api/schemes/${testSchemeId}`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.data.documentRequirements).toBeDefined();
      expect(response.data.data.documentRequirements.length).toBeGreaterThan(0);
    });
  });

  describe('3. Document Management Flow', () => {
    test('Should upload medical bill document', async () => {
      // Create a mock PDF buffer
      const mockPdfBuffer = Buffer.from('%PDF-1.4 Mock PDF content for testing');
      
      const formData = new FormData();
      const blob = new Blob([mockPdfBuffer], { type: 'application/pdf' });
      formData.append('file', blob, 'medical_bill.pdf');
      formData.append('documentType', 'medical_bill');
      formData.append('applicationId', 'temp'); // Will be updated later

      const response = await axios.post(
        `${SERVICES.DOCUMENT_SERVICE}/api/documents/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${testTokens.employee}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data.documentId).toBeDefined();
      
      testDocumentIds.push(response.data.data.documentId);
    });

    test('Should validate document format and size', async () => {
      const documentId = testDocumentIds[0];
      
      const response = await axios.post(
        `${SERVICES.DOCUMENT_SERVICE}/api/documents/${documentId}/validate`,
        {},
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.validationStatus).toBe('validated');
    });

    test('Should perform OCR processing on document', async () => {
      const documentId = testDocumentIds[0];
      
      const response = await axios.post(
        `${SERVICES.DOCUMENT_SERVICE}/api/documents/${documentId}/ocr`,
        {},
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.ocrResults).toBeDefined();
    });
  });

  describe('4. Application Submission and Processing Flow', () => {
    test('Should create application draft', async () => {
      const applicationData = {
        schemeId: testSchemeId,
        applicationData: {
          claimAmount: 15000,
          purpose: 'Medical treatment for fever and consultation',
          beneficiary: 'Self',
          customFields: {
            hospitalName: 'Test Hospital Mumbai',
            treatmentDate: new Date().toISOString(),
            doctorName: 'Dr. Test Physician'
          }
        }
      };

      const response = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/drafts`,
        applicationData,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data.schemeId).toBe(testSchemeId);
    });

    test('Should save and resume application draft', async () => {
      const draftData = {
        schemeId: testSchemeId,
        applicationData: {
          claimAmount: 15000,
          purpose: 'Updated purpose - Medical treatment',
          beneficiary: 'Self'
        }
      };

      // Save draft
      const saveResponse = await axios.put(
        `${SERVICES.APPLICATION_SERVICE}/api/drafts/current`,
        draftData,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(saveResponse.status).toBe(200);

      // Resume draft
      const resumeResponse = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/drafts/current`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(resumeResponse.status).toBe(200);
      expect(resumeResponse.data.data.applicationData.purpose).toContain('Updated purpose');
    });

    test('Should submit complete application', async () => {
      const applicationData = {
        schemeId: testSchemeId,
        applicationData: {
          claimAmount: 15000,
          purpose: 'Medical treatment for fever and consultation',
          beneficiary: 'Self',
          customFields: {
            hospitalName: 'Test Hospital Mumbai',
            treatmentDate: new Date().toISOString(),
            doctorName: 'Dr. Test Physician'
          }
        },
        documents: testDocumentIds.map(id => ({
          documentId: id,
          type: 'medical_bill'
        }))
      };

      const response = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/applications`,
        applicationData,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data.applicationId).toBeDefined();
      
      testApplicationId = response.data.data.applicationId;

      // Submit the application
      const submitResponse = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${testApplicationId}/submit`,
        {},
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(submitResponse.status).toBe(200);
      expect(submitResponse.data.data.workflow.currentStatus).toBe('submitted');
    });

    test('Should validate application data before submission', async () => {
      const response = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${testApplicationId}/validate`,
        {},
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.validationResults.valid).toBe(true);
    });
  });

  describe('5. Application Tracking and Status Management', () => {
    test('Should track application status in real-time', async () => {
      const response = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${testApplicationId}`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.data.applicationId).toBe(testApplicationId);
      expect(response.data.data.workflow.currentStatus).toBe('submitted');
      expect(response.data.data.auditTrail).toBeDefined();
      expect(response.data.data.auditTrail.length).toBeGreaterThan(0);
    });

    test('Should get application timeline with all status changes', async () => {
      const response = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${testApplicationId}/timeline`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);
      
      const timeline = response.data.data;
      expect(timeline[0]).toHaveProperty('timestamp');
      expect(timeline[0]).toHaveProperty('status');
      expect(timeline[0]).toHaveProperty('action');
    });

    test('Should add comments to application', async () => {
      const commentData = {
        comment: 'Additional information: Treatment was for high fever lasting 3 days',
        commentType: 'applicant_note'
      };

      const response = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${testApplicationId}/comments`,
        commentData,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
    });

    test('Should retrieve application comments', async () => {
      const response = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${testApplicationId}/comments`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);
    });
  });

  describe('6. Approval Workflow Management', () => {
    test('Should assign application to approver', async () => {
      const response = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${testApplicationId}/assign`,
        {
          approverId: testUserIds.approver,
          level: 'approver'
        },
        {
          headers: { Authorization: `Bearer ${testTokens.approver}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    test('Should get applications pending approval', async () => {
      const response = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/approvals/pending`,
        {
          headers: { Authorization: `Bearer ${testTokens.approver}` }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
      
      const pendingApp = response.data.data.find((app: any) => app.applicationId === testApplicationId);
      expect(pendingApp).toBeDefined();
    });

    test('Should approve application with comments', async () => {
      const approvalData = {
        decision: 'approved',
        comments: 'Medical bills verified. Treatment appears necessary and reasonable.',
        approvedAmount: 15000
      };

      const response = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${testApplicationId}/approve`,
        approvalData,
        {
          headers: { Authorization: `Bearer ${testTokens.approver}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.workflow.currentStatus).toBe('approved');
    });

    test('Should track SLA compliance', async () => {
      const response = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${testApplicationId}/sla`,
        {
          headers: { Authorization: `Bearer ${testTokens.approver}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.data.slaStatus).toBeDefined();
      expect(response.data.data.remainingHours).toBeDefined();
    });
  });

  describe('7. Payment Processing and Finance Flow', () => {
    test('Should queue approved application for payment', async () => {
      const response = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/finance/payment-queue`,
        {
          headers: { Authorization: `Bearer ${testTokens.financeUser}` }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
      
      const queuedApp = response.data.data.find((app: any) => app.applicationId === testApplicationId);
      expect(queuedApp).toBeDefined();
    });

    test('Should validate bank details for payment', async () => {
      const response = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/finance/validate-bank-details`,
        {
          applicationId: testApplicationId
        },
        {
          headers: { Authorization: `Bearer ${testTokens.financeUser}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.validationStatus).toBe('valid');
    });

    test('Should process payment batch', async () => {
      const batchData = {
        applicationIds: [testApplicationId],
        batchReference: `BATCH_${Date.now()}`,
        paymentMethod: 'NEFT'
      };

      const response = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/finance/process-batch`,
        batchData,
        {
          headers: { Authorization: `Bearer ${testTokens.financeUser}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.batchId).toBeDefined();
    });

    test('Should update payment status after processing', async () => {
      const statusUpdate = {
        applicationId: testApplicationId,
        paymentStatus: 'processed',
        transactionId: `TXN_${Date.now()}`,
        processedAt: new Date().toISOString()
      };

      const response = await axios.put(
        `${SERVICES.APPLICATION_SERVICE}/api/finance/payment-status`,
        statusUpdate,
        {
          headers: { Authorization: `Bearer ${testTokens.financeUser}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });
  });

  describe('8. Notification System Integration', () => {
    test('Should send status change notifications', async () => {
      const response = await axios.get(
        `${SERVICES.NOTIFICATION_SERVICE}/api/notifications/user/${testUserIds.employee}`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);
      
      const statusNotifications = response.data.data.filter((n: any) => 
        n.type === 'status_change' && n.metadata.applicationId === testApplicationId
      );
      expect(statusNotifications.length).toBeGreaterThan(0);
    });

    test('Should handle notification preferences', async () => {
      const preferences = {
        email: true,
        sms: false,
        inApp: true,
        statusUpdates: true,
        deadlineReminders: true
      };

      const response = await axios.put(
        `${SERVICES.NOTIFICATION_SERVICE}/api/preferences`,
        preferences,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });
  });

  describe('9. Data Flow and Service Integration Validation', () => {
    test('Should maintain data consistency across services', async () => {
      // Get user data from user service
      const userResponse = await axios.get(
        `${SERVICES.USER_SERVICE}/api/users/${testUserIds.employee}`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      // Get application data from application service
      const appResponse = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${testApplicationId}`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      // Verify data consistency
      expect(userResponse.data.data.userId).toBe(appResponse.data.data.userId);
      expect(appResponse.data.data.schemeId).toBe(testSchemeId);
    });

    test('Should handle cross-service authentication', async () => {
      // Verify token works across all services
      const services = [
        SERVICES.USER_SERVICE,
        SERVICES.SCHEME_SERVICE,
        SERVICES.APPLICATION_SERVICE,
        SERVICES.DOCUMENT_SERVICE,
        SERVICES.NOTIFICATION_SERVICE
      ];

      for (const service of services) {
        const response = await axios.get(
          `${service}/api/auth/verify`,
          {
            headers: { Authorization: `Bearer ${testTokens.employee}` }
          }
        );
        expect(response.status).toBe(200);
      }
    });

    test('Should maintain audit trail across services', async () => {
      const response = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${testApplicationId}/audit-trail`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
      
      const auditTrail = response.data.data;
      expect(auditTrail.length).toBeGreaterThan(3); // Should have multiple entries
      
      // Verify audit entries have required fields
      auditTrail.forEach((entry: any) => {
        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('action');
        expect(entry).toHaveProperty('userId');
        expect(entry).toHaveProperty('details');
      });
    });
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up E2E test data...');
    await cleanupTestData();
  }, 30000);
});

// Helper functions
async function waitForAllServices(): Promise<void> {
  console.log('⏳ Waiting for all services to be ready...');
  
  const maxRetries = 30;
  const retryDelay = 2000;

  for (const [serviceName, serviceUrl] of Object.entries(SERVICES)) {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        await axios.get(`${serviceUrl}/health`, { timeout: 5000 });
        console.log(`✅ ${serviceName} is ready`);
        break;
      } catch (error) {
        retries++;
        if (retries === maxRetries) {
          throw new Error(`${serviceName} failed to start after ${maxRetries} retries`);
        }
        console.log(`⏳ Waiting for ${serviceName}... (${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
}

async function setupTestUsers(): Promise<void> {
  console.log('👥 Setting up test users...');
  
  // Create approver user
  try {
    const approverResponse = await axios.post(`${SERVICES.USER_SERVICE}/api/users`, TEST_DATA.approver);
    testUserIds.approver = approverResponse.data.data.userId;
  } catch (error: any) {
    if (error.response?.status === 409) {
      // User exists, get ID by login
      const loginResponse = await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, {
        email: TEST_DATA.approver.email,
        password: TEST_DATA.approver.password
      });
      testUserIds.approver = loginResponse.data.data.user.userId;
    }
  }

  // Create finance user
  try {
    const financeResponse = await axios.post(`${SERVICES.USER_SERVICE}/api/users`, TEST_DATA.financeUser);
    testUserIds.financeUser = financeResponse.data.data.userId;
  } catch (error: any) {
    if (error.response?.status === 409) {
      const loginResponse = await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, {
        email: TEST_DATA.financeUser.email,
        password: TEST_DATA.financeUser.password
      });
      testUserIds.financeUser = loginResponse.data.data.user.userId;
    }
  }

  // Login all users to get tokens
  const approverLogin = await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, {
    email: TEST_DATA.approver.email,
    password: TEST_DATA.approver.password
  });
  testTokens.approver = approverLogin.data.data.token;

  const financeLogin = await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, {
    email: TEST_DATA.financeUser.email,
    password: TEST_DATA.financeUser.password
  });
  testTokens.financeUser = financeLogin.data.data.token;
}

async function setupTestScheme(): Promise<void> {
  console.log('📋 Setting up test scheme...');
  
  const response = await axios.post(
    `${SERVICES.SCHEME_SERVICE}/api/schemes`,
    TEST_DATA.scheme,
    {
      headers: { Authorization: `Bearer ${testTokens.approver}` }
    }
  );
  
  testSchemeId = response.data.data.schemeId;
}

async function cleanupTestData(): Promise<void> {
  try {
    // Delete application
    if (testApplicationId && testTokens.employee) {
      await axios.delete(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${testApplicationId}`,
        {
          headers: { Authorization: `Bearer ${testTokens.employee}` }
        }
      );
    }

    // Delete documents
    for (const docId of testDocumentIds) {
      if (testTokens.employee) {
        await axios.delete(
          `${SERVICES.DOCUMENT_SERVICE}/api/documents/${docId}`,
          {
            headers: { Authorization: `Bearer ${testTokens.employee}` }
          }
        );
      }
    }

    // Delete scheme
    if (testSchemeId && testTokens.approver) {
      await axios.delete(
        `${SERVICES.SCHEME_SERVICE}/api/schemes/${testSchemeId}`,
        {
          headers: { Authorization: `Bearer ${testTokens.approver}` }
        }
      );
    }

    console.log('✅ Test data cleanup completed');
  } catch (error) {
    console.log('⚠️ Some cleanup operations failed - this is expected in test environment');
  }
}