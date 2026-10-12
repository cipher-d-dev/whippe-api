import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  // Don't load the real env (no .env in test — tests mock dependencies directly)
  setupFiles: ['<rootDir>/tests/setup.ts'],
};

export default config;
