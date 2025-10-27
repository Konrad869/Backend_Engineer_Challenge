import { describe, test, expect, beforeEach, mock } from 'bun:test';
import Logger from '../../src/utils/logger';

describe('Logger', () => {
  const mockLogger = {
    info: mock(),
    error: mock(),
    warn: mock(),
    debug: mock(),
  };

  beforeEach(() => {
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.debug.mockClear();
  });

  test('should log info messages', () => {
    const logger = new Logger(mockLogger as any, 'Test');
    logger.info('Test message');
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[Test] Test message',
      expect.objectContaining({
        timestamp: expect.any(String)
      })
    );
  });

  test('should log error messages with stack trace', () => {
    const logger = new Logger(mockLogger as any, 'Test');
    const error = new Error('Test error');
    logger.error('Something went wrong', error);
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[Test] Something went wrong',
      expect.objectContaining({
        error: 'Test error',
        stack: expect.any(String),
        timestamp: expect.any(String)
      })
    );
  });

  test('should log with metadata', () => {
    const logger = new Logger(mockLogger as any, 'Test');
    logger.warn('Warning with metadata', { key: 'value' });
    
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[Test] Warning with metadata',
      expect.objectContaining({
        key: 'value',
        timestamp: expect.any(String)
      })
    );
  });

  test('should create child logger with context', () => {
    const parentLogger = new Logger(mockLogger as any, 'Parent');
    const childLogger = parentLogger.child('Child');
    
    childLogger.debug('Child logger message');
    
   
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[[Parent] [Child]] Child logger message',
      expect.objectContaining({
        timestamp: expect.any(String)
      })
    );
  });
});
