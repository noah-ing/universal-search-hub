type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: string | number | boolean | null | undefined | LogContext;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  tags?: string[];
}

interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableMetrics: boolean;
  sampleRate: number;
}

interface LogMetrics {
  metrics: Record<string, number>;
  errorCounts: Record<string, number>;
}

class Logger {
  private static instance: Logger;
  private config: LoggerConfig = {
    minLevel: (process.env.NODE_ENV === 'production') ? 'info' : 'debug',
    enableConsole: process.env.NODE_ENV !== 'production',
    enableMetrics: process.env.NODE_ENV === 'production',
    sampleRate: 0.1, // 10% sampling for metrics
  };

  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private metrics: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();

  private constructor() {
    // Initialize error listener
    if (typeof window !== 'undefined') {
      this.setupErrorListeners();
    }
  }

  private setupErrorListeners(): void {
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      this.error('Unhandled Promise Rejection', {
        reason: this.serializeError(event.reason),
        promise: 'Promise rejected'
      });
    });

    window.addEventListener('error', (event: ErrorEvent) => {
      this.error('Uncaught Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: this.serializeError(event.error)
      });
    });
  }

  private serializeError(error: unknown): LogContext {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack || '',
      };
    }
    return { message: String(error) };
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.config.minLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const contextStr = entry.context ? ` | ${JSON.stringify(entry.context)}` : '';
    const tagsStr = entry.tags?.length ? ` | [${entry.tags.join(', ')}]` : '';
    return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr}${tagsStr}`;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    tags?: string[]
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      tags,
    };
  }

  private incrementMetric(name: string): void {
    if (this.config.enableMetrics && Math.random() < this.config.sampleRate) {
      const current = this.metrics.get(name) || 0;
      this.metrics.set(name, current + 1);
    }
  }

  private trackError(error: Error | string): void {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const current = this.errorCounts.get(errorName) || 0;
    this.errorCounts.set(errorName, current + 1);
  }

  public debug(message: string, context?: LogContext, tags?: string[]): void {
    if (this.shouldLog('debug')) {
      const entry = this.createLogEntry('debug', message, context, tags);
      if (this.config.enableConsole) {
        console.debug(this.formatMessage(entry));
      }
      this.incrementMetric('debug_logs');
    }
  }

  public info(message: string, context?: LogContext, tags?: string[]): void {
    if (this.shouldLog('info')) {
      const entry = this.createLogEntry('info', message, context, tags);
      if (this.config.enableConsole) {
        console.info(this.formatMessage(entry));
      }
      this.incrementMetric('info_logs');
    }
  }

  public warn(message: string, context?: LogContext, tags?: string[]): void {
    if (this.shouldLog('warn')) {
      const entry = this.createLogEntry('warn', message, context, tags);
      if (this.config.enableConsole) {
        console.warn(this.formatMessage(entry));
      }
      this.incrementMetric('warn_logs');
    }
  }

  public error(message: string, context?: LogContext, tags?: string[]): void {
    if (this.shouldLog('error')) {
      const entry = this.createLogEntry('error', message, context, tags);
      if (this.config.enableConsole) {
        console.error(this.formatMessage(entry));
      }
      this.incrementMetric('error_logs');

      if (context?.error instanceof Error) {
        this.trackError(context.error);
      }
    }
  }

  public getMetrics(): LogMetrics {
    return {
      metrics: Object.fromEntries(this.metrics),
      errorCounts: Object.fromEntries(this.errorCounts),
    };
  }

  public setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Performance monitoring
  public async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: string[]
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.debug(`Performance measurement: ${name}`, { duration }, tags);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`Performance measurement failed: ${name}`, {
        duration,
        error: this.serializeError(error)
      }, tags);
      throw error;
    }
  }

  public measure<T>(name: string, fn: () => T, tags?: string[]): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.debug(`Performance measurement: ${name}`, { duration }, tags);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`Performance measurement failed: ${name}`, {
        duration,
        error: this.serializeError(error)
      }, tags);
      throw error;
    }
  }

  // Group related logs
  public group(name: string, fn: () => void): void {
    if (this.config.enableConsole) {
      console.group(name);
      try {
        fn();
      } finally {
        console.groupEnd();
      }
    } else {
      fn();
    }
  }
}

export const logger = Logger.getInstance();
