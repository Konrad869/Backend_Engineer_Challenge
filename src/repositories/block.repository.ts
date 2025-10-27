import type { QueryResult } from 'pg';
import Database from '../config/database';
import Logger from '../utils/logger';

type BlockRow = {
  id: string;
  height: number;
};

export class BlockRepository {
  private db: Database;
  private logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.db = database;
    this.logger = logger.child('BlockRepository');
  }

  public async getCurrentHeight(): Promise<number> {
    try {
      const result = await this.db.query<{ max: number | null }>(
        'SELECT MAX(height) as max FROM blocks',
        []
      );
      return result.rows[0]?.max ?? 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error getting current height', errorMessage);
      throw errorMessage;
    }
  }

  public async saveBlock(id: string, height: number): Promise<void> {
    try {
      await this.db.query<BlockRow>(
        'INSERT INTO blocks (id, height) VALUES ($1, $2)',
        [id, height]
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error saving block', errorMessage);
      throw errorMessage;
    }
  }

  public async rollbackToHeight(height: number): Promise<void> {
    
    const pool = this.db.getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      
      await client.query(
        `UPDATE utxos SET spent = FALSE, spent_in_tx = NULL 
         WHERE spent_in_tx IN (
           SELECT id FROM transactions WHERE block_height > $1
         )`,
        [height]
      );

  
      await client.query(
        'DELETE FROM utxos WHERE block_height > $1',
        [height]
      );

      
      await client.query(
        'DELETE FROM transactions WHERE block_height > $1',
        [height]
      );

      
      await client.query(
        'DELETE FROM blocks WHERE height > $1',
        [height]
      );

      await client.query('COMMIT');
      this.logger.info(`Rolled back to height ${height}`);
    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error during rollback', errorMessage);
      throw errorMessage;
    } finally {
      client.release();
    }
  }

  public async blockExists(blockId: string): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      'SELECT 1 FROM blocks WHERE id = $1',
      [blockId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }
}

export default BlockRepository;
