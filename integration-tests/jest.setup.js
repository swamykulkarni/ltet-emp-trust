// Global test setup for integration tests
const axios = require('axios');

// Set default timeout for axios requests
axios.defaults.timeout = 10000;

// Global test timeout
jest.setTimeout(30000);

// Suppress console.log during tests unless explicitly needed
const originalConsoleLog = console.log;
console.log = (...args) => {
  if (process.env.VERBOSE_TESTS === 'true') {
    originalConsoleLog(...args);
  }
};

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Clean up after tests
afterAll(async () => {
  // Give time for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
});