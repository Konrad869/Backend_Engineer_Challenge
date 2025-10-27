import type { FastifyBaseLogger } from 'fastify';

type LogLevel = 'info' | 'error' | 'warn' | 'debug';

export class Logger {
  private logger: FastifyBaseLogger;
  private context: string;

  constructor(logger: FastifyBaseLogger, context: string = 'Application') {
    this.logger = logger;
    this.context = `[${context}]`;
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const logMessage = `${this.context} ${message}`;
    const logData = meta ? { ...meta, timestamp: new Date().toISOString() } : { timestamp: new Date().toISOString() };
    
    switch (level) {
      case 'error':
        this.logger.error(logMessage, logData);
        break;
      case 'warn':
        this.logger.warn(logMessage, logData);
        break;
      case 'debug':
        this.logger.debug(logMessage, logData);
        break;
      case 'info':
      default:
        this.logger.info(logMessage, logData);
        break;
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    const errorInfo = error ? { 
      error: error.message, 
      stack: error.stack 
    } : {};
    this.log('error', message, { ...errorInfo, ...meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  child(context: string): Logger {
    return new Logger(this.logger, `${this.context} [${context}]`);
  }
}

export default Logger;
