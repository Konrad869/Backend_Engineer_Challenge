import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { BlockchainService } from '../../src/services/blockchain.service';
import { BlockRepository } from '../../src/repositories/block.repository';
import { TransactionRepository } from '../../src/repositories/transaction.repository';
import Logger from '../../src/utils/logger';
import type { Block, Transaction, Input, Output } from '../../src/types';

describe('BlockchainService', () => {
  let service: BlockchainService;
  let blockRepository: BlockRepository;
  let transactionRepository: TransactionRepository;
  let logger: Logger;
  

  let mockBlock: Block;
  
 
  const createMockBlock = (height: number, transactions: Transaction[] = []): Block => {
    const block: Block = {
      id: '', 
      height,
      transactions
    };
 
    const mockLogger = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
      fatal: () => {},
      trace: () => {},
      child: () => mockLogger,
      level: 'info'
    };
    
    const service = new BlockchainService(
      {} as BlockRepository,
      {} as TransactionRepository,
      mockLogger as any
    );
    block.id = (service as any).calculateBlockHash(height, transactions);
    return block;
  };
  
  const mockTransaction: Transaction = {
    id: 'tx123',
    inputs: [
      { txId: 'prevTx1', index: 0 },
      { txId: 'prevTx2', index: 1 }
    ],
    outputs: [
      { address: 'addr1', value: 100 },
      { address: 'addr2', value: 50 }
    ]
  };
  
  beforeEach(() => {
  
    mockBlock = createMockBlock(42);
  
    blockRepository = {
      getCurrentHeight: mock(async () => 41),
      saveBlock: mock(async () => {}),
      rollbackToHeight: mock(async () => {})
    } as unknown as BlockRepository;
    
    transactionRepository = {
      saveTransaction: mock(async () => {}),
      getUtxo: mock(async (txId: string, index: number) => {
        
        if (txId === 'prevTx1' && index === 0) {
          return { address: 'addr1', value: 100 };
        } else if (txId === 'prevTx2' && index === 1) {
          return { address: 'addr2', value: 50 };
        }
        return null;
      }),
      getBalance: mock(async () => 150),
      validateTransaction: mock(async () => ({ valid: true }))
    } as unknown as TransactionRepository;
    
    logger = {
      info: mock(),
      error: mock(),
      warn: mock(),
      debug: mock(),
      child: mock(() => logger)
    } as unknown as Logger;
    
    service = new BlockchainService(
      blockRepository,
      transactionRepository,
      logger
    );
  });
  
  describe('calculateBlockHash', () => {
    test('should generate a consistent hash for the same input', () => {
      const height = 42;
      const transactions: Transaction[] = [
        { id: 'tx1', inputs: [], outputs: [] },
        { id: 'tx2', inputs: [], outputs: [] }
      ];
      
      const hash1 = service['calculateBlockHash'](height, transactions);
      const hash2 = service['calculateBlockHash'](height, transactions);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); 
    });
  });
  
  describe('validateBlock', () => {
    test('should validate a correct block', async () => {
      const block: Block = {
        ...mockBlock,
        id: service['calculateBlockHash'](mockBlock.height, mockBlock.transactions)
      };
      
      const result = await service['validateBlock'](block);
      
      expect(result.valid).toBe(true);
    });
    
    test('should reject block with incorrect height', async () => {
      const block = createMockBlock(100); 
      
      const result = await service['validateBlock'](block);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid height');
    });
    
    test('should reject block with incorrect hash', async () => {
      const block: Block = {
        ...createMockBlock(42),
        id: 'invalid-hash'
      };
      
      const result = await service['validateBlock'](block);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid block id');
    });
  });
  
  describe('processBlock', () => {
    test('should process a valid block', async () => {
      const block = createMockBlock(42, [mockTransaction]);
      
      await service.processBlock(block);
      
      expect(blockRepository.saveBlock).toHaveBeenCalledWith(block.id, block.height);
      expect(transactionRepository.saveTransaction).toHaveBeenCalledWith(
        mockTransaction,
        block.id,
        block.height
      );
    });
    
    test('should reject an invalid block', async () => {
      const block: Block = {
        ...mockBlock,
        height: 100, 
        id: 'invalid-hash'
      };
      
      await expect(service.processBlock(block)).rejects.toThrow('Invalid height');
    });
  });
  
  describe('getBalance', () => {
    test('should return balance for an address', async () => {
      const address = 'test-address';
      const balance = await service.getBalance(address);
      
      expect(balance).toBe(150);
      expect(transactionRepository.getBalance).toHaveBeenCalledWith(address);
    });
  });
  
  describe('rollbackToHeight', () => {
    test('should rollback to specified height', async () => {
      const targetHeight = 30;
      
      await service.rollbackToHeight(targetHeight);
      
      expect(blockRepository.rollbackToHeight).toHaveBeenCalledWith(targetHeight);
      expect(logger.info).toHaveBeenCalledWith(
        `Rolling back from height 41 to ${targetHeight}`
      );
    });
    
    test('should reject rollback to future height', async () => {
      const targetHeight = 50; 
      
      await expect(service.rollbackToHeight(targetHeight)).rejects.toThrow(
        `Cannot rollback to height ${targetHeight}`
      );
    });
  });
});
