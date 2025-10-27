import { createHash } from 'crypto';
import type { Block, Transaction } from '../types';
import { BlockRepository } from '../repositories/block.repository';
import { TransactionRepository } from '../repositories/transaction.repository';
import Logger from '../utils/logger';

export class BlockchainService {
  private blockRepository: BlockRepository;
  private transactionRepository: TransactionRepository;
  private logger: Logger;

  constructor(
    blockRepository: BlockRepository,
    transactionRepository: TransactionRepository,
    logger: Logger
  ) {
    this.blockRepository = blockRepository;
    this.transactionRepository = transactionRepository;
    this.logger = logger.child('BlockchainService');
  }

  public calculateBlockHash(height: number, transactions: Transaction[]): string {
    const data = height + transactions.map(tx => tx.id).join('');
    return createHash('sha256').update(data).digest('hex');
  }

  public async validateBlock(block: Block): Promise<{ valid: boolean; error?: string }> {
    
    const currentHeight = await this.blockRepository.getCurrentHeight();
    if (block.height !== currentHeight + 1) {
      this.logger.warn(`Invalid block height. Expected ${currentHeight + 1}, got ${block.height}`);
      return { 
        valid: false, 
        error: `Invalid height. Expected ${currentHeight + 1}, got ${block.height}` 
      };
    }

   
    const expectedId = this.calculateBlockHash(block.height, block.transactions);
    if (block.id !== expectedId) {
      this.logger.warn(`Invalid block hash. Expected ${expectedId}, got ${block.id}`);
      return { 
        valid: false, 
        error: `Invalid block id. Expected ${expectedId}, got ${block.id}` 
      };
    }

    
    for (const tx of block.transactions) {
      const validation = await this.validateTransaction(tx);
      if (!validation.valid) {
        return validation;
      }
    }

    return { valid: true };
  }

  private async validateTransaction(tx: Transaction): Promise<{ valid: boolean; error?: string }> {
    let inputSum = 0;
    let outputSum = 0;

   
    for (const input of tx.inputs) {
      const utxo = await this.transactionRepository.getUtxo(input.txId, input.index);
      if (!utxo) {
        this.logger.warn(`UTXO not found: ${input.txId}:${input.index}`);
        return { 
          valid: false, 
          error: `UTXO not found or already spent: ${input.txId}:${input.index}` 
        };
      }
      inputSum += utxo.value;
    }

    
    for (const output of tx.outputs) {
      outputSum += output.value;
    }

    
    if (tx.inputs.length > 0 && inputSum !== outputSum) {
      this.logger.warn(`Transaction ${tx.id}: input sum (${inputSum}) does not equal output sum (${outputSum})`);
      return { 
        valid: false, 
        error: `Transaction ${tx.id}: input sum (${inputSum}) does not equal output sum (${outputSum})` 
      };
    }

    return { valid: true };
  }

  public async processBlock(block: Block): Promise<void> {
    const validation = await this.validateBlock(block);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

   
    await this.blockRepository.saveBlock(block.id, block.height);

    
    for (const tx of block.transactions) {
      await this.transactionRepository.saveTransaction(tx, block.id, block.height);
    }

    this.logger.info(`Processed block ${block.height} with ${block.transactions.length} transactions`);
  }

  public async getBalance(address: string): Promise<number> {
    return this.transactionRepository.getBalance(address);
  }

  public async rollbackToHeight(height: number): Promise<void> {
    const currentHeight = await this.blockRepository.getCurrentHeight();
    
    if (height > currentHeight) {
      throw new Error(`Cannot rollback to height ${height}. Current height is ${currentHeight}`);
    }

    this.logger.info(`Rolling back from height ${currentHeight} to ${height}`);
    await this.blockRepository.rollbackToHeight(height);
    this.logger.info(`Successfully rolled back to height ${height}`);
  }
}

export default BlockchainService;
