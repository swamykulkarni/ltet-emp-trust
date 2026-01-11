#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  SERVICES_STARTUP_TIMEOUT: 120000, // 2 minutes
  TEST_TIMEOUT: 300000, // 5 minutes per test suite
  LOAD_TEST_USERS: process.env.LOAD_TEST_USERS || '25',
  MAX_LOAD_TEST_USERS: process.env.MAX_LOAD_TEST_USERS || '100',
  RESPONSE_TIME_THRESHOLD: process.env.RESPONSE_TIME_THRESHOLD || '3000',
  SUCCESS_RATE_THRESHOLD: process.env.SUCCESS_RATE_THRESHOLD || '0.95'
};

// Test suites to run
const TEST_SUITES = [
  {
    name: 'Core Services Integration',
    file: 'core-services.integration.test.ts',
    description: 'Basic service health and communication tests',
    timeout: 120000
  },
  {
    name: 'API Contract Validation',
    file: 'api-contracts.test.ts',
    description: 'API contract and response format validation',
    timeout: 60000
  },
  {
    name: 'Service Integration Validation',
    file: 'service-integration-validation.test.ts',
    description: 'Cross-service data flow and integration validation',
    timeout: 180000
  },
  {
    name: 'Complete E2E Workflow',
    file: 'complete-e2e-workflow.test.ts',
    description: 'End-to-end application lifecycle testing',
    timeout: 300000
  },
  {
    name: 'Load and Performance Testing',
    file: 'load-performance.test.ts',
    description: 'Load testing and performance validation',
    timeout: 600000,
    env: {
      LOAD_TEST_USERS: TEST_CONFIG.LOAD_TEST_USERS,
      MAX_LOAD_TEST_USERS: TEST_CONFIG.MAX_LOAD_TEST_USERS,
      RESPONSE_TIME_THRESHOLD: TEST_CONFIG.RESPONSE_TIME_THRESHOLD,
      SUCCESS_RATE_THRESHOLD: TEST_CONFIG.SUCCESS_RATE_THRESHOLD
    }
  }
];

class IntegrationTestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      testSuites: [],
      summary: {
        totalSuites: 0,
        passedSuites: 0,
        failedSuites: 0,
        totalDuration: 0,
        overallSuccess: false
      }
    };
    
    this.servicesStarted = false;
  }

  async runAllTests() {
    console.log('🚀 LTET Integration Test Suite Runner');
    console.log('=' .repeat(50));
    console.log(`Environment: ${this.results.environment}`);
    console.log(`Test Suites: ${TEST_SUITES.length}`);
    console.log(`Load Test Config: ${TEST_CONFIG.LOAD_TEST_USERS} users, ${TEST_CONFIG.MAX_LOAD_TEST_USERS} max`);
    console.log('=' .repeat(50));

    const overallStartTime = Date.now();

    try {
      // Step 1: Start services
      await this.startServices();

      // Step 2: Wait for services to be ready
      await this.waitForServices();

      // Step 3: Run test suites
      await this.runTestSuites();

      // Step 4: Generate comprehensive report
      this.generateReport();

    } catch (error) {
      console.error('❌ Integration test run failed:', error.message);
      this.results.summary.overallSuccess = false;
    } finally {
      this.results.summary.totalDuration = Date.now() - overallStartTime;
      
      // Step 5: Cleanup
      await this.cleanup();
      
      // Step 6: Exit with appropriate code
      process.exit(this.results.summary.overallSuccess ? 0 : 1);
    }
  }

  async startServices() {
    console.log('\n🔧 Starting LTET Services...');
    
    return new Promise((resolve, reject) => {
      const dockerCompose = spawn('docker-compose', ['up', '-d'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let output = '';
      
      dockerCompose.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });

      dockerCompose.stderr.on('data', (data) => {
        output += data.toString();
        process.stderr.write(data);
      });

      dockerCompose.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Services started successfully');
          this.servicesStarted = true;
          resolve();
        } else {
          reject(new Error(`Docker compose failed with code ${code}`));
        }
      });

      // Timeout for service startup
      setTimeout(() => {
        dockerCompose.kill();
        reject(new Error('Service startup timed out'));
      }, TEST_CONFIG.SERVICES_STARTUP_TIMEOUT);
    });
  }

  async waitForServices() {
    console.log('\n⏳ Waiting for services to be ready...');
    
    const services = [
      { name: 'User Service', url: 'http://localhost:3001/health' },
      { name: 'Scheme Service', url: 'http://localhost:3002/health' },
      { name: 'Application Service', url: 'http://localhost:3003/health' },
      { name: 'Document Service', url: 'http://localhost:3004/health' },
      { name: 'Notification Service', url: 'http://localhost:3005/health' }
    ];

    const maxRetries = 60; // 2 minutes with 2-second intervals
    const retryDelay = 2000;

    for (const service of services) {
      let retries = 0;
      let ready = false;

      while (retries < maxRetries && !ready) {
        try {
          const response = await this.makeHttpRequest(service.url);
          if (response.status === 200) {
            console.log(`✅ ${service.name} is ready`);
            ready = true;
          }
        } catch (error) {
          retries++;
          if (retries < maxRetries) {
            console.log(`⏳ ${service.name} not ready, retrying... (${retries}/${maxRetries})`);
            await this.sleep(retryDelay);
          }
        }
      }

      if (!ready) {
        throw new Error(`${service.name} failed to become ready after ${maxRetries} retries`);
      }
    }

    console.log('✅ All services are ready');
  }

  async runTestSuites() {
    console.log('\n🧪 Running Integration Test Suites...');
    
    this.results.summary.totalSuites = TEST_SUITES.length;

    for (const suite of TEST_SUITES) {
      console.log(`\n📋 Running: ${suite.name}`);
      console.log(`Description: ${suite.description}`);
      console.log(`Timeout: ${suite.timeout / 1000}s`);
      
      const suiteResult = await this.runTestSuite(suite);
      this.results.testSuites.push(suiteResult);
      
      if (suiteResult.success) {
        this.results.summary.passedSuites++;
        console.log(`✅ ${suite.name} PASSED (${suiteResult.duration}ms)`);
      } else {
        this.results.summary.failedSuites++;
        console.log(`❌ ${suite.name} FAILED (${suiteResult.duration}ms)`);
        console.log(`Error: ${suiteResult.error}`);
      }
    }

    this.results.summary.overallSuccess = this.results.summary.failedSuites === 0;
  }

  async runTestSuite(suite) {
    const startTime = Date.now();
    const result = {
      name: suite.name,
      file: suite.file,
      success: false,
      duration: 0,
      output: '',
      error: null,
      tests: {
        total: 0,
        passed: 0,
        failed: 0
      }
    };

    return new Promise((resolve) => {
      const testEnv = {
        ...process.env,
        ...suite.env,
        NODE_ENV: 'test',
        JEST_TIMEOUT: suite.timeout.toString()
      };

      const jest = spawn('npx', ['jest', suite.file, '--verbose', '--forceExit'], {
        cwd: path.join(process.cwd(), 'integration-tests'),
        env: testEnv,
        stdio: 'pipe'
      });

      let output = '';

      jest.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
      });

      jest.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stderr.write(text);
      });

      jest.on('close', (code) => {
        result.duration = Date.now() - startTime;
        result.output = output;
        result.success = code === 0;
        
        if (code !== 0) {
          result.error = `Jest exited with code ${code}`;
        }

        // Parse test results from output
        this.parseTestResults(output, result);
        
        resolve(result);
      });

      // Timeout handling
      setTimeout(() => {
        jest.kill('SIGKILL');
        result.duration = Date.now() - startTime;
        result.success = false;
        result.error = `Test suite timed out after ${suite.timeout}ms`;
        resolve(result);
      }, suite.timeout);
    });
  }

  parseTestResults(output, result) {
    try {
      // Parse Jest output for test statistics
      const testMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
      if (testMatch) {
        result.tests.failed = parseInt(testMatch[1]);
        result.tests.passed = parseInt(testMatch[2]);
        result.tests.total = parseInt(testMatch[3]);
      } else {
        // Try alternative format
        const passMatch = output.match(/(\d+)\s+passing/);
        const failMatch = output.match(/(\d+)\s+failing/);
        
        if (passMatch) result.tests.passed = parseInt(passMatch[1]);
        if (failMatch) result.tests.failed = parseInt(failMatch[1]);
        result.tests.total = result.tests.passed + result.tests.failed;
      }
    } catch (error) {
      console.log('⚠️ Could not parse test results from output');
    }
  }

  generateReport() {
    console.log('\n📊 Integration Test Results Summary');
    console.log('=' .repeat(50));
    
    const { summary } = this.results;
    
    console.log(`\n🏥 Test Suite Results:`);
    console.log(`   Total Suites: ${summary.totalSuites}`);
    console.log(`   Passed: ${summary.passedSuites}`);
    console.log(`   Failed: ${summary.failedSuites}`);
    console.log(`   Success Rate: ${((summary.passedSuites / summary.totalSuites) * 100).toFixed(1)}%`);
    console.log(`   Total Duration: ${(summary.totalDuration / 1000).toFixed(1)}s`);
    
    console.log(`\n📋 Detailed Results:`);
    this.results.testSuites.forEach(suite => {
      const status = suite.success ? '✅' : '❌';
      const duration = (suite.duration / 1000).toFixed(1);
      console.log(`   ${status} ${suite.name} (${duration}s)`);
      
      if (suite.tests.total > 0) {
        console.log(`      Tests: ${suite.tests.passed}/${suite.tests.total} passed`);
      }
      
      if (!suite.success && suite.error) {
        console.log(`      Error: ${suite.error}`);
      }
    });
    
    // Overall status
    console.log('\n🎯 Overall Result');
    console.log('=' .repeat(20));
    
    if (summary.overallSuccess) {
      console.log('🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('✅ LTET services are fully integrated and working correctly');
    } else {
      console.log('❌ SOME INTEGRATION TESTS FAILED');
      console.log('⚠️  Please review the failed tests and fix issues before deployment');
    }
    
    // Save detailed report
    this.saveDetailedReport();
  }

  saveDetailedReport() {
    const reportPath = path.join(process.cwd(), 'integration-test-results.json');
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.log(`⚠️ Failed to save detailed report: ${error.message}`);
    }

    // Also create a summary report
    const summaryPath = path.join(process.cwd(), 'integration-test-summary.md');
    const summaryContent = this.generateMarkdownSummary();
    
    try {
      fs.writeFileSync(summaryPath, summaryContent);
      console.log(`📄 Summary report saved to: ${summaryPath}`);
    } catch (error) {
      console.log(`⚠️ Failed to save summary report: ${error.message}`);
    }
  }

  generateMarkdownSummary() {
    const { summary, testSuites } = this.results;
    
    return `# LTET Integration Test Results

## Summary

- **Timestamp**: ${this.results.timestamp}
- **Environment**: ${this.results.environment}
- **Total Duration**: ${(summary.totalDuration / 1000).toFixed(1)} seconds
- **Overall Result**: ${summary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}

## Test Suite Results

| Suite | Status | Duration | Tests Passed | Tests Failed |
|-------|--------|----------|--------------|--------------|
${testSuites.map(suite => {
  const status = suite.success ? '✅ PASSED' : '❌ FAILED';
  const duration = (suite.duration / 1000).toFixed(1) + 's';
  return `| ${suite.name} | ${status} | ${duration} | ${suite.tests.passed} | ${suite.tests.failed} |`;
}).join('\n')}

## Statistics

- **Test Suites**: ${summary.passedSuites}/${summary.totalSuites} passed (${((summary.passedSuites / summary.totalSuites) * 100).toFixed(1)}%)
- **Total Tests**: ${testSuites.reduce((sum, suite) => sum + suite.tests.total, 0)}
- **Tests Passed**: ${testSuites.reduce((sum, suite) => sum + suite.tests.passed, 0)}
- **Tests Failed**: ${testSuites.reduce((sum, suite) => sum + suite.tests.failed, 0)}

## Failed Test Suites

${testSuites.filter(suite => !suite.success).map(suite => `
### ${suite.name}

**Error**: ${suite.error || 'Unknown error'}

**Duration**: ${(suite.duration / 1000).toFixed(1)} seconds
`).join('\n') || 'None - All tests passed! 🎉'}

---

*Generated by LTET Integration Test Runner*
`;
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    if (this.servicesStarted) {
      try {
        await this.executeCommand('docker-compose down');
        console.log('✅ Services stopped');
      } catch (error) {
        console.log(`⚠️ Failed to stop services: ${error.message}`);
      }
    }
  }

  // Utility methods
  async makeHttpRequest(url) {
    const https = require('https');
    const http = require('http');
    
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      
      const req = client.get(url, (res) => {
        resolve({ status: res.statusCode });
      });
      
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const runner = new IntegrationTestRunner();
  await runner.runAllTests();
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n⚠️ Received SIGINT, cleaning up...');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Received SIGTERM, cleaning up...');
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Integration test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = { IntegrationTestRunner };