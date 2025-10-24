import { expect, test, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { createHash } from 'crypto';
import type { Block } from '../src/types';

const BASE_URL = 'http://localhost:3000';


function calculateBlockHash(height: number, txIds: string[]): string {
  const data = height + txIds.join('');
  return createHash('sha256').update(data).digest('hex');
}


function createBlock(height: number, transactions: any[]): Block {
  const txIds = transactions.map(tx => tx.id);
  const id = calculateBlockHash(height, txIds);
  return { id, height, transactions };
}


async function resetDatabase() {
 
  try {
    await fetch(`${BASE_URL}/rollback?height=0`, { method: 'POST' });
  } catch (e) {
  
  }
}

describe('Blockchain Indexer API', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /blocks', () => {
    test('should accept the first block with height 1', async () => {
      const block = createBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 10 }]
      }]);

      const response = await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test('should reject block with invalid height', async () => {
      const block = createBlock(2, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 10 }]
      }]);

      const response = await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid height');
    });

    test('should reject block with invalid hash', async () => {
      const block = {
        id: 'invalid-hash',
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 10 }]
        }]
      };

      const response = await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid block id');
    });

    test('should reject transaction with mismatched input/output sums', async () => {
    
      const block1 = createBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 10 }]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      const block2 = createBlock(2, [{
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [{ address: 'addr2', value: 15 }]
      }]);

      const response = await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('does not equal');
    });

    test('should reject transaction spending non-existent UTXO', async () => {
      const block = createBlock(1, [{
        id: 'tx1',
        inputs: [{ txId: 'nonexistent', index: 0 }],
        outputs: [{ address: 'addr1', value: 10 }]
      }]);

      const response = await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('UTXO not found');
    });

    test('should process multiple transactions in a block', async () => {
      const block = createBlock(1, [
        {
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 10 }]
        },
        {
          id: 'tx2',
          inputs: [],
          outputs: [{ address: 'addr2', value: 20 }]
        }
      ]);

      const response = await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /balance/:address', () => {
    test('should return 0 for address with no transactions', async () => {
      const response = await fetch(`${BASE_URL}/balance/unknown-addr`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.balance).toBe(0);
    });

    test('should return correct balance after receiving funds', async () => {
      const block = createBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 10 }]
      }]);

      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      const response = await fetch(`${BASE_URL}/balance/addr1`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.balance).toBe(10);
    });

    test('should return correct balance after spending funds', async () => {
      
      const block1 = createBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 10 }]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      
      const block2 = createBlock(2, [{
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [
          { address: 'addr2', value: 4 },
          { address: 'addr3', value: 6 }
        ]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

      const response1 = await fetch(`${BASE_URL}/balance/addr1`);
      const data1 = await response1.json();
      expect(data1.balance).toBe(0);

      const response2 = await fetch(`${BASE_URL}/balance/addr2`);
      const data2 = await response2.json();
      expect(data2.balance).toBe(4);

      const response3 = await fetch(`${BASE_URL}/balance/addr3`);
      const data3 = await response3.json();
      expect(data3.balance).toBe(6);
    });

    test('should handle multiple UTXOs for same address', async () => {
      const block = createBlock(1, [
        {
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 10 }]
        },
        {
          id: 'tx2',
          inputs: [],
          outputs: [{ address: 'addr1', value: 5 }]
        }
      ]);

      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      const response = await fetch(`${BASE_URL}/balance/addr1`);
      const data = await response.json();
      expect(data.balance).toBe(15);
    });
  });

  describe('POST /rollback', () => {
    test('should rollback to specified height', async () => {
  
      const block1 = createBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 10 }]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      const block2 = createBlock(2, [{
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [
          { address: 'addr2', value: 4 },
          { address: 'addr3', value: 6 }
        ]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

      const block3 = createBlock(3, [{
        id: 'tx3',
        inputs: [{ txId: 'tx2', index: 1 }],
        outputs: [
          { address: 'addr4', value: 2 },
          { address: 'addr5', value: 2 },
          { address: 'addr6', value: 2 }
        ]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block3)
      });

      
      const rollbackResponse = await fetch(`${BASE_URL}/rollback?height=2`, {
        method: 'POST'
      });
      expect(rollbackResponse.status).toBe(200);

  
      const balance1 = await fetch(`${BASE_URL}/balance/addr1`);
      const data1 = await balance1.json();
      expect(data1.balance).toBe(0);

      const balance2 = await fetch(`${BASE_URL}/balance/addr2`);
      const data2 = await balance2.json();
      expect(data2.balance).toBe(4);

      const balance3 = await fetch(`${BASE_URL}/balance/addr3`);
      const data3 = await balance3.json();
      expect(data3.balance).toBe(6);

     
      const balance4 = await fetch(`${BASE_URL}/balance/addr4`);
      const data4 = await balance4.json();
      expect(data4.balance).toBe(0);
    });

    test('should allow adding new block after rollback', async () => {
    
      const block1 = createBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 10 }]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      const block2 = createBlock(2, [{
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [{ address: 'addr2', value: 10 }]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

     
      await fetch(`${BASE_URL}/rollback?height=1`, { method: 'POST' });

     
      const newBlock2 = createBlock(2, [{
        id: 'tx3',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [{ address: 'addr3', value: 10 }]
      }]);
      const response = await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBlock2)
      });

      expect(response.status).toBe(200);

     
      const balance2 = await fetch(`${BASE_URL}/balance/addr2`);
      const data2 = await balance2.json();
      expect(data2.balance).toBe(0);

      const balance3 = await fetch(`${BASE_URL}/balance/addr3`);
      const data3 = await balance3.json();
      expect(data3.balance).toBe(10);
    });

    test('should reject rollback to invalid height', async () => {
      const response = await fetch(`${BASE_URL}/rollback?height=abc`, {
        method: 'POST'
      });
      expect(response.status).toBe(400);
    });

    test('should handle rollback to height 0', async () => {
      const block = createBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 10 }]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      const response = await fetch(`${BASE_URL}/rollback?height=0`, {
        method: 'POST'
      });
      expect(response.status).toBe(200);

   
      const balance = await fetch(`${BASE_URL}/balance/addr1`);
      const data = await balance.json();
      expect(data.balance).toBe(0);
    });
  });

  describe('Complex scenarios', () => {
    test('should handle the example from README', async () => {
     
      const block1 = createBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 10 }]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      let balance = await (await fetch(`${BASE_URL}/balance/addr1`)).json();
      expect(balance.balance).toBe(10);

     
      const block2 = createBlock(2, [{
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [
          { address: 'addr2', value: 4 },
          { address: 'addr3', value: 6 }
        ]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

      balance = await (await fetch(`${BASE_URL}/balance/addr1`)).json();
      expect(balance.balance).toBe(0);
      balance = await (await fetch(`${BASE_URL}/balance/addr2`)).json();
      expect(balance.balance).toBe(4);
      balance = await (await fetch(`${BASE_URL}/balance/addr3`)).json();
      expect(balance.balance).toBe(6);

      
      const block3 = createBlock(3, [{
        id: 'tx3',
        inputs: [{ txId: 'tx2', index: 1 }],
        outputs: [
          { address: 'addr4', value: 2 },
          { address: 'addr5', value: 2 },
          { address: 'addr6', value: 2 }
        ]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block3)
      });

      balance = await (await fetch(`${BASE_URL}/balance/addr1`)).json();
      expect(balance.balance).toBe(0);
      balance = await (await fetch(`${BASE_URL}/balance/addr2`)).json();
      expect(balance.balance).toBe(4);
      balance = await (await fetch(`${BASE_URL}/balance/addr3`)).json();
      expect(balance.balance).toBe(0);
      balance = await (await fetch(`${BASE_URL}/balance/addr4`)).json();
      expect(balance.balance).toBe(2);
      balance = await (await fetch(`${BASE_URL}/balance/addr5`)).json();
      expect(balance.balance).toBe(2);
      balance = await (await fetch(`${BASE_URL}/balance/addr6`)).json();
      expect(balance.balance).toBe(2);

      
      await fetch(`${BASE_URL}/rollback?height=2`, { method: 'POST' });

      balance = await (await fetch(`${BASE_URL}/balance/addr1`)).json();
      expect(balance.balance).toBe(0);
      balance = await (await fetch(`${BASE_URL}/balance/addr2`)).json();
      expect(balance.balance).toBe(4);
      balance = await (await fetch(`${BASE_URL}/balance/addr3`)).json();
      expect(balance.balance).toBe(6);
      balance = await (await fetch(`${BASE_URL}/balance/addr4`)).json();
      expect(balance.balance).toBe(0);
    });

    test('should prevent double spending', async () => {
     
      const block1 = createBlock(1, [{
        id: 'tx1',
        inputs: [],
        outputs: [{ address: 'addr1', value: 10 }]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      
      const block2 = createBlock(2, [{
        id: 'tx2',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [{ address: 'addr2', value: 10 }]
      }]);
      await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

     
      const block3 = createBlock(3, [{
        id: 'tx3',
        inputs: [{ txId: 'tx1', index: 0 }],
        outputs: [{ address: 'addr3', value: 10 }]
      }]);
      const response = await fetch(`${BASE_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block3)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('UTXO not found or already spent');
    });
  });
});