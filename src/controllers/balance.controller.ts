import type { FastifyRequest, FastifyReply } from 'fastify';
import { BlockchainService } from '../services/blockchain.service';
import Logger from '../utils/logger';

export class BalanceController {
  private blockchainService: BlockchainService;
  private logger: Logger;

  constructor(blockchainService: BlockchainService, logger: Logger) {
    this.blockchainService = blockchainService;
    this.logger = logger.child('BalanceController');
  }

  public async getBalance(
    request: FastifyRequest<{ Params: { address: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { address } = request.params;
      this.logger.debug(`Getting balance for address: ${address}`);
      
      const balance = await this.blockchainService.getBalance(address);
      
      this.logger.debug(`Balance for ${address}: ${balance}`);
      return reply.status(200).send({ balance });
    } catch (error) {
      this.logger.error('Error getting balance', error as Error);
      return reply.status(500).send({ 
        error: 'Internal server error' 
      });
    }
  }
}

export default BalanceController;
