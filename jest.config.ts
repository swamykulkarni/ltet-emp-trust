import { getJestProjects } from '@nx/jest';

export default {
  projects: getJestProjects(),
  collectCoverageFrom: [
    'apps/**/*.{ts,tsx}',
    'libs/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.spec.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']
};