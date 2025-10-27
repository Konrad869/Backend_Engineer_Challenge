import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { BlockRepository } from '../../src/repositories/block.repository';
import type { Database } from '../../src/config/database';
import type { Pool, PoolClient, QueryResult } from 'pg';

describe('BlockRepository', () => {
  let repository: BlockRepository;
  let mockDatabase: Database;
  let mockQuery: any;
  let mockLogger: any;
  let mockClient: any;

  beforeEach(() => {
  
    mockQuery = mock(async () => ({
      rows: [],
      rowCount: 0,
      command: '',
      oid: 0,
      fields: []
    }));

    mockLogger = {
      debug: mock(),
      info: mock(),
      error: mock(),
      child: mock(() => mockLogger)
    };
    
   
    mockDatabase = {
      query: mockQuery,
      getPool: mock()
    } as any;

    mockDatabase = {
      query: mockQuery,
      getPool: mock(() => ({
        connect: mock(async () => ({
          query: mockQuery,
          release: mock()
        }))
      }))
    } as unknown as Database;

    repository = new BlockRepository(mockDatabase, mockLogger);
  });

  test('getCurrentHeight should return 0 when no blocks exist', async () => {
    mockQuery.mockResolvedValueOnce({ 
      rows: [{ max: null }],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: []
    });
    
    const height = await repository.getCurrentHeight();
    
    expect(height).toBe(0);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT MAX(height) as max FROM blocks',
      []
    );
  });

  test('saveBlock should save a block successfully', async () => {
    const blockId = 'block-123';
    const height = 1;
    
    mockQuery.mockResolvedValueOnce({ 
      rowCount: 1,
      command: 'INSERT',
      oid: 0,
      fields: []
    });
    
    await repository.saveBlock(blockId, height);
    
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT INTO blocks (id, height) VALUES ($1, $2)',
      [blockId, height]
    );
  });

  test('blockExists should return true if block exists', async () => {
    const blockId = 'block-123';
    mockQuery.mockResolvedValueOnce({ 
      rows: [{ id: blockId }], 
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: []
    });
    
    const exists = await repository.blockExists(blockId);
    
    expect(exists).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT 1 FROM blocks WHERE id = $1',
      [blockId]
    );
  });

  test('blockExists should return false if block does not exist', async () => {
    const blockId = 'non-existent-block';
    mockQuery.mockResolvedValueOnce({ 
      rows: [], 
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: []
    });
    
    const exists = await repository.blockExists(blockId);
    
    expect(exists).toBe(false);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test('rollbackToHeight should rollback to specified height', async () => {
    const height = 30;
    
 
    const mockClient = {
      query: mock()
        .mockResolvedValueOnce({}) 
        .mockResolvedValueOnce({ rowCount: 1 }) 
        .mockResolvedValueOnce({ rowCount: 1 }) 
        .mockResolvedValueOnce({ rowCount: 1 }) 
        .mockResolvedValueOnce({ rowCount: 1 }) 
        .mockResolvedValueOnce({}), 
      release: mock()
    };
    
    
    const mockPool = {
      connect: mock().mockResolvedValue(mockClient),
      query: mock(),
      end: mock(),
      on: mock(),
      once: mock(),
      removeListener: mock(),
      removeAllListeners: mock(),
      getClient: mock(),
      release: mock(),
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
      options: {},
      _pulseQueue: mock(),
      _remove: mock(),
      _clients: [],
      _idle: [],
      _pendingQueue: [],
      _ending: false,
      _connectionTimeout: 0,
      _idleTimeout: 0,
      _lastIdleDispatched: 0,
      _log: mock(),
      _events: {},
      _eventsCount: 0
    } as unknown as Pool;
    
    
    mockDatabase.getPool = mock(() => mockPool);
    
    await repository.rollbackToHeight(height);
    
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    
    const secondCall = (mockClient.query as any).mock.calls[1];
    
    const normalizeSQL = (sql: string) => 
      sql.replace(/\s+/g, ' ')
         .replace(/\(\s+/g, '(')
         .replace(/\s+\)/g, ')')
         .trim();
         
    const expectedSQL = 'UPDATE utxos SET spent = FALSE, spent_in_tx = NULL WHERE spent_in_tx IN (SELECT id FROM transactions WHERE block_height > $1)';
    expect(normalizeSQL(secondCall[0])).toBe(normalizeSQL(expectedSQL));
    expect(secondCall[1]).toEqual([height]);
    
  
    expect(mockClient.query).toHaveBeenNthCalledWith(3, 'DELETE FROM utxos WHERE block_height > $1', [height]);
    expect(mockClient.query).toHaveBeenNthCalledWith(4, 'DELETE FROM transactions WHERE block_height > $1', [height]);
    expect(mockClient.query).toHaveBeenNthCalledWith(5, 'DELETE FROM blocks WHERE height > $1', [height]);
    expect(mockClient.query).toHaveBeenNthCalledWith(6, 'COMMIT');
    expect(mockLogger.info).toHaveBeenCalledWith(`Rolled back to height ${height}`);
  });

  test('rollbackToHeight should handle errors', async () => {
    const error = new Error('Database error');
    
    
    const mockClient = {
      query: mock()
        .mockResolvedValueOnce({}) 
        .mockRejectedValueOnce(error), 
      release: mock()
    };
    
    
    const mockPool = {
      connect: mock().mockResolvedValue(mockClient),
      query: mock(),
      end: mock(),
      on: mock(),
      once: mock(),
      removeListener: mock(),
      removeAllListeners: mock(),
      getClient: mock(),
      release: mock(),
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
      options: {},
      _pulseQueue: mock(),
      _remove: mock(),
      _clients: [],
      _idle: [],
      _pendingQueue: [],
      _ending: false,
      _connectionTimeout: 0,
      _idleTimeout: 0,
      _lastIdleDispatched: 0,
      _log: mock(),
      _events: {},
      _eventsCount: 0
    } as unknown as Pool;
    
    
    mockDatabase.getPool = mock(() => mockPool);
    
    await expect(repository.rollbackToHeight(30)).rejects.toThrow('Database error');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockLogger.error).toHaveBeenCalledWith('Error during rollback', error);
  });

  test('rollbackToHeight should handle errors', async () => {
    
    const mockPool = {
      connect: mock().mockResolvedValue({
        query: mock()
          .mockRejectedValueOnce(new Error('Database error'))
          .mockImplementationOnce(() => Promise.resolve({})), 
        release: mock()
      })
    } as any;
    
  
    mockDatabase.getPool = mock(() => mockPool);
    
    await expect(repository.rollbackToHeight(10)).rejects.toThrow('Database error');
  });

  test('saveBlock should throw error on duplicate block id', async () => {
    const error = new Error('duplicate key value violates unique constraint');
    mockQuery.mockRejectedValueOnce(error);
    
    await expect(repository.saveBlock('duplicate-id', 1)).rejects.toThrow('duplicate key value violates unique constraint');
    expect(mockLogger.error).toHaveBeenCalledWith('Error saving block', expect.any(Error));
  });

  test('getCurrentHeight should handle database errors', async () => {
    const error = new Error('Connection error');
    mockQuery.mockRejectedValueOnce(error);
    
    await expect(repository.getCurrentHeight()).rejects.toThrow('Connection error');
    expect(mockLogger.error).toHaveBeenCalledWith('Error getting current height', expect.any(Error));
  });

  test('rollbackToHeight should handle transaction errors', async () => {
    
    const mockPool = {
      connect: mock().mockResolvedValue({
        query: mock()
          .mockResolvedValueOnce({}) 
          .mockRejectedValueOnce(new Error('Transaction error')) 
          .mockImplementationOnce(() => Promise.resolve({})), 
        release: mock()
      })
    } as any;
    
   
    mockDatabase.getPool = mock(() => mockPool);
    
    await expect(repository.rollbackToHeight(10)).rejects.toThrow('Transaction error');
    expect(mockLogger.error).toHaveBeenCalledWith('Error during rollback', expect.any(Error));
  });
});
