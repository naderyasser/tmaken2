// The product runs in Asia/Riyadh and several helpers (localToday, shift
// windows, punch timestamps) are local-calendar sensitive. Without pinning TZ
// the suite passes or fails depending on the machine's clock — lib/utils.test.ts
// asserts a UTC+3 boundary and failed on this UTC server for that reason alone.
process.env.TZ = process.env.TZ || 'Asia/Riyadh'

const nextJest = require('next/jest')

/** @type {import('jest').Config} */
const createJestConfig = nextJest({
    dir: __dirname,
})

// Add any custom config to be passed to Jest
const config = {
    coverageProvider: 'v8',
    testEnvironment: 'jsdom',

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

    // Module paths
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },

    // Coverage settings
    collectCoverageFrom: [
        'app/**/*.{js,jsx,ts,tsx}',
        'components/**/*.{js,jsx,ts,tsx}',
        'lib/**/*.{js,jsx,ts,tsx}',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/.next/**',
        '!**/coverage/**',
        '!**/jest.config.js',
    ],

    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },

    // Test patterns
    testMatch: [
        '**/__tests__/**/*.[jt]s?(x)',
        '**/?(*.)+(spec|test).[jt]s?(x)',
    ],

    // Ignore E2E tests (those are for Playwright) and integration tests by default
    testPathIgnorePatterns: [
        '/node_modules/',
        '/.next/',
        '/e2e/',
        '/hr-management-system-ui/',
        '/tests/backend-integration',
        '/apps/',
        '\\.integration\\.test\\.',
        '\\.spec\\.',
    ],
    verbose: true,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(config)
