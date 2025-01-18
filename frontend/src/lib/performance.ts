import { logger } from './logger';

interface PerformanceMetric {
  name: string;
  startTime: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

interface PerformanceStats {
  min: number;
  max: number;
  avg: number;
  p95: number;
  count: number;
}

interface LayoutShiftEntry extends PerformanceEntry {
  hadRecentInput: boolean;
  value: number;
  sources: Array<{
    node?: Node;
    currentRect?: DOMRectReadOnly;
    previousRect?: DOMRectReadOnly;
  }>;
}

interface LargestContentfulPaint extends PerformanceEntry {
  element?: Element;
  size: number;
  startTime: number;
}

const getNow = (): number => {
  if (typeof window !== 'undefined') {
    return window.performance.now();
  }
  // Use Node's process.hrtime() for server-side timing
  const hrTime = process.hrtime();
  return hrTime[0] * 1000 + hrTime[1] / 1000000;
};

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private activeMetrics: Map<string, PerformanceMetric> = new Map();
  private thresholds: Map<string, number> = new Map();

  private constructor() {
    if (typeof window !== 'undefined') {
      this.setupPerformanceObserver();
    }
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private setupPerformanceObserver(): void {
    // Observe long tasks
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'longtask') {
          logger.warn('Long task detected', {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name,
          });
        }
      });
    });

    observer.observe({ entryTypes: ['longtask'] });

    // Observe layout shifts
    const clsObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const layoutShift = entry as LayoutShiftEntry;
        if (layoutShift.hadRecentInput) return;
        logger.debug('Layout shift detected', {
          value: layoutShift.value,
          sources: JSON.stringify(layoutShift.sources),
        });
      });
    });

    clsObserver.observe({ entryTypes: ['layout-shift'] });

    // Observe largest contentful paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as LargestContentfulPaint;
      logger.info('Largest Contentful Paint', {
        time: lastEntry.startTime,
        element: lastEntry.element?.tagName || 'unknown',
        size: lastEntry.size,
      });
    });

    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
  }

  public startMetric(name: string, metadata?: Record<string, unknown>): void {
    const metric: PerformanceMetric = {
      name,
      startTime: getNow(),
      metadata,
    };
    this.activeMetrics.set(name, metric);
  }

  public endMetric(name: string, additionalMetadata?: Record<string, unknown>): void {
    const metric = this.activeMetrics.get(name);
    if (!metric) {
      logger.warn(`No active metric found with name: ${name}`);
      return;
    }

    const endTime = getNow();
    metric.duration = endTime - metric.startTime;
    metric.metadata = { ...metric.metadata, ...additionalMetadata };

    const metrics = this.metrics.get(name) || [];
    metrics.push(metric);
    this.metrics.set(name, metrics);

    this.activeMetrics.delete(name);

    // Check threshold
    const threshold = this.thresholds.get(name);
    if (threshold && metric.duration > threshold) {
      logger.warn(`Performance threshold exceeded for ${name}`, {
        duration: String(metric.duration),
        threshold: String(threshold),
        metadata: JSON.stringify(metric.metadata),
      });
    }
  }

  public setThreshold(name: string, threshold: number): void {
    this.thresholds.set(name, threshold);
  }

  public getStats(name: string): PerformanceStats | null {
    const metricsList = this.metrics.get(name);
    if (!metricsList || metricsList.length === 0) return null;

    const durations = metricsList
      .map(m => m.duration!)
      .sort((a, b) => a - b);

    const sum = durations.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(durations.length * 0.95);

    return {
      min: durations[0],
      max: durations[durations.length - 1],
      avg: sum / durations.length,
      p95: durations[p95Index],
      count: durations.length,
    };
  }

  public clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }

  public async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.startMetric(name, metadata);
    try {
      const result = await fn();
      return result;
    } finally {
      this.endMetric(name);
    }
  }

  public measure<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, unknown>
  ): T {
    this.startMetric(name, metadata);
    try {
      const result = fn();
      return result;
    } finally {
      this.endMetric(name);
    }
  }

  public getMetricsSummary(): Record<string, PerformanceStats> {
    const summary: Record<string, PerformanceStats> = {};
    this.metrics.forEach((_, name) => {
      const stats = this.getStats(name);
      if (stats) {
        summary[name] = stats;
      }
    });
    return summary;
  }

  public reportMetrics(): void {
    const summary = this.getMetricsSummary();
    logger.info('Performance Metrics Summary', {
      metrics: JSON.stringify(summary),
    });

    // Report Web Vitals only on client side
    if (typeof window !== 'undefined') {
      const navigationEntry = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        logger.info('Navigation Timing', {
          dns: String(navigationEntry.domainLookupEnd - navigationEntry.domainLookupStart),
          tcp: String(navigationEntry.connectEnd - navigationEntry.connectStart),
          ttfb: String(navigationEntry.responseStart - navigationEntry.requestStart),
          domLoad: String(navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart),
          load: String(navigationEntry.loadEventEnd - navigationEntry.loadEventStart),
        });
      }
    }
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();
