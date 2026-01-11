#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 LTET Integration Test Setup Validation');
console.log('=' .repeat(50));

// Check required files
const requiredFiles = [
  'integration-tests/complete-e2e-workflow.test.ts',
  'integration-tests/load-performance.test.ts',
  'integration-tests/service-integration-validation.test.ts',
  'integration-tests/core-services.integration.test.ts',
  'integration-tests/api-contracts.test.ts',
  'scripts/run-complete-integration-tests.js',
  'scripts/test-e2e-workflow.js',
  'scripts/verify-integration.js',
  'INTEGRATION_TEST_STATUS.md'
];

console.log('\n📁 Checking Required Files:');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Check package.json scripts
console.log('\n📋 Checking Package.json Scripts:');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredScripts = [
  'test:integration-complete',
  'test:integration-e2e',
  'test:integration-load',
  'test:integration-services'
];

let allScriptsExist = true;
requiredScripts.forEach(script => {
  const exists = packageJson.scripts[script];
  console.log(`   ${exists ? '✅' : '❌'} ${script}`);
  if (!exists) allScriptsExist = false;
});

// Check integration-tests package.json
console.log('\n📦 Checking Integration Tests Dependencies:');
const integrationPackageExists = fs.existsSync('integration-tests/package.json');
console.log(`   ${integrationPackageExists ? '✅' : '❌'} integration-tests/package.json`);

if (integrationPackageExists) {
  const integrationPackage = JSON.parse(fs.readFileSync('integration-tests/package.json', 'utf8'));
  const requiredDeps = ['axios', 'jest', '@types/jest'];
  
  requiredDeps.forEach(dep => {
    const exists = integrationPackage.dependencies?.[dep] || integrationPackage.devDependencies?.[dep];
    console.log(`   ${exists ? '✅' : '❌'} ${dep}`);
  });
}

// Check Docker setup
console.log('\n🐳 Checking Docker Configuration:');
const dockerComposeExists = fs.existsSync('docker-compose.yml');
console.log(`   ${dockerComposeExists ? '✅' : '❌'} docker-compose.yml`);

// Summary
console.log('\n📊 Validation Summary:');
console.log('=' .repeat(30));

if (allFilesExist && allScriptsExist && integrationPackageExists) {
  console.log('🎉 Integration Test Setup is Complete!');
  console.log('✅ All required files and configurations are in place');
  console.log('\n🚀 Ready to run integration tests:');
  console.log('   npm run test:integration-complete    # Run full test suite');
  console.log('   npm run test:integration-e2e         # Run E2E workflow tests');
  console.log('   npm run test:integration-load        # Run load/performance tests');
  console.log('   npm run test:integration-services    # Run service integration tests');
  
  process.exit(0);
} else {
  console.log('❌ Integration Test Setup is Incomplete');
  console.log('⚠️  Please ensure all required files and configurations are in place');
  
  process.exit(1);
}