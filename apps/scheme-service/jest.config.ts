/* eslint-disable */
export default {
  displayName: 'scheme-service',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/scheme-service',
  setupFilesAfterEnv: ['../../jest.setup.ts'],
};