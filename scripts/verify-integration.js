#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Service configuration
const SERVICES = {
  'user-service': {
    port: 3001,
    healthPath: '/health',
    testEndpoints: [
      { method: 'POST', path: '/api/auth/login', expectStatus: [400, 401] },
      { method: 'GET', path: '/api/auth/verify-token', expectStatus: [401] }
    ]
  },
  'scheme-service': {
    port: 3002,
    healthPath: '/health',
    testEndpoints: [
      { method: 'GET', path: '/api/schemes', expectStatus: [401] },
      { method: 'GET', path: '/api/schemes/eligible', expectStatus: [401] }
    ]
  },
  'application-service': {
    port: 3003,
    healthPath: '/health',
    testEndpoints: [
      { method: 'POST', path: '/api/applications', expectStatus: [401] },
      { method: 'GET', path: '/api/applications/test-id', expectStatus: [401, 404] }
    ]
  },
  'document-service': {
    port: 3004,
    healthPath: '/health',
    testEndpoints: [
      { method: 'POST', path: '/api/documents/upload', expectStatus: [401] },
      { method: 'GET', path: '/api/documents/test-id', expectStatus: [401, 404] }
    ]
  }
};

class IntegrationVerifier {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      services: {},
      summary: {
        totalServices: 0,
        healthyServices: 0,
        totalEndpoints: 0,
        workingEndpoints: 0
      }
    };
  }

  async verifyAll() {
    console.log('🔍 LTET Core Services Integration Verification');
    console.log('=' .repeat(50));
    
    for (const [serviceName, config] of Object.entries(SERVICES)) {
      console.log(`\n📋 Verifying ${serviceName}...`);
      
      const serviceResult = await this.verifyService(serviceName, config);
      this.results.services[serviceName] = serviceResult;
      this.results.summary.totalServices++;
      
      if (serviceResult.healthy) {
        this.results.summary.healthyServices++;
        console.log(`✅ ${serviceName} is healthy and responding`);
      } else {
        console.log(`❌ ${serviceName} is not accessible: ${serviceResult.error}`);
      }
    }
    
    this.generateReport();
  }

  async verifyService(serviceName, config) {
    const baseUrl = `http://localhost:${config.port}`;
    const result = {
      name: serviceName,
      port: config.port,
      healthy: false,
      endpoints: [],
      error: null
    };

    try {
      // Check health endpoint
      const healthResponse = await axios.get(`${baseUrl}${config.healthPath}`, { 
        timeout: 5000 
      });
      
      result.healthy = healthResponse.status === 200;
      
      // Test API endpoints
      for (const endpoint of config.testEndpoints) {
        const endpointResult = await this.testEndpoint(baseUrl, endpoint);
        result.endpoints.push(endpointResult);
        this.results.summary.totalEndpoints++;
        
        if (endpointResult.working) {
          this.results.summary.workingEndpoints++;
        }
      }
      
    } catch (error) {
      result.healthy = false;
      result.error = error.message;
    }

    return result;
  }

  async testEndpoint(baseUrl, endpoint) {
    const result = {
      method: endpoint.method,
      path: endpoint.path,
      working: false,
      actualStatus: null,
      expectedStatus: endpoint.expectStatus,
      error: null
    };

    try {
      let response;
      const url = `${baseUrl}${endpoint.path}`;
      
      switch (endpoint.method.toLowerCase()) {
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
      }
      
      result.actualStatus = response.status;
      result.working = endpoint.expectStatus.includes(response.status);
      
    } catch (error) {
      if (error.response) {
        result.actualStatus = error.response.status;
        result.working = endpoint.expectStatus.includes(error.response.status);
      } else {
        result.working = false;
        result.error = error.message;
      }
    }

    return result;
  }

  generateReport() {
    console.log('\n📊 Integration Verification Report');
    console.log('=' .repeat(40));
    
    const { summary } = this.results;
    
    console.log(`\n🏥 Service Health:`);
    console.log(`   Healthy: ${summary.healthyServices}/${summary.totalServices}`);
    
    console.log(`\n🔗 API Endpoints:`);
    console.log(`   Working: ${summary.workingEndpoints}/${summary.totalEndpoints}`);
    
    // Detailed service breakdown
    for (const [serviceName, serviceResult] of Object.entries(this.results.services)) {
      console.log(`\n🔧 ${serviceName.toUpperCase()}`);
      console.log(`   Health: ${serviceResult.healthy ? '✅' : '❌'}`);
      console.log(`   Port: ${serviceResult.port}`);
      
      if (serviceResult.error) {
        console.log(`   Error: ${serviceResult.error}`);
      }
      
      if (serviceResult.endpoints.length > 0) {
        console.log('   Endpoints:');
        for (const endpoint of serviceResult.endpoints) {
          const status = endpoint.working ? '✅' : '❌';
          const statusInfo = endpoint.actualStatus ? ` (${endpoint.actualStatus})` : '';
          console.log(`     ${status} ${endpoint.method} ${endpoint.path}${statusInfo}`);
          
          if (endpoint.error) {
            console.log(`       Error: ${endpoint.error}`);
          }
        }
      }
    }
    
    // Overall status
    const allHealthy = summary.healthyServices === summary.totalServices;
    const allEndpointsWorking = summary.workingEndpoints === summary.totalEndpoints;
    
    console.log('\n🎯 Overall Status');
    console.log('=' .repeat(20));
    
    if (allHealthy && allEndpointsWorking) {
      console.log('🎉 All services are integrated and communicating properly!');
      console.log('✅ Core services integration verification PASSED');
    } else {
      console.log('⚠️  Some services need attention:');
      
      if (!allHealthy) {
        console.log(`   - ${summary.totalServices - summary.healthyServices} service(s) not healthy`);
      }
      
      if (!allEndpointsWorking) {
        console.log(`   - ${summary.totalEndpoints - summary.workingEndpoints} endpoint(s) not responding as expected`);
      }
      
      console.log('\n💡 To fix issues:');
      console.log('   1. Ensure all services are running: docker-compose up -d');
      console.log('   2. Check service logs: docker-compose logs [service-name]');
      console.log('   3. Verify database connectivity');
    }
    
    // Save report
    this.saveReport();
  }

  saveReport() {
    const reportPath = path.join(process.cwd(), 'integration-verification-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  const verifier = new IntegrationVerifier();
  
  try {
    await verifier.verifyAll();
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { IntegrationVerifier };