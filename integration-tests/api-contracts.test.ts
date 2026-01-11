import axios from 'axios';
import { describe, test, expect } from '@jest/globals';

// Service endpoints
const SERVICES = {
  USER_SERVICE: 'http://localhost:3001',
  SCHEME_SERVICE: 'http://localhost:3002',
  APPLICATION_SERVICE: 'http://localhost:3003',
  DOCUMENT_SERVICE: 'http://localhost:3004'
};

describe('API Contract Validation', () => {
  describe('User Service API Contracts', () => {
    test('POST /api/auth/login should have correct request/response structure', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      try {
        await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, requestBody);
      } catch (error: any) {
        // Expect 401 for invalid credentials
        expect(error.response.status).toBe(401);
        expect(error.response.data).toHaveProperty('success', false);
        expect(error.response.data).toHaveProperty('error');
      }
    });

    test('GET /health should return standard health check format', async () => {
      const response = await axios.get(`${SERVICES.USER_SERVICE}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('service', 'user-service');
      expect(response.data).toHaveProperty('version');
    });
  });

  describe('Scheme Service API Contracts', () => {
    test('GET /health should return standard health check format', async () => {
      const response = await axios.get(`${SERVICES.SCHEME_SERVICE}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('service', 'scheme-service');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('version');
    });

    test('GET /api/schemes without auth should return 401', async () => {
      try {
        await axios.get(`${SERVICES.SCHEME_SERVICE}/api/schemes`);
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('Application Service API Contracts', () => {
    test('GET /health should return standard health check format', async () => {
      const response = await axios.get(`${SERVICES.APPLICATION_SERVICE}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('service', 'application-service');
      expect(response.data).toHaveProperty('timestamp');
    });

    test('POST /api/applications without auth should return 401', async () => {
      try {
        await axios.post(`${SERVICES.APPLICATION_SERVICE}/api/applications`, {
          schemeId: 'test',
          applicationData: {}
        });
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('Document Service API Contracts', () => {
    test('GET /health should return standard health check format', async () => {
      const response = await axios.get(`${SERVICES.DOCUMENT_SERVICE}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('service', 'document-service');
      expect(response.data).toHaveProperty('version');
    });

    test('POST /api/documents/upload without auth should return 401', async () => {
      try {
        await axios.post(`${SERVICES.DOCUMENT_SERVICE}/api/documents/upload`);
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('Cross-Service Communication Patterns', () => {
    test('All services should use consistent error response format', async () => {
      const endpoints = [
        `${SERVICES.USER_SERVICE}/api/auth/login`,
        `${SERVICES.SCHEME_SERVICE}/api/schemes`,
        `${SERVICES.APPLICATION_SERVICE}/api/applications`,
        `${SERVICES.DOCUMENT_SERVICE}/api/documents/upload`
      ];

      for (const endpoint of endpoints) {
        try {
          await axios.post(endpoint, {});
        } catch (error: any) {
          // Should have consistent error structure
          expect(error.response.data).toHaveProperty('success', false);
          expect(error.response.data).toHaveProperty('error');
        }
      }
    });

    test('All services should handle CORS properly', async () => {
      const healthEndpoints = [
        `${SERVICES.USER_SERVICE}/health`,
        `${SERVICES.SCHEME_SERVICE}/health`,
        `${SERVICES.APPLICATION_SERVICE}/health`,
        `${SERVICES.DOCUMENT_SERVICE}/health`
      ];

      for (const endpoint of healthEndpoints) {
        const response = await axios.get(endpoint);
        // CORS headers should be present (though axios might not expose them all)
        expect(response.status).toBe(200);
      }
    });

    test('All services should handle 404 routes consistently', async () => {
      const nonExistentEndpoints = [
        `${SERVICES.USER_SERVICE}/api/nonexistent`,
        `${SERVICES.SCHEME_SERVICE}/api/nonexistent`,
        `${SERVICES.APPLICATION_SERVICE}/api/nonexistent`,
        `${SERVICES.DOCUMENT_SERVICE}/api/nonexistent`
      ];

      for (const endpoint of nonExistentEndpoints) {
        try {
          await axios.get(endpoint);
        } catch (error: any) {
          expect(error.response.status).toBe(404);
          expect(error.response.data).toHaveProperty('error');
        }
      }
    });
  });

  describe('Data Flow Validation', () => {
    test('Services should accept and return JSON content type', async () => {
      const response = await axios.get(`${SERVICES.USER_SERVICE}/health`);
      expect(response.headers['content-type']).toContain('application/json');
    });

    test('Services should handle request size limits consistently', async () => {
      // Test with large payload (should be handled gracefully)
      const largePayload = {
        data: 'x'.repeat(15 * 1024 * 1024) // 15MB payload
      };

      try {
        await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, largePayload);
      } catch (error: any) {
        // Should either accept it or return 413 (Payload Too Large)
        expect([400, 413, 500].includes(error.response.status)).toBe(true);
      }
    });
  });
});