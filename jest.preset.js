const { workspaceRoot } = require('@nx/devkit');

module.exports = {
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest',
  },
  resolver: '@nx/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageReporters: ['html', 'lcov', 'text'],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.config.{ts,js}',
    '!**/*.spec.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
  ],
  setupFilesAfterEnv: [`${workspaceRoot}/jest.setup.ts`],
  testEnvironment: 'node',
  preset: 'ts-jest',
};