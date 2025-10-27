import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import Database from './config/database';
import BlockRepository from './repositories/block.repository';
import TransactionRepository from './repositories/transaction.repository';
import BlockchainService from './services/blockchain.service';
import BlockController from './controllers/block.controller';
import BalanceController from './controllers/balance.controller';
import Logger from './utils/logger';

export class App {
  private fastify: FastifyInstance;
  private logger: Logger;
  private database: Database;
  private blockRepository!: BlockRepository;
  private transactionRepository!: TransactionRepository;
  private blockchainService!: BlockchainService;
  private blockController!: BlockController;
  private balanceController!: BalanceController;

  constructor() {
    this.fastify = Fastify({ 
      logger: true,
      disableRequestLogging: process.env.NODE_ENV === 'test'
    });
    
    this.logger = new Logger(this.fastify.log);
    this.database = Database.getInstance(this.logger);
    
    this.initializeRepositories();
    this.initializeServices();
    this.initializeControllers();
    this.initializeRoutes();
  }

  private initializeRepositories(): void {
    this.blockRepository = new BlockRepository(this.database, this.logger);
    this.transactionRepository = new TransactionRepository(this.database, this.logger);
  }

  private initializeServices(): void {
    this.blockchainService = new BlockchainService(
      this.blockRepository,
      this.transactionRepository,
      this.logger
    );
  }

  private initializeControllers(): void {
    this.blockController = new BlockController(this.blockchainService, this.logger);
    this.balanceController = new BalanceController(this.blockchainService, this.logger);
  }

  private initializeRoutes(): void {
 
    this.fastify.get('/', async () => {
      return { status: 'ok', service: 'blockchain-indexer' };
    });

    
    this.fastify.post('/blocks', (req, reply) => 
      this.blockController.addBlock(req as any, reply)
    );

    this.fastify.post('/rollback', (req, reply) =>
      this.blockController.rollback(req as any, reply)
    );

    
    this.fastify.get('/balance/:address', (req, reply) =>
      this.balanceController.getBalance(req as any, reply)
    );
  }

  public async start(): Promise<void> {
    try {
      await this.fastify.listen({
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || '0.0.0.0',
      });
      this.logger.info(`Server listening on ${this.fastify.server.address()}`);
    } catch (err) {
      this.logger.error('Error starting server', err as Error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    await this.fastify.close();
  }

  public getFastifyInstance(): FastifyInstance {
    return this.fastify;
  }
}

export default App;
