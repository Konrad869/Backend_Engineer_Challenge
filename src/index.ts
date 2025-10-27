import 'dotenv/config';
import App from './app';
import Logger from './utils/logger';
import Database from './config/database';

async function bootstrap() {
  try {
    const logger = new Logger(console as any);
    
   
    const database = Database.getInstance(logger);
    
   
    const app = new App();
    await app.start();
    
    
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      await app.stop();
      process.exit(0);
    };
    
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();