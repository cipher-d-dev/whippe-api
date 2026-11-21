import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  // Tests need the Jest globals, which the build tsconfig (types: ["node"]) hides.
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  // Don't load the real env (no .env in test — tests mock dependencies directly)
  setupFiles: ['<rootDir>/tests/setup.ts'],
};

export default config;
