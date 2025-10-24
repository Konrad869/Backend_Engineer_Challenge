import Fastify from 'fastify';
import { Pool } from 'pg';
import { createHash } from 'crypto';
import type { Block, Transaction, Input, Output } from './types';

const fastify = Fastify({ logger: true });
let pool: Pool;


async function createTables(pool: Pool) {
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      height INTEGER UNIQUE NOT NULL
    );
  `);

  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
      block_height INTEGER NOT NULL
    );
  `);

  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utxos (
      tx_id TEXT NOT NULL,
      output_index INTEGER NOT NULL,
      address TEXT NOT NULL,
      value NUMERIC NOT NULL,
      spent BOOLEAN DEFAULT FALSE,
      spent_in_tx TEXT,
      block_height INTEGER NOT NULL,
      PRIMARY KEY (tx_id, output_index)
    );
  `);

 
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_utxos_address ON utxos(address);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_utxos_spent ON utxos(spent);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height);
  `);
}


function calculateBlockHash(height: number, transactions: Transaction[]): string {
  const data = height + transactions.map(tx => tx.id).join('');
  return createHash('sha256').update(data).digest('hex');
}


async function getCurrentHeight(): Promise<number> {
  const result = await pool.query('SELECT MAX(height) as height FROM blocks');
  return result.rows[0].height || 0;
}


async function getUtxoValue(txId: string, index: number): Promise<{ address: string; value: number } | null> {
  const result = await pool.query(
    'SELECT address, value FROM utxos WHERE tx_id = $1 AND output_index = $2 AND spent = FALSE',
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


fastify.post<{ Body: Block }>('/blocks', async (request, reply) => {
  const block = request.body;

  try {

    const currentHeight = await getCurrentHeight();
    if (block.height !== currentHeight + 1) {
      return reply.status(400).send({
        error: `Invalid height. Expected ${currentHeight + 1}, got ${block.height}`
      });
    }

   
    const expectedId = calculateBlockHash(block.height, block.transactions);
    if (block.id !== expectedId) {
      return reply.status(400).send({
        error: `Invalid block id. Expected ${expectedId}, got ${block.id}`
      });
    }

    
    for (const tx of block.transactions) {
      let inputSum = 0;
      let outputSum = 0;

     
      for (const input of tx.inputs) {
        const utxo = await getUtxoValue(input.txId, input.index);
        if (!utxo) {
          return reply.status(400).send({
            error: `UTXO not found or already spent: ${input.txId}:${input.index}`
          });
        }
        inputSum += utxo.value;
      }

      
      for (const output of tx.outputs) {
        outputSum += output.value;
      }

      
      if (tx.inputs.length > 0 && inputSum !== outputSum) {
        return reply.status(400).send({
          error: `Transaction ${tx.id}: input sum (${inputSum}) does not equal output sum (${outputSum})`
        });
      }
    }

    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

     
      await client.query(
        'INSERT INTO blocks (id, height) VALUES ($1, $2)',
        [block.id, block.height]
      );

      
      for (const tx of block.transactions) {
       
        await client.query(
          'INSERT INTO transactions (id, block_id, block_height) VALUES ($1, $2, $3)',
          [tx.id, block.id, block.height]
        );

        
        for (const input of tx.inputs) {
          await client.query(
            'UPDATE utxos SET spent = TRUE, spent_in_tx = $1 WHERE tx_id = $2 AND output_index = $3',
            [tx.id, input.txId, input.index]
          );
        }

       
        for (let i = 0; i < tx.outputs.length; i++) {
          const output = tx.outputs[i];
          await client.query(
            'INSERT INTO utxos (tx_id, output_index, address, value, spent, block_height) VALUES ($1, $2, $3, $4, FALSE, $5)',
            [tx.id, i, output.address, output.value, block.height]
          );
        }
      }

      await client.query('COMMIT');
      return reply.status(200).send({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});


fastify.get<{ Params: { address: string } }>('/balance/:address', async (request, reply) => {
  const { address } = request.params;

  try {
    
    const result = await pool.query(
      'SELECT COALESCE(SUM(value), 0) as balance FROM utxos WHERE address = $1 AND spent = FALSE',
      [address]
    );

    const balance = parseFloat(result.rows[0].balance);
    return reply.status(200).send({ balance });
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});


fastify.post<{ Querystring: { height: string } }>('/rollback', async (request, reply) => {
  const targetHeight = parseInt(request.query.height);

  if (isNaN(targetHeight) || targetHeight < 0) {
    return reply.status(400).send({ error: 'Invalid height parameter' });
  }

  try {
    const currentHeight = await getCurrentHeight();
    
    if (targetHeight > currentHeight) {
      return reply.status(400).send({ 
        error: `Cannot rollback to height ${targetHeight}. Current height is ${currentHeight}` 
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      
      const txsToRollback = await client.query(
        'SELECT id FROM transactions WHERE block_height > $1',
        [targetHeight]
      );

     
      for (const row of txsToRollback.rows) {
        await client.query(
          'UPDATE utxos SET spent = FALSE, spent_in_tx = NULL WHERE spent_in_tx = $1',
          [row.id]
        );
      }

     
      await client.query(
        'DELETE FROM utxos WHERE block_height > $1',
        [targetHeight]
      );

      
      await client.query(
        'DELETE FROM transactions WHERE block_height > $1',
        [targetHeight]
      );

     
      await client.query(
        'DELETE FROM blocks WHERE height > $1',
        [targetHeight]
      );

      await client.query('COMMIT');
      return reply.status(200).send({ success: true, height: targetHeight });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});


fastify.get('/', async (request, reply) => {
  return { status: 'ok', service: 'blockchain-indexer' };
});

async function bootstrap() {
  console.log('Bootstrapping...');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  pool = new Pool({
    connectionString: databaseUrl
  });

  await createTables(pool);
  console.log('Database tables created successfully');
}

try {
  await bootstrap();
  await fastify.listen({
    port: 3000,
    host: '0.0.0.0'
  });
  console.log('Server listening on port 3000');
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

export { fastify, pool };