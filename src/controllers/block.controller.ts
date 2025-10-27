import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Block } from '../types';
import { BlockchainService } from '../services/blockchain.service';
import Logger from '../utils/logger';

export class BlockController {
  private blockchainService: BlockchainService;
  private logger: Logger;

  constructor(blockchainService: BlockchainService, logger: Logger) {
    this.blockchainService = blockchainService;
    this.logger = logger.child('BlockController');
  }

  public async addBlock(
    request: FastifyRequest<{ Body: Block }>,
    reply: FastifyReply
  ) {
    try {
      const block = request.body;
      this.logger.info(`Adding block at height ${block.height}`);
      
      await this.blockchainService.processBlock(block);
      
      this.logger.info(`Successfully added block ${block.height}`);
      return reply.status(200).send({ success: true });
    } catch (error) {
      this.logger.error('Error adding block', error as Error);
      return reply.status(400).send({ 
        error: (error as Error).message 
      });
    }
  }

  public async rollback(
    request: FastifyRequest<{ Querystring: { height: string } }>,
    reply: FastifyReply
  ) {
    try {
      const height = parseInt(request.query.height);
      
      if (isNaN(height) || height < 0) {
        throw new Error('Invalid height parameter');
      }

      this.logger.info(`Rolling back to height ${height}`);
      await this.blockchainService.rollbackToHeight(height);
      
      this.logger.info(`Successfully rolled back to height ${height}`);
      return reply.status(200).send({ 
        success: true, 
        height 
      });
    } catch (error) {
      this.logger.error('Error during rollback', error as Error);
      return reply.status(400).send({ 
        error: (error as Error).message 
      });
    }
  }
}

export default BlockController;
