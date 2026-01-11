#!/usr/bin/env node

const http = require('http');

const services = [
  { name: 'API Gateway', port: 3000, path: '/health' },
  { name: 'User Service', port: 3001, path: '/health' },
  { name: 'Scheme Service', port: 3002, path: '/health' },
  { name: 'Application Service', port: 3003, path: '/health' },
  { name: 'Document Service', port: 3004, path: '/health' },
  { name: 'Notification Service', port: 3005, path: '/health' },
  { name: 'Web App', port: 4200, path: '/' }
];

async function checkService(service) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: service.port,
      path: service.path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      resolve({
        name: service.name,
        status: res.statusCode === 200 ? 'UP' : 'DOWN',
        statusCode: res.statusCode
      });
    });

    req.on('error', () => {
      resolve({
        name: service.name,
        status: 'DOWN',
        statusCode: 'ERROR'
      });
    });

    req.on('timeout', () => {
      resolve({
        name: service.name,
        status: 'DOWN',
        statusCode: 'TIMEOUT'
      });
    });

    req.end();
  });
}

async function healthCheck() {
  console.log('🏥 LTET Portal Health Check');
  console.log('=' .repeat(50));

  const results = await Promise.all(services.map(checkService));
  
  results.forEach(result => {
    const status = result.status === 'UP' ? '✅' : '❌';
    console.log(`${status} ${result.name.padEnd(20)} ${result.status} (${result.statusCode})`);
  });

  const allUp = results.every(r => r.status === 'UP');
  console.log('=' .repeat(50));
  console.log(`Overall Status: ${allUp ? '✅ ALL SERVICES UP' : '❌ SOME SERVICES DOWN'}`);
  
  process.exit(allUp ? 0 : 1);
}

healthCheck().catch(console.error);