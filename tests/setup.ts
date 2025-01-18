import { initSIMD } from '../src/search/vector';
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { rm } from 'fs/promises';

// Load environment variables
loadEnv();

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging noise during tests
process.env.LOG_FORMAT = 'json'; // More structured logging for test output

// Configure longer timeout for SIMD initialization
jest.setTimeout(30000);

// Global setup
beforeAll(async () => {
    try {
        // Initialize SIMD
        await initSIMD();
        console.log('SIMD initialized for tests');
    } catch (error) {
        console.warn('SIMD initialization failed:', error);
        console.warn('Tests will use fallback implementation');
    }
});

// Clean up test data after all tests
afterAll(async () => {
    const testDataDir = join(__dirname, '..', 'test-data');
    try {
        await rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
        console.warn('Failed to clean test data directory:', error);
    }
});

// Add custom matchers
expect.extend({
    toBeWithinRange(received: number, floor: number, ceiling: number) {
        const pass = received >= floor && received <= ceiling;
        if (pass) {
            return {
                message: () =>
                    `expected ${received} not to be within range ${floor} - ${ceiling}`,
                pass: true,
            };
        } else {
            return {
                message: () =>
                    `expected ${received} to be within range ${floor} - ${ceiling}`,
                pass: false,
            };
        }
    },
    toBeValidVector(received: Float32Array, dimension: number) {
        const pass = received instanceof Float32Array && received.length === dimension;
        if (pass) {
            return {
                message: () =>
                    `expected ${received} not to be a valid ${dimension}-dimensional vector`,
                pass: true,
            };
        } else {
            return {
                message: () =>
                    `expected ${received} to be a valid ${dimension}-dimensional vector`,
                pass: false,
            };
        }
    },
});

// Declare custom matchers
declare global {
    namespace jest {
        interface Matchers<R> {
            toBeWithinRange(floor: number, ceiling: number): R;
            toBeValidVector(dimension: number): R;
        }
    }
}

// Mock performance.now() for consistent timing tests
const originalNow = performance.now.bind(performance);
let mockTime = 0;

beforeEach(() => {
    mockTime = 0;
    performance.now = jest.fn(() => mockTime);
});

afterEach(() => {
    performance.now = originalNow;
});

// Helper to advance mock time
global.advanceTime = (ms: number) => {
    mockTime += ms;
};

// Declare global helper
declare global {
    var advanceTime: (ms: number) => void;
}

// Configure console to handle test output better
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = (...args) => {
    if (process.env['JEST_WORKER_ID']) {
        return; // Suppress console.log in test output
    }
    originalConsoleLog(...args);
};

console.warn = (...args) => {
    if (process.env['JEST_WORKER_ID']) {
        return; // Suppress console.warn in test output
    }
    originalConsoleWarn(...args);
};

console.error = (...args) => {
    // Always show errors
    originalConsoleError(...args);
};
