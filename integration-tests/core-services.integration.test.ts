import axios from 'axios';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Service endpoints
const SERVICES = {
  USER_SERVICE: 'http://localhost:3001',
  SCHEME_SERVICE: 'http://localhost:3002',
  APPLICATION_SERVICE: 'http://localhost:3003',
  DOCUMENT_SERVICE: 'http://localhost:3004'
};

// Test data
const testUser = {
  employeeId: 'EMP001',
  email: 'test@lnt.com',
  password: 'TestPassword123!'
};

const testScheme = {
  name: 'Test Medical Scheme',
  category: 'medical',
  description: 'Test scheme for integration testing',
  eligibilityRules: {
    serviceYears: 1,
    salaryRange: { min: 0, max: 1000000 }
  }
};

let authToken: string;
let userId: string;
let schemeId: string;
let applicationId: string;

describe('Core Services Integration Tests', () => {
  beforeAll(async () => {
    // Wait for services to be ready
    await waitForServices();
  });

  describe('Service Health Checks', () => {
    test('User Service should be healthy', async () => {
      const response = await axios.get(`${SERVICES.USER_SERVICE}/health`);
      expect(response.status).toBe(200);
      expect(response.data.service).toBe('user-service');
    });

    test('Scheme Service should be healthy', async () => {
      const response = await axios.get(`${SERVICES.SCHEME_SERVICE}/health`);
      expect(response.status).toBe(200);
      expect(response.data.service).toBe('scheme-service');
    });

    test('Application Service should be healthy', async () => {
      const response = await axios.get(`${SERVICES.APPLICATION_SERVICE}/health`);
      expect(response.status).toBe(200);
      expect(response.data.service).toBe('application-service');
    });

    test('Document Service should be healthy', async () => {
      const response = await axios.get(`${SERVICES.DOCUMENT_SERVICE}/health`);
      expect(response.status).toBe(200);
      expect(response.data.service).toBe('document-service');
    });
  });

  describe('End-to-End Application Workflow', () => {
    test('Step 1: User Authentication', async () => {
      // First create a test user (this would normally be done via HRMS sync)
      try {
        const createUserResponse = await axios.post(`${SERVICES.USER_SERVICE}/api/users`, {
          employeeId: testUser.employeeId,
          email: testUser.email,
          password: testUser.password,
          personalInfo: {
            name: 'Test User',
            phone: '9876543210'
          },
          roles: ['employee']
        });
        userId = createUserResponse.data.data.userId;
      } catch (error) {
        // User might already exist, try to login
        console.log('User creation failed, attempting login...');
      }

      // Login to get auth token
      const loginResponse = await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data.success).toBe(true);
      authToken = loginResponse.data.data.token;
      userId = loginResponse.data.data.user.userId;
    });

    test('Step 2: Create Test Scheme', async () => {
      const response = await axios.post(
        `${SERVICES.SCHEME_SERVICE}/api/schemes`,
        testScheme,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(response.status).toBe(201);
      schemeId = response.data.data.schemeId;
    });

    test('Step 3: Check Scheme Eligibility', async () => {
      const response = await axios.get(
        `${SERVICES.SCHEME_SERVICE}/api/schemes/${schemeId}/eligibility`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.data.eligible).toBe(true);
    });

    test('Step 4: Create Application Draft', async () => {
      const applicationData = {
        schemeId,
        applicationData: {
          claimAmount: 5000,
          purpose: 'Medical treatment',
          beneficiary: 'Self'
        }
      };

      const response = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/drafts`,
        applicationData,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.data.schemeId).toBe(schemeId);
    });

    test('Step 5: Submit Application', async () => {
      const applicationData = {
        schemeId,
        applicationData: {
          claimAmount: 5000,
          purpose: 'Medical treatment',
          beneficiary: 'Self'
        }
      };

      const createResponse = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/applications`,
        applicationData,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(createResponse.status).toBe(201);
      applicationId = createResponse.data.data.applicationId;

      // Submit the application
      const submitResponse = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${applicationId}/submit`,
        {},
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(submitResponse.status).toBe(200);
      expect(submitResponse.data.data.workflow.currentStatus).toBe('submitted');
    });

    test('Step 6: Track Application Status', async () => {
      const response = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${applicationId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.data.applicationId).toBe(applicationId);
      expect(response.data.data.workflow.currentStatus).toBe('submitted');
    });

    test('Step 7: Get Application Timeline', async () => {
      const response = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${applicationId}/timeline`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);
    });
  });

  describe('Service Communication Validation', () => {
    test('User Service can validate tokens for other services', async () => {
      const response = await axios.get(
        `${SERVICES.USER_SERVICE}/api/auth/verify-token`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    test('Application Service can fetch user data', async () => {
      const response = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/users/${userId}/applications`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    test('Scheme Service returns eligible schemes for user', async () => {
      const response = await axios.get(
        `${SERVICES.SCHEME_SERVICE}/api/schemes/eligible`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('Services handle invalid authentication gracefully', async () => {
      try {
        await axios.get(
          `${SERVICES.SCHEME_SERVICE}/api/schemes`,
          {
            headers: { Authorization: 'Bearer invalid-token' }
          }
        );
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    test('Services handle missing resources gracefully', async () => {
      try {
        await axios.get(
          `${SERVICES.APPLICATION_SERVICE}/api/applications/non-existent-id`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (applicationId && authToken) {
      try {
        await axios.delete(
          `${SERVICES.APPLICATION_SERVICE}/api/applications/${applicationId}`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );
      } catch (error) {
        console.log('Cleanup: Application deletion failed');
      }
    }

    if (schemeId && authToken) {
      try {
        await axios.delete(
          `${SERVICES.SCHEME_SERVICE}/api/schemes/${schemeId}`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );
      } catch (error) {
        console.log('Cleanup: Scheme deletion failed');
      }
    }
  });
});

// Helper function to wait for services to be ready
async function waitForServices(): Promise<void> {
  const maxRetries = 30;
  const retryDelay = 2000;

  for (const [serviceName, serviceUrl] of Object.entries(SERVICES)) {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        await axios.get(`${serviceUrl}/health`, { timeout: 5000 });
        console.log(`✓ ${serviceName} is ready`);
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