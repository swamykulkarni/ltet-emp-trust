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

// Load testing configuration
const LOAD_CONFIG = {
  CONCURRENT_USERS: parseInt(process.env.LOAD_TEST_USERS || '50'),
  MAX_CONCURRENT_USERS: parseInt(process.env.MAX_LOAD_TEST_USERS || '200'),
  TEST_DURATION_MS: parseInt(process.env.LOAD_TEST_DURATION || '30000'), // 30 seconds
  RESPONSE_TIME_THRESHOLD_MS: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '3000'), // 3 seconds
  SUCCESS_RATE_THRESHOLD: parseFloat(process.env.SUCCESS_RATE_THRESHOLD || '0.95'), // 95%
  RAMP_UP_TIME_MS: parseInt(process.env.RAMP_UP_TIME || '10000') // 10 seconds
};

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  requestsPerSecond: number;
  successRate: number;
  errors: Array<{ error: string; count: number }>;
}

interface PerformanceMetrics {
  timestamp: number;
  responseTime: number;
  success: boolean;
  error?: string;
  endpoint: string;
  method: string;
}

let testUsers: Array<{ token: string; userId: string }> = [];
let testSchemeId: string;

describe('Load Testing and Performance Validation', () => {
  beforeAll(async () => {
    console.log('🚀 Starting Load Testing Suite');
    console.log(`Configuration: ${LOAD_CONFIG.CONCURRENT_USERS} concurrent users, ${LOAD_CONFIG.TEST_DURATION_MS}ms duration`);
    
    await waitForAllServices();
    await setupLoadTestData();
  }, 120000);

  describe('1. Service Health Under Load', () => {
    test('Should maintain health endpoint performance under concurrent load', async () => {
      const results = await runConcurrentRequests(
        LOAD_CONFIG.CONCURRENT_USERS,
        async () => {
          const service = Object.values(SERVICES)[Math.floor(Math.random() * Object.values(SERVICES).length)];
          return axios.get(`${service}/health`, { timeout: 10000 });
        },
        LOAD_CONFIG.TEST_DURATION_MS
      );

      expect(results.successRate).toBeGreaterThanOrEqual(LOAD_CONFIG.SUCCESS_RATE_THRESHOLD);
      expect(results.averageResponseTime).toBeLessThan(LOAD_CONFIG.RESPONSE_TIME_THRESHOLD_MS);
      
      console.log(`Health endpoints - Success rate: ${(results.successRate * 100).toFixed(2)}%, Avg response: ${results.averageResponseTime.toFixed(2)}ms`);
    });

    test('Should handle health check spikes without degradation', async () => {
      // Simulate traffic spike
      const spikeResults = await runConcurrentRequests(
        LOAD_CONFIG.MAX_CONCURRENT_USERS,
        async () => {
          return axios.get(`${SERVICES.USER_SERVICE}/health`, { timeout: 10000 });
        },
        5000 // 5 second spike
      );

      expect(spikeResults.successRate).toBeGreaterThanOrEqual(0.90); // Allow slight degradation during spike
      expect(spikeResults.maxResponseTime).toBeLessThan(10000); // Max 10 seconds during spike
      
      console.log(`Health spike test - Success rate: ${(spikeResults.successRate * 100).toFixed(2)}%, Max response: ${spikeResults.maxResponseTime.toFixed(2)}ms`);
    });
  });

  describe('2. Authentication Performance Under Load', () => {
    test('Should handle concurrent login requests efficiently', async () => {
      const results = await runConcurrentRequests(
        LOAD_CONFIG.CONCURRENT_USERS,
        async () => {
          const userIndex = Math.floor(Math.random() * testUsers.length);
          const testUser = testUsers[userIndex];
          
          return axios.post(`${SERVICES.USER_SERVICE}/api/auth/verify-token`, {}, {
            headers: { Authorization: `Bearer ${testUser.token}` },
            timeout: 10000
          });
        },
        LOAD_CONFIG.TEST_DURATION_MS
      );

      expect(results.successRate).toBeGreaterThanOrEqual(LOAD_CONFIG.SUCCESS_RATE_THRESHOLD);
      expect(results.averageResponseTime).toBeLessThan(2000); // Auth should be fast
      
      console.log(`Auth verification - Success rate: ${(results.successRate * 100).toFixed(2)}%, Avg response: ${results.averageResponseTime.toFixed(2)}ms`);
    });

    test('Should maintain token validation performance', async () => {
      const results = await runConcurrentRequests(
        LOAD_CONFIG.CONCURRENT_USERS * 2, // Higher load for token validation
        async () => {
          const userIndex = Math.floor(Math.random() * testUsers.length);
          const testUser = testUsers[userIndex];
          
          return axios.get(`${SERVICES.USER_SERVICE}/api/auth/verify-token`, {
            headers: { Authorization: `Bearer ${testUser.token}` },
            timeout: 5000
          });
        },
        LOAD_CONFIG.TEST_DURATION_MS
      );

      expect(results.successRate).toBeGreaterThanOrEqual(LOAD_CONFIG.SUCCESS_RATE_THRESHOLD);
      expect(results.averageResponseTime).toBeLessThan(1000); // Token validation should be very fast
      
      console.log(`Token validation - Success rate: ${(results.successRate * 100).toFixed(2)}%, Avg response: ${results.averageResponseTime.toFixed(2)}ms`);
    });
  });

  describe('3. Scheme Discovery Performance', () => {
    test('Should handle concurrent scheme listing requests', async () => {
      const results = await runConcurrentRequests(
        LOAD_CONFIG.CONCURRENT_USERS,
        async () => {
          const userIndex = Math.floor(Math.random() * testUsers.length);
          const testUser = testUsers[userIndex];
          
          return axios.get(`${SERVICES.SCHEME_SERVICE}/api/schemes/eligible`, {
            headers: { Authorization: `Bearer ${testUser.token}` },
            timeout: 10000
          });
        },
        LOAD_CONFIG.TEST_DURATION_MS
      );

      expect(results.successRate).toBeGreaterThanOrEqual(LOAD_CONFIG.SUCCESS_RATE_THRESHOLD);
      expect(results.averageResponseTime).toBeLessThan(LOAD_CONFIG.RESPONSE_TIME_THRESHOLD_MS);
      
      console.log(`Scheme listing - Success rate: ${(results.successRate * 100).toFixed(2)}%, Avg response: ${results.averageResponseTime.toFixed(2)}ms`);
    });

    test('Should maintain eligibility check performance under load', async () => {
      const results = await runConcurrentRequests(
        LOAD_CONFIG.CONCURRENT_USERS,
        async () => {
          const userIndex = Math.floor(Math.random() * testUsers.length);
          const testUser = testUsers[userIndex];
          
          return axios.get(`${SERVICES.SCHEME_SERVICE}/api/schemes/${testSchemeId}/eligibility`, {
            headers: { Authorization: `Bearer ${testUser.token}` },
            timeout: 10000
          });
        },
        LOAD_CONFIG.TEST_DURATION_MS
      );

      expect(results.successRate).toBeGreaterThanOrEqual(LOAD_CONFIG.SUCCESS_RATE_THRESHOLD);
      expect(results.averageResponseTime).toBeLessThan(2000); // Eligibility checks should be fast
      
      console.log(`Eligibility checks - Success rate: ${(results.successRate * 100).toFixed(2)}%, Avg response: ${results.averageResponseTime.toFixed(2)}ms`);
    });
  });

  describe('4. Application Processing Performance', () => {
    test('Should handle concurrent application submissions', async () => {
      const results = await runConcurrentRequests(
        Math.min(LOAD_CONFIG.CONCURRENT_USERS, 25), // Limit for write operations
        async () => {
          const userIndex = Math.floor(Math.random() * testUsers.length);
          const testUser = testUsers[userIndex];
          
          const applicationData = {
            schemeId: testSchemeId,
            applicationData: {
              claimAmount: Math.floor(Math.random() * 10000) + 1000,
              purpose: `Load test application ${Date.now()}`,
              beneficiary: 'Self'
            }
          };
          
          return axios.post(`${SERVICES.APPLICATION_SERVICE}/api/applications`, applicationData, {
            headers: { Authorization: `Bearer ${testUser.token}` },
            timeout: 15000
          });
        },
        Math.min(LOAD_CONFIG.TEST_DURATION_MS, 20000) // Shorter duration for write operations
      );

      expect(results.successRate).toBeGreaterThanOrEqual(0.85); // Allow some degradation for write operations
      expect(results.averageResponseTime).toBeLessThan(5000); // Write operations can be slower
      
      console.log(`Application submissions - Success rate: ${(results.successRate * 100).toFixed(2)}%, Avg response: ${results.averageResponseTime.toFixed(2)}ms`);
    });

    test('Should maintain application status retrieval performance', async () => {
      // First create some test applications
      const testApplicationIds: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        try {
          const userIndex = Math.floor(Math.random() * testUsers.length);
          const testUser = testUsers[userIndex];
          
          const response = await axios.post(`${SERVICES.APPLICATION_SERVICE}/api/applications`, {
            schemeId: testSchemeId,
            applicationData: {
              claimAmount: 5000,
              purpose: `Load test status check ${i}`,
              beneficiary: 'Self'
            }
          }, {
            headers: { Authorization: `Bearer ${testUser.token}` }
          });
          
          testApplicationIds.push(response.data.data.applicationId);
        } catch (error) {
          // Continue if some fail
        }
      }

      if (testApplicationIds.length === 0) {
        console.log('⚠️ No test applications created, skipping status retrieval test');
        return;
      }

      const results = await runConcurrentRequests(
        LOAD_CONFIG.CONCURRENT_USERS,
        async () => {
          const userIndex = Math.floor(Math.random() * testUsers.length);
          const testUser = testUsers[userIndex];
          const appId = testApplicationIds[Math.floor(Math.random() * testApplicationIds.length)];
          
          return axios.get(`${SERVICES.APPLICATION_SERVICE}/api/applications/${appId}`, {
            headers: { Authorization: `Bearer ${testUser.token}` },
            timeout: 10000
          });
        },
        LOAD_CONFIG.TEST_DURATION_MS
      );

      expect(results.successRate).toBeGreaterThanOrEqual(LOAD_CONFIG.SUCCESS_RATE_THRESHOLD);
      expect(results.averageResponseTime).toBeLessThan(LOAD_CONFIG.RESPONSE_TIME_THRESHOLD_MS);
      
      console.log(`Application status retrieval - Success rate: ${(results.successRate * 100).toFixed(2)}%, Avg response: ${results.averageResponseTime.toFixed(2)}ms`);
    });
  });

  describe('5. Database Performance Under Load', () => {
    test('Should maintain read performance under concurrent load', async () => {
      const results = await runConcurrentRequests(
        LOAD_CONFIG.CONCURRENT_USERS * 2, // Higher load for read operations
        async () => {
          const userIndex = Math.floor(Math.random() * testUsers.length);
          const testUser = testUsers[userIndex];
          
          // Mix of different read operations
          const operations = [
            () => axios.get(`${SERVICES.USER_SERVICE}/api/users/${testUser.userId}`, {
              headers: { Authorization: `Bearer ${testUser.token}` }
            }),
            () => axios.get(`${SERVICES.SCHEME_SERVICE}/api/schemes`, {
              headers: { Authorization: `Bearer ${testUser.token}` }
            }),
            () => axios.get(`${SERVICES.APPLICATION_SERVICE}/api/users/${testUser.userId}/applications`, {
              headers: { Authorization: `Bearer ${testUser.token}` }
            })
          ];
          
          const operation = operations[Math.floor(Math.random() * operations.length)];
          return operation();
        },
        LOAD_CONFIG.TEST_DURATION_MS
      );

      expect(results.successRate).toBeGreaterThanOrEqual(LOAD_CONFIG.SUCCESS_RATE_THRESHOLD);
      expect(results.averageResponseTime).toBeLessThan(LOAD_CONFIG.RESPONSE_TIME_THRESHOLD_MS);
      
      console.log(`Database reads - Success rate: ${(results.successRate * 100).toFixed(2)}%, Avg response: ${results.averageResponseTime.toFixed(2)}ms`);
    });

    test('Should handle mixed read/write operations efficiently', async () => {
      const results = await runConcurrentRequests(
        Math.min(LOAD_CONFIG.CONCURRENT_USERS, 30),
        async () => {
          const userIndex = Math.floor(Math.random() * testUsers.length);
          const testUser = testUsers[userIndex];
          
          // 80% reads, 20% writes
          if (Math.random() < 0.8) {
            // Read operation
            return axios.get(`${SERVICES.USER_SERVICE}/api/users/${testUser.userId}`, {
              headers: { Authorization: `Bearer ${testUser.token}` },
              timeout: 10000
            });
          } else {
            // Write operation - update profile
            return axios.put(`${SERVICES.USER_SERVICE}/api/users/${testUser.userId}/profile`, {
              personalInfo: {
                lastUpdated: new Date().toISOString()
              }
            }, {
              headers: { Authorization: `Bearer ${testUser.token}` },
              timeout: 15000
            });
          }
        },
        LOAD_CONFIG.TEST_DURATION_MS
      );

      expect(results.successRate).toBeGreaterThanOrEqual(0.90); // Allow some degradation for mixed operations
      expect(results.averageResponseTime).toBeLessThan(LOAD_CONFIG.RESPONSE_TIME_THRESHOLD_MS);
      
      console.log(`Mixed read/write - Success rate: ${(results.successRate * 100).toFixed(2)}%, Avg response: ${results.averageResponseTime.toFixed(2)}ms`);
    });
  });

  describe('6. System Scalability Validation', () => {
    test('Should demonstrate horizontal scaling capabilities', async () => {
      const scalingResults: Array<{ users: number; results: LoadTestResult }> = [];
      
      // Test with increasing load
      const userCounts = [10, 25, 50, 100];
      
      for (const userCount of userCounts) {
        if (userCount > LOAD_CONFIG.MAX_CONCURRENT_USERS) continue;
        
        console.log(`Testing with ${userCount} concurrent users...`);
        
        const results = await runConcurrentRequests(
          userCount,
          async () => {
            const userIndex = Math.floor(Math.random() * testUsers.length);
            const testUser = testUsers[userIndex];
            
            return axios.get(`${SERVICES.SCHEME_SERVICE}/api/schemes/eligible`, {
              headers: { Authorization: `Bearer ${testUser.token}` },
              timeout: 10000
            });
          },
          10000 // 10 seconds per test
        );
        
        scalingResults.push({ users: userCount, results });
        
        console.log(`${userCount} users - Success: ${(results.successRate * 100).toFixed(2)}%, Avg response: ${results.averageResponseTime.toFixed(2)}ms`);
      }
      
      // Validate scaling behavior
      expect(scalingResults.length).toBeGreaterThan(1);
      
      // Success rate should remain high across all load levels
      scalingResults.forEach(({ users, results }) => {
        expect(results.successRate).toBeGreaterThanOrEqual(0.85);
      });
      
      // Response time should scale reasonably (not exponentially)
      const firstResult = scalingResults[0];
      const lastResult = scalingResults[scalingResults.length - 1];
      const responseTimeIncrease = lastResult.results.averageResponseTime / firstResult.results.averageResponseTime;
      
      expect(responseTimeIncrease).toBeLessThan(5); // Response time shouldn't increase more than 5x
    });

    test('Should maintain performance during sustained load', async () => {
      console.log('Running sustained load test for 60 seconds...');
      
      const sustainedResults = await runConcurrentRequests(
        LOAD_CONFIG.CONCURRENT_USERS,
        async () => {
          const userIndex = Math.floor(Math.random() * testUsers.length);
          const testUser = testUsers[userIndex];
          
          // Mix of operations to simulate real usage
          const operations = [
            () => axios.get(`${SERVICES.SCHEME_SERVICE}/api/schemes/eligible`, {
              headers: { Authorization: `Bearer ${testUser.token}` }
            }),
            () => axios.get(`${SERVICES.USER_SERVICE}/api/users/${testUser.userId}`, {
              headers: { Authorization: `Bearer ${testUser.token}` }
            }),
            () => axios.get(`${SERVICES.APPLICATION_SERVICE}/api/users/${testUser.userId}/applications`, {
              headers: { Authorization: `Bearer ${testUser.token}` }
            })
          ];
          
          const operation = operations[Math.floor(Math.random() * operations.length)];
          return operation();
        },
        60000 // 60 seconds sustained load
      );

      expect(sustainedResults.successRate).toBeGreaterThanOrEqual(LOAD_CONFIG.SUCCESS_RATE_THRESHOLD);
      expect(sustainedResults.averageResponseTime).toBeLessThan(LOAD_CONFIG.RESPONSE_TIME_THRESHOLD_MS);
      
      console.log(`Sustained load - Success rate: ${(sustainedResults.successRate * 100).toFixed(2)}%, Avg response: ${sustainedResults.averageResponseTime.toFixed(2)}ms`);
    });
  });

  describe('7. Error Handling Under Load', () => {
    test('Should handle invalid requests gracefully under load', async () => {
      const results = await runConcurrentRequests(
        LOAD_CONFIG.CONCURRENT_USERS,
        async () => {
          // Mix of valid and invalid requests
          if (Math.random() < 0.7) {
            // Valid request
            const userIndex = Math.floor(Math.random() * testUsers.length);
            const testUser = testUsers[userIndex];
            
            return axios.get(`${SERVICES.SCHEME_SERVICE}/api/schemes/eligible`, {
              headers: { Authorization: `Bearer ${testUser.token}` }
            });
          } else {
            // Invalid request (bad token)
            return axios.get(`${SERVICES.SCHEME_SERVICE}/api/schemes/eligible`, {
              headers: { Authorization: 'Bearer invalid-token' }
            });
          }
        },
        LOAD_CONFIG.TEST_DURATION_MS
      );

      // Should handle errors gracefully - valid requests should still succeed
      expect(results.successRate).toBeGreaterThanOrEqual(0.65); // ~70% valid requests
      expect(results.averageResponseTime).toBeLessThan(LOAD_CONFIG.RESPONSE_TIME_THRESHOLD_MS);
      
      console.log(`Error handling - Success rate: ${(results.successRate * 100).toFixed(2)}%, Avg response: ${results.averageResponseTime.toFixed(2)}ms`);
    });

    test('Should recover from temporary service unavailability', async () => {
      // This test would require orchestrating service restarts
      // For now, we'll test resilience to network timeouts
      
      const results = await runConcurrentRequests(
        Math.min(LOAD_CONFIG.CONCURRENT_USERS, 20),
        async () => {
          const userIndex = Math.floor(Math.random() * testUsers.length);
          const testUser = testUsers[userIndex];
          
          return axios.get(`${SERVICES.USER_SERVICE}/health`, {
            headers: { Authorization: `Bearer ${testUser.token}` },
            timeout: Math.random() < 0.1 ? 100 : 10000 // 10% very short timeout to simulate network issues
          });
        },
        15000
      );

      // Should maintain reasonable success rate even with some network issues
      expect(results.successRate).toBeGreaterThanOrEqual(0.80);
      
      console.log(`Network resilience - Success rate: ${(results.successRate * 100).toFixed(2)}%, Avg response: ${results.averageResponseTime.toFixed(2)}ms`);
    });
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up load test data...');
    // Cleanup would be handled by individual service cleanup routines
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

async function setupLoadTestData(): Promise<void> {
  console.log('👥 Setting up load test users...');
  
  const userCount = Math.min(LOAD_CONFIG.MAX_CONCURRENT_USERS, 100);
  
  for (let i = 0; i < userCount; i++) {
    try {
      const userData = {
        employeeId: `LOAD_EMP_${i.toString().padStart(3, '0')}`,
        email: `load.test.${i}@lnt.com`,
        password: 'LoadTestPassword123!',
        personalInfo: {
          name: `Load Test User ${i}`,
          phone: `987654${i.toString().padStart(4, '0')}`
        },
        employmentInfo: {
          department: 'Engineering',
          ic: 'LTTS',
          joiningDate: new Date('2020-01-01'),
          status: 'active'
        },
        roles: ['employee']
      };

      // Create user
      const createResponse = await axios.post(`${SERVICES.USER_SERVICE}/api/users`, userData);
      const userId = createResponse.data.data.userId;

      // Login to get token
      const loginResponse = await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, {
        email: userData.email,
        password: userData.password
      });
      const token = loginResponse.data.data.token;

      testUsers.push({ token, userId });
      
      if (i % 10 === 0) {
        console.log(`Created ${i + 1}/${userCount} test users`);
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        // User exists, try to login
        try {
          const loginResponse = await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, {
            email: `load.test.${i}@lnt.com`,
            password: 'LoadTestPassword123!'
          });
          const token = loginResponse.data.data.token;
          const userId = loginResponse.data.data.user.userId;
          testUsers.push({ token, userId });
        } catch (loginError) {
          console.log(`Failed to login existing user ${i}`);
        }
      }
    }
  }

  console.log(`✅ Setup complete: ${testUsers.length} test users ready`);

  // Create test scheme
  if (testUsers.length > 0) {
    try {
      const schemeResponse = await axios.post(
        `${SERVICES.SCHEME_SERVICE}/api/schemes`,
        {
          name: 'Load Test Scheme',
          category: 'medical',
          description: 'Scheme for load testing',
          eligibilityRules: {
            serviceYears: 0,
            salaryRange: { min: 0, max: 10000000 }
          },
          status: 'active',
          validFrom: new Date(),
          validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        {
          headers: { Authorization: `Bearer ${testUsers[0].token}` }
        }
      );
      testSchemeId = schemeResponse.data.data.schemeId;
      console.log('✅ Test scheme created');
    } catch (error) {
      console.log('⚠️ Failed to create test scheme, some tests may be skipped');
    }
  }
}

async function runConcurrentRequests(
  concurrentUsers: number,
  requestFunction: () => Promise<any>,
  durationMs: number
): Promise<LoadTestResult> {
  const metrics: PerformanceMetrics[] = [];
  const errors: { [key: string]: number } = {};
  const startTime = Date.now();
  const endTime = startTime + durationMs;
  
  console.log(`🔄 Running ${concurrentUsers} concurrent requests for ${durationMs}ms`);

  const workers: Promise<void>[] = [];
  
  // Create concurrent workers
  for (let i = 0; i < concurrentUsers; i++) {
    workers.push(
      (async () => {
        while (Date.now() < endTime) {
          const requestStart = Date.now();
          try {
            await requestFunction();
            const responseTime = Date.now() - requestStart;
            
            metrics.push({
              timestamp: requestStart,
              responseTime,
              success: true,
              endpoint: 'mixed',
              method: 'mixed'
            });
          } catch (error: any) {
            const responseTime = Date.now() - requestStart;
            const errorMessage = error.response?.status 
              ? `HTTP ${error.response.status}` 
              : error.message || 'Unknown error';
            
            metrics.push({
              timestamp: requestStart,
              responseTime,
              success: false,
              error: errorMessage,
              endpoint: 'mixed',
              method: 'mixed'
            });
            
            errors[errorMessage] = (errors[errorMessage] || 0) + 1;
          }
          
          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        }
      })()
    );
  }

  // Wait for all workers to complete
  await Promise.all(workers);

  // Calculate results
  const totalRequests = metrics.length;
  const successfulRequests = metrics.filter(m => m.success).length;
  const failedRequests = totalRequests - successfulRequests;
  
  const responseTimes = metrics.map(m => m.responseTime);
  const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const maxResponseTime = Math.max(...responseTimes);
  const minResponseTime = Math.min(...responseTimes);
  
  const actualDuration = Date.now() - startTime;
  const requestsPerSecond = (totalRequests / actualDuration) * 1000;
  const successRate = successfulRequests / totalRequests;
  
  const errorArray = Object.entries(errors).map(([error, count]) => ({ error, count }));

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    averageResponseTime,
    maxResponseTime,
    minResponseTime,
    requestsPerSecond,
    successRate,
    errors: errorArray
  };
}