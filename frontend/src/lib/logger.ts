/**
 * Centralized Logger
 *
 * Professional logging system with:
 * - Environment-based log levels
 * - Structured logging
 * - Production-safe (no sensitive data)
 * - Performance tracking
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.minLevel = this.isDevelopment ? 'debug' : 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const levelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(this.minLevel);
    return levelIndex >= minLevelIndex;
  }

  private formatMessage(message: string, context?: LogContext): string {
    if (!context || Object.keys(context).length === 0) {
      return message;
    }
    return `${message} ${JSON.stringify(context)}`;
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    console.debug(`[DEBUG] ${this.formatMessage(message, context)}`);
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    console.log(`[INFO] ${this.formatMessage(message, context)}`);
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;
    console.warn(`[WARN] ${this.formatMessage(message, context)}`);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return;

    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      } : error,
    };

    console.error(`[ERROR] ${this.formatMessage(message, errorContext)}`);
  }

  time(label: string): void {
    if (!this.isDevelopment) return;
    console.time(`[PERF] ${label}`);
  }

  timeEnd(label: string): void {
    if (!this.isDevelopment) return;
    console.timeEnd(`[PERF] ${label}`);
  }
}

export const logger = new Logger();
export const { debug, info, warn, error, time, timeEnd } = logger;
