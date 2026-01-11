#!/usr/bin/env ts-node

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Service configuration
const SERVICES = {
  'user-service': {
    port: 3001,
    routes: [
      'POST /api/auth/login',
      'GET /api/auth/verify-token',
      'POST /api/auth/logout',
      'GET /api/users/:id/profile',
      'PUT /api/users/:id/profile'
    ]
  },
  'scheme-service': {
    port: 3002,
    routes: [
      'GET /api/schemes',
      'POST /api/schemes',
      'GET /api/schemes/:id',
      'GET /api/schemes/eligible',
      'GET /api/schemes/:id/eligibility'
    ]
  },
  'application-service': {
    port: 3003,
    routes: [
      'POST /api/applications',
      'GET /api/applications/:id',
      'POST /api/applications/:id/submit',
      'GET /api/users/:userId/applications',
      'GET /api/applications/:id/timeline'
    ]
  },
  'document-service': {
    port: 3004,
    routes: [
      'POST /api/documents/upload',
      'GET /api/documents/:id',
      'POST /api/documents/:id/validate',
      'GET /api/documents/application/:applicationId'
    ]
  }
};

interface ServiceStatus {
  name: string;
  healthy: boolean;
  port: number;
  error?: string;
  routes: RouteStatus[];
}

interface RouteStatus {
  method: string;
  path: string;
  accessible: boolean;
  expectedStatus?: number;
  actualStatus?: number;
  error?: string;
}

class ServiceContractVerifier {
  private results: ServiceStatus[] = [];

  async verifyAllServices(): Promise<void> {
    console.log('🔍 Verifying Service Contracts and Communication...\n');

    for (const [serviceName, config] of Object.entries(SERVICES)) {
      console.log(`📋 Checking ${serviceName}...`);
      const status = await this.verifyService(serviceName, config);
      this.results.push(status);
      
      if (status.healthy) {
        console.log(`✅ ${serviceName} is healthy`);
      } else {
        console.log(`❌ ${serviceName} has issues: ${status.error}`);
      }
    }

    this.generateReport();
  }

  private async verifyService(serviceName: string, config: any): Promise<ServiceStatus> {
    const baseUrl = `http://localhost:${config.port}`;
    const status: ServiceStatus = {
      name: serviceName,
      healthy: false,
      port: config.port,
      routes: []
    };

    try {
      // Check health endpoint
      const healthResponse = await axios.get(`${baseUrl}/health`, { timeout: 5000 });
      status.healthy = healthResponse.status === 200;

      // Verify route structure
      for (const route of config.routes) {
        const [method, path] = route.split(' ');
        const routeStatus = await this.verifyRoute(baseUrl, method, path);
        status.routes.push(routeStatus);
      }

    } catch (error: any) {
      status.healthy = false;
      status.error = error.message;
    }

    return status;
  }

  private async verifyRoute(baseUrl: string, method: string, path: string): Promise<RouteStatus> {
    const routeStatus: RouteStatus = {
      method,
      path,
      accessible: false
    };

    try {
      // Replace path parameters with test values
      const testPath = path
        .replace(':id', 'test-id')
        .replace(':userId', 'test-user-id')
        .replace(':applicationId', 'test-app-id')
        .replace(':documentId', 'test-doc-id');

      const url = `${baseUrl}${testPath}`;

      let response;
      switch (method.toLowerCase()) {
        case 'get':
          response = await axios.get(url, { timeout: 3000 });
          break;
        case 'post':
          response = await axios.post(url, {}, { timeout: 3000 });
          break;
        case 'put':
          response = await axios.put(url, {}, { timeout: 3000 });
          break;
        case 'delete':
          response = await axios.delete(url, { timeout: 3000 });
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      routeStatus.accessible = true;
      routeStatus.actualStatus = response.status;

    } catch (error: any) {
      // Routes might return 401, 404, etc. which is expected for unauthenticated requests
      if (error.response) {
        routeStatus.accessible = true;
        routeStatus.actualStatus = error.response.status;
        
        // These are expected status codes for protected/non-existent resources
        if ([401, 403, 404, 422].includes(error.response.status)) {
          // This is actually good - the route exists and responds appropriately
        } else {
          routeStatus.error = `Unexpected status: ${error.response.status}`;
        }
      } else {
        routeStatus.accessible = false;
        routeStatus.error = error.message;
      }
    }

    return routeStatus;
  }

  private generateReport(): void {
    console.log('\n📊 Service Contract Verification Report');
    console.log('=' .repeat(50));

    let allHealthy = true;
    let totalRoutes = 0;
    let accessibleRoutes = 0;

    for (const service of this.results) {
      console.log(`\n🔧 ${service.name.toUpperCase()}`);
      console.log(`   Port: ${service.port}`);
      console.log(`   Health: ${service.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      
      if (service.error) {
        console.log(`   Error: ${service.error}`);
        allHealthy = false;
      }

      if (service.routes.length > 0) {
        console.log('   Routes:');
        for (const route of service.routes) {
          totalRoutes++;
          const status = route.accessible ? '✅' : '❌';
          const statusCode = route.actualStatus ? ` (${route.actualStatus})` : '';
          console.log(`     ${status} ${route.method} ${route.path}${statusCode}`);
          
          if (route.accessible) {
            accessibleRoutes++;
          }
          
          if (route.error) {
            console.log(`       Error: ${route.error}`);
          }
        }
      }

      if (!service.healthy) {
        allHealthy = false;
      }
    }

    console.log('\n📈 Summary');
    console.log('=' .repeat(20));
    console.log(`Services: ${this.results.filter(s => s.healthy).length}/${this.results.length} healthy`);
    console.log(`Routes: ${accessibleRoutes}/${totalRoutes} accessible`);
    
    if (allHealthy && accessibleRoutes === totalRoutes) {
      console.log('\n🎉 All services are properly configured and communicating!');
    } else {
      console.log('\n⚠️  Some services or routes need attention.');
      console.log('   Make sure all services are running with: docker-compose up -d');
    }

    // Save detailed report to file
    this.saveDetailedReport();
  }

  private saveDetailedReport(): void {
    const reportPath = path.join(process.cwd(), 'integration-tests', 'service-contract-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalServices: this.results.length,
        healthyServices: this.results.filter(s => s.healthy).length,
        totalRoutes: this.results.reduce((sum, s) => sum + s.routes.length, 0),
        accessibleRoutes: this.results.reduce((sum, s) => sum + s.routes.filter(r => r.accessible).length, 0)
      },
      services: this.results
    };

    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  const verifier = new ServiceContractVerifier();
  
  try {
    await verifier.verifyAllServices();
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ServiceContractVerifier };