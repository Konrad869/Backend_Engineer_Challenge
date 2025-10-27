import type { QueryResult } from 'pg';
import Database from '../config/database';
import Logger from '../utils/logger';
import type { Input, Output, Transaction } from '../types';

export class TransactionRepository {
  private db: Database;
  private logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.db = database;
    this.logger = logger.child('TransactionRepository');
  }

  public async saveTransaction(
    tx: Transaction,
    blockId: string,
    blockHeight: number
  ): Promise<void> {
    await this.db.query(
      'INSERT INTO transactions (id, block_id, block_height) VALUES ($1, $2, $3)',
      [tx.id, blockId, blockHeight]
    );

  
    for (let i = 0; i < tx.outputs.length; i++) {
      const output = tx.outputs[i];
      await this.db.query(
        `INSERT INTO utxos 
         (tx_id, output_index, address, value, spent, block_height) 
         VALUES ($1, $2, $3, $4, FALSE, $5)`,
        [tx.id, i, output.address, output.value, blockHeight]
      );
    }

    
    for (const input of tx.inputs) {
      await this.db.query(
        `UPDATE utxos 
         SET spent = TRUE, spent_in_tx = $1 
         WHERE tx_id = $2 AND output_index = $3`,
        [tx.id, input.txId, input.index]
      );
    }
  }

  public async getUtxo(txId: string, index: number): Promise<{ address: string; value: number } | null> {
    const result = await this.db.query(
      `SELECT address, value 
       FROM utxos 
       WHERE tx_id = $1 AND output_index = $2 AND spent = FALSE`,
      [txId, index]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      address: result.rows[0].address,
      value: parseFloat(result.rows[0].value)
    };
  }

  public async getBalance(address: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(SUM(value), 0) as balance 
       FROM utxos 
       WHERE address = $1 AND spent = FALSE`,
      [address]
    );

    return parseFloat(result.rows[0].balance);
  }

  public async getTransactionsByBlock(blockId: string): Promise<Transaction[]> {
    const result = await this.db.query(
      `SELECT t.id, t.block_id, t.block_height,
              json_agg(
                json_build_object(
                  'txId', i.tx_id,
                  'index', i.output_index
                )
              ) as inputs,
              json_agg(
                json_build_object(
                  'address', o.address,
                  'value', o.value
                )
              ) as outputs
       FROM transactions t
       LEFT JOIN utxos i ON i.spent_in_tx = t.id
       LEFT JOIN utxos o ON o.tx_id = t.id AND o.spent_in_tx IS NULL
       WHERE t.block_id = $1
       GROUP BY t.id, t.block_id, t.block_height`,
      [blockId]
    );

    return result.rows.map(row => ({
      id: row.id,
      inputs: row.inputs[0] ? row.inputs : [],
      outputs: row.outputs[0] ? row.outputs : []
    }));
  }
}

export default TransactionRepository;
