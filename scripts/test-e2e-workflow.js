#!/usr/bin/env node

const axios = require('axios');

// Test configuration
const SERVICES = {
  USER_SERVICE: 'http://localhost:3001',
  SCHEME_SERVICE: 'http://localhost:3002',
  APPLICATION_SERVICE: 'http://localhost:3003',
  DOCUMENT_SERVICE: 'http://localhost:3004'
};

const TEST_DATA = {
  user: {
    employeeId: 'EMP001',
    email: 'test.user@lnt.com',
    password: 'TestPassword123!',
    personalInfo: {
      name: 'Test User',
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
    roles: ['employee']
  },
  scheme: {
    name: 'Test Medical Scheme',
    category: 'medical',
    description: 'Test scheme for integration testing',
    eligibilityRules: {
      serviceYears: 1,
      salaryRange: { min: 0, max: 1000000 },
      icRestrictions: []
    },
    documentRequirements: [
      {
        type: 'medical_bill',
        mandatory: true,
        validationRules: {}
      }
    ],
    approvalWorkflow: {
      levels: ['approver'],
      slaHours: 72,
      escalationRules: {}
    },
    budgetInfo: {
      maxAmount: 50000,
      fiscalYear: '2024-25',
      utilizationLimit: 100
    },
    status: 'active',
    validFrom: new Date(),
    validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
  },
  application: {
    applicationData: {
      claimAmount: 5000,
      purpose: 'Medical treatment for fever',
      beneficiary: 'Self',
      customFields: {
        hospitalName: 'Test Hospital',
        treatmentDate: new Date().toISOString()
      }
    }
  }
};

class E2EWorkflowTester {
  constructor() {
    this.authToken = null;
    this.userId = null;
    this.schemeId = null;
    this.applicationId = null;
    this.results = {
      timestamp: new Date().toISOString(),
      steps: [],
      success: false,
      error: null
    };
  }

  async runWorkflow() {
    console.log('🚀 Starting End-to-End Application Workflow Test');
    console.log('=' .repeat(55));

    try {
      await this.step1_CheckServiceHealth();
      await this.step2_CreateTestUser();
      await this.step3_AuthenticateUser();
      await this.step4_CreateTestScheme();
      await this.step5_CheckEligibility();
      await this.step6_CreateApplication();
      await this.step7_SubmitApplication();
      await this.step8_TrackApplicationStatus();
      await this.step9_GetApplicationTimeline();
      await this.step10_TestStatusUpdates();
      
      this.results.success = true;
      console.log('\n🎉 End-to-End Workflow Test PASSED!');
      console.log('✅ All core services are integrated and working together properly');
      
    } catch (error) {
      this.results.success = false;
      this.results.error = error.message;
      console.log(`\n❌ End-to-End Workflow Test FAILED: ${error.message}`);
    } finally {
      await this.cleanup();
      this.generateReport();
    }
  }

  async step1_CheckServiceHealth() {
    console.log('\n📋 Step 1: Checking Service Health...');
    
    const healthChecks = [];
    for (const [serviceName, serviceUrl] of Object.entries(SERVICES)) {
      try {
        const response = await axios.get(`${serviceUrl}/health`, { timeout: 5000 });
        healthChecks.push({ service: serviceName, healthy: true, status: response.status });
        console.log(`   ✅ ${serviceName} is healthy`);
      } catch (error) {
        healthChecks.push({ service: serviceName, healthy: false, error: error.message });
        throw new Error(`${serviceName} is not healthy: ${error.message}`);
      }
    }
    
    this.addStepResult('Service Health Check', true, { healthChecks });
  }

  async step2_CreateTestUser() {
    console.log('\n👤 Step 2: Creating Test User...');
    
    try {
      const response = await axios.post(`${SERVICES.USER_SERVICE}/api/users`, TEST_DATA.user);
      this.userId = response.data.data.userId;
      console.log(`   ✅ User created with ID: ${this.userId}`);
      this.addStepResult('Create Test User', true, { userId: this.userId });
    } catch (error) {
      if (error.response && error.response.status === 409) {
        // User already exists, that's okay for testing
        console.log('   ℹ️  User already exists, proceeding with login');
        this.addStepResult('Create Test User', true, { note: 'User already exists' });
      } else {
        throw new Error(`Failed to create user: ${error.message}`);
      }
    }
  }

  async step3_AuthenticateUser() {
    console.log('\n🔐 Step 3: Authenticating User...');
    
    const response = await axios.post(`${SERVICES.USER_SERVICE}/api/auth/login`, {
      email: TEST_DATA.user.email,
      password: TEST_DATA.user.password
    });
    
    if (!response.data.success) {
      throw new Error('Authentication failed');
    }
    
    this.authToken = response.data.data.token;
    this.userId = response.data.data.user.userId;
    
    console.log(`   ✅ User authenticated successfully`);
    this.addStepResult('User Authentication', true, { 
      hasToken: !!this.authToken,
      userId: this.userId 
    });
  }

  async step4_CreateTestScheme() {
    console.log('\n📋 Step 4: Creating Test Scheme...');
    
    const response = await axios.post(
      `${SERVICES.SCHEME_SERVICE}/api/schemes`,
      TEST_DATA.scheme,
      {
        headers: { Authorization: `Bearer ${this.authToken}` }
      }
    );
    
    this.schemeId = response.data.data.schemeId;
    console.log(`   ✅ Scheme created with ID: ${this.schemeId}`);
    this.addStepResult('Create Test Scheme', true, { schemeId: this.schemeId });
  }

  async step5_CheckEligibility() {
    console.log('\n✅ Step 5: Checking Scheme Eligibility...');
    
    const response = await axios.get(
      `${SERVICES.SCHEME_SERVICE}/api/schemes/${this.schemeId}/eligibility`,
      {
        headers: { Authorization: `Bearer ${this.authToken}` }
      }
    );
    
    const eligible = response.data.data.eligible;
    if (!eligible) {
      throw new Error('User is not eligible for the test scheme');
    }
    
    console.log(`   ✅ User is eligible for the scheme`);
    this.addStepResult('Check Eligibility', true, { eligible });
  }

  async step6_CreateApplication() {
    console.log('\n📝 Step 6: Creating Application...');
    
    const applicationData = {
      schemeId: this.schemeId,
      ...TEST_DATA.application
    };
    
    const response = await axios.post(
      `${SERVICES.APPLICATION_SERVICE}/api/applications`,
      applicationData,
      {
        headers: { Authorization: `Bearer ${this.authToken}` }
      }
    );
    
    this.applicationId = response.data.data.applicationId;
    console.log(`   ✅ Application created with ID: ${this.applicationId}`);
    this.addStepResult('Create Application', true, { applicationId: this.applicationId });
  }

  async step7_SubmitApplication() {
    console.log('\n📤 Step 7: Submitting Application...');
    
    const response = await axios.post(
      `${SERVICES.APPLICATION_SERVICE}/api/applications/${this.applicationId}/submit`,
      {},
      {
        headers: { Authorization: `Bearer ${this.authToken}` }
      }
    );
    
    const status = response.data.data.workflow.currentStatus;
    if (status !== 'submitted') {
      throw new Error(`Expected status 'submitted', got '${status}'`);
    }
    
    console.log(`   ✅ Application submitted successfully`);
    this.addStepResult('Submit Application', true, { status });
  }

  async step8_TrackApplicationStatus() {
    console.log('\n📊 Step 8: Tracking Application Status...');
    
    const response = await axios.get(
      `${SERVICES.APPLICATION_SERVICE}/api/applications/${this.applicationId}`,
      {
        headers: { Authorization: `Bearer ${this.authToken}` }
      }
    );
    
    const application = response.data.data;
    const currentStatus = application.workflow.currentStatus;
    
    console.log(`   ✅ Application status: ${currentStatus}`);
    this.addStepResult('Track Application Status', true, { 
      applicationId: application.applicationId,
      status: currentStatus,
      hasWorkflow: !!application.workflow,
      hasAuditTrail: !!application.auditTrail
    });
  }

  async step9_GetApplicationTimeline() {
    console.log('\n📅 Step 9: Getting Application Timeline...');
    
    const response = await axios.get(
      `${SERVICES.APPLICATION_SERVICE}/api/applications/${this.applicationId}/timeline`,
      {
        headers: { Authorization: `Bearer ${this.authToken}` }
      }
    );
    
    const timeline = response.data.data;
    if (!Array.isArray(timeline) || timeline.length === 0) {
      throw new Error('Timeline should contain at least one entry');
    }
    
    console.log(`   ✅ Timeline retrieved with ${timeline.length} entries`);
    this.addStepResult('Get Application Timeline', true, { 
      timelineEntries: timeline.length,
      hasTimestamps: timeline.every(entry => entry.timestamp)
    });
  }

  async step10_TestStatusUpdates() {
    console.log('\n🔄 Step 10: Testing Status Updates...');
    
    // Add a comment to the application
    const commentResponse = await axios.post(
      `${SERVICES.APPLICATION_SERVICE}/api/applications/${this.applicationId}/comments`,
      {
        comment: 'Test comment for integration verification',
        commentType: 'internal'
      },
      {
        headers: { Authorization: `Bearer ${this.authToken}` }
      }
    );
    
    // Get comments to verify
    const getCommentsResponse = await axios.get(
      `${SERVICES.APPLICATION_SERVICE}/api/applications/${this.applicationId}/comments`,
      {
        headers: { Authorization: `Bearer ${this.authToken}` }
      }
    );
    
    const comments = getCommentsResponse.data.data;
    if (!Array.isArray(comments) || comments.length === 0) {
      throw new Error('Comments should contain at least one entry');
    }
    
    console.log(`   ✅ Status updates working - ${comments.length} comments found`);
    this.addStepResult('Test Status Updates', true, { 
      commentsCount: comments.length,
      canAddComments: true,
      canRetrieveComments: true
    });
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
      // Delete application
      if (this.applicationId && this.authToken) {
        await axios.delete(
          `${SERVICES.APPLICATION_SERVICE}/api/applications/${this.applicationId}`,
          {
            headers: { Authorization: `Bearer ${this.authToken}` }
          }
        );
        console.log('   ✅ Test application deleted');
      }
      
      // Delete scheme
      if (this.schemeId && this.authToken) {
        await axios.delete(
          `${SERVICES.SCHEME_SERVICE}/api/schemes/${this.schemeId}`,
          {
            headers: { Authorization: `Bearer ${this.authToken}` }
          }
        );
        console.log('   ✅ Test scheme deleted');
      }
      
    } catch (error) {
      console.log(`   ⚠️  Cleanup warning: ${error.message}`);
    }
  }

  addStepResult(stepName, success, data = {}) {
    this.results.steps.push({
      step: stepName,
      success,
      timestamp: new Date().toISOString(),
      data
    });
  }

  generateReport() {
    const reportPath = './e2e-workflow-report.json';
    require('fs').writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    console.log('\n📊 Workflow Test Summary');
    console.log('=' .repeat(30));
    console.log(`Total Steps: ${this.results.steps.length}`);
    console.log(`Successful: ${this.results.steps.filter(s => s.success).length}`);
    console.log(`Failed: ${this.results.steps.filter(s => !s.success).length}`);
    console.log(`Overall: ${this.results.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  const tester = new E2EWorkflowTester();
  await tester.runWorkflow();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ E2E Test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { E2EWorkflowTester };