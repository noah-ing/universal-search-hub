import pino from 'pino';
import { config as loadEnv } from 'dotenv';

// Load environment variables
loadEnv();

// Default configuration
const LOG_LEVEL = process.env['LOG_LEVEL'] || 'info';
const LOG_FORMAT = process.env['LOG_FORMAT'] || 'pretty';

// Create logger instance
export const logger = pino({
    level: LOG_LEVEL,
    transport: LOG_FORMAT === 'pretty' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    } : undefined
});

// Create child loggers for different components
export const createLogger = (component: string) => logger.child({ component });

// Export specific loggers
export const networkLogger = createLogger('network');
export const raftLogger = createLogger('raft');
export const searchLogger = createLogger('search');
export const storageLogger = createLogger('storage');
export const metricsLogger = createLogger('metrics');

/**
 * Convert Error to plain object
 */
const errorToObject = (error: Error): Record<string, unknown> => ({
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...Object.getOwnPropertyNames(error).reduce((acc, key) => ({
        ...acc,
        [key]: (error as unknown as Record<string, unknown>)[key]
    }), {})
});

/**
 * Error logging helper
 */
export const logError = (logger: pino.Logger, error: unknown, context?: string) => {
    const errorObj = error instanceof Error 
        ? errorToObject(error)
        : error as Record<string, unknown>;

    if (context) {
        logger.error({ error: errorObj, context }, 'Error occurred');
    } else {
        logger.error({ error: errorObj }, 'Error occurred');
    }
};

/**
 * Performance logging helper
 */
export const logPerformance = (
    logger: pino.Logger,
    operation: string,
    startTime: number,
    metadata?: Record<string, unknown>
) => {
    const duration = performance.now() - startTime;
    logger.debug({
        operation,
        duration: `${duration.toFixed(2)}ms`,
        ...metadata
    }, 'Performance measurement');
};

/**
 * Health check logging helper
 */
export const logHealth = (
    logger: pino.Logger,
    status: 'healthy' | 'degraded' | 'unhealthy',
    details: Record<string, unknown>
) => {
    logger.info({
        status,
        ...details
    }, 'Health check');
};

/**
 * State change logging helper
 */
export const logStateChange = (
    logger: pino.Logger,
    component: string,
    fromState: string,
    toState: string,
    metadata?: Record<string, unknown>
) => {
    logger.info({
        component,
        fromState,
        toState,
        ...metadata
    }, 'State changed');
};

/**
 * Metrics logging helper
 */
export const logMetrics = (
    logger: pino.Logger,
    metrics: Record<string, unknown>
) => {
    logger.info({
        timestamp: Date.now(),
        ...metrics
    }, 'Metrics update');
};
