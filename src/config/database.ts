import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { Pool } from 'pg';
import Logger from '../utils/logger';

export interface Queryable {
  query<T extends QueryResultRow = any>(
    text: string, 
    params?: any[]
  ): Promise<QueryResult<T>>;
}

export class Database implements Queryable {
  private static instance: Database;
  private pool: Pool;
  private logger: Logger;

  private constructor(logger: Logger) {
    this.logger = logger.child('Database');
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  public static getInstance(logger: Logger): Database {
    if (!Database.instance) {
      Database.instance = new Database(logger);
    }
    return Database.instance;
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async query<T extends QueryResultRow = any>(
    text: string, 
    params: any[] = []
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      this.logger.debug('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Error executing query: ${text}`, errorMessage);
      throw errorMessage;
    }
  }

  public async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export default Database;
