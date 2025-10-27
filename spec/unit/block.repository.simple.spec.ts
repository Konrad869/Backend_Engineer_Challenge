import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { BlockRepository } from '../../src/repositories/block.repository';
import type { Database } from '../../src/config/database';

describe('BlockRepository (Simple)', () => {
  let repository: BlockRepository;
  let mockDatabase: Database;
  let mockQuery: any;
  let mockLogger: any;

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
});
