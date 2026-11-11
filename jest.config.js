/**
 * Jest for the SDK's TypeScript in src/, run in Node. The native packages the SDK imports are replaced by the
 * in-memory stand-ins in tests/mocks/, and tests/setup.ts fails any test that calls fetch without a stub.
 * `npx jest --coverage` prints line coverage of src/ and writes it to coverage/coverage.txt.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^expo-crypto$': '<rootDir>/tests/mocks/expo-crypto.ts',
    '^expo-linking$': '<rootDir>/tests/mocks/expo-linking.ts',
    '^expo-modules-core$': '<rootDir>/tests/mocks/expo-modules-core.ts',
    '^expo-web-browser$': '<rootDir>/tests/mocks/expo-web-browser.ts',
    '^react-native$': '<rootDir>/tests/mocks/react-native.ts',
    '^react-native-keychain$': '<rootDir>/tests/mocks/react-native-keychain.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageReporters: ['text', ['text', { file: 'coverage.txt' }]],
};
