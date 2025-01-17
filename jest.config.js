// jest.config.js

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
    // Typescript configuration
    preset: 'ts-jest',
    testEnvironment: 'node',
    globals: {
      'ts-jest': {
        tsconfig: 'tsconfig.json',
        diagnostics: {
          warnOnly: true,
          ignoreCodes: ['TS151001']
        }
      }
    },
  
    // Test file patterns
    testMatch: [
      '**/tests/**/*.test.ts',
      '**/src/**/*.test.ts'
    ],
    testPathIgnorePatterns: [
      '/node_modules/',
      '/dist/',
      '/coverage/'
    ],
  
    // Module resolution
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',
      '^@types/(.*)$': '<rootDir>/src/types/$1',
      '^@search/(.*)$': '<rootDir>/src/search/$1',
      '^@consensus/(.*)$': '<rootDir>/src/consensus/$1',
      '^@utils/(.*)$': '<rootDir>/src/utils/$1'
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleDirectories: ['node_modules', 'src'],
  
    // Coverage configuration
    collectCoverage: true,
    collectCoverageFrom: [
      'src/**/*.{ts,tsx}',
      '!src/**/*.d.ts',
      '!src/types/**/*',
      '!src/**/index.ts',
      '!src/**/*.stories.{ts,tsx}',
      '!src/mocks/**/*'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'clover', 'html'],
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      },
      './src/search/': {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90
      },
      './src/consensus/': {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90
      }
    },
  
    // Test execution configuration
    maxWorkers: '50%',
    testTimeout: 10000,
    slowTestThreshold: 5000,
    verbose: true,
    bail: false,
    ci: process.env.CI === 'true',
  
    // Setup and teardown
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    globalSetup: '<rootDir>/tests/globalSetup.ts',
    globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  
    // Mocking behavior
    restoreMocks: true,
    clearMocks: true,
    resetMocks: false,
  
    // Reporters
    reporters: [
      'default',
      [
        'jest-junit',
        {
          outputDirectory: 'reports/junit',
          outputName: 'junit.xml',
          classNameTemplate: '{filepath}',
          titleTemplate: '{title}',
          ancestorSeparator: ' › ',
          usePathForSuiteName: true
        }
      ]
    ],
  
    // Error handling
    errorOnDeprecated: true,
    detectOpenHandles: true,
    forceExit: true,
  
    // Custom environment variables
    testEnvironmentOptions: {
      url: 'http://localhost'
    },
  
    // Transform configuration
    transform: {
      '^.+\\.tsx?$': ['ts-jest', {
        tsconfig: 'tsconfig.json'
      }]
    },
    transformIgnorePatterns: [
      '/node_modules/',
      '\\.pnp\\.[^\\/]+$'
    ],
  
    // Watch configuration
    watchPathIgnorePatterns: [
      '/node_modules/',
      '/dist/',
      '/coverage/',
      '/reports/'
    ],
    watchPlugins: [
      'jest-watch-typeahead/filename',
      'jest-watch-typeahead/testname'
    ],
  
    // Snapshot configuration
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: false
    },
    snapshotSerializers: [],
  
    // Project configuration for monorepo support
    projects: [
      {
        displayName: 'unit',
        testMatch: [
          '<rootDir>/src/**/*.test.ts',
          '<rootDir>/tests/unit/**/*.test.ts'
        ]
      },
      {
        displayName: 'integration',
        testMatch: [
          '<rootDir>/tests/integration/**/*.test.ts'
        ],
        setupFilesAfterEnv: [
          '<rootDir>/tests/integration/setup.ts'
        ]
      }
    ],
  
    // Performance optimization
    timers: 'modern',
    cache: true,
    cacheDirectory: '<rootDir>/node_modules/.cache/jest',
    haste: {
      computeSha1: true,
      throwOnModuleCollision: true
    }
  };