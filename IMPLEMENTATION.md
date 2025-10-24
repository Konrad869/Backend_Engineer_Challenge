# Implementation Summary

## Overview
This is a complete blockchain indexer implementation that tracks UTXO (Unspent Transaction Output) balances for addresses. The system validates blocks, processes transactions, and supports rollback functionality.

## Architecture

### Database Schema
The implementation uses PostgreSQL with three main tables:

1. **blocks** - Stores block metadata
   - `id` (TEXT, PRIMARY KEY): Block hash
   - `height` (INTEGER, UNIQUE): Block height

2. **transactions** - Stores transaction metadata
   - `id` (TEXT, PRIMARY KEY): Transaction ID
   - `block_id` (TEXT): Reference to parent block
   - `block_height` (INTEGER): Height of the block containing this transaction

3. **utxos** - Stores all transaction outputs (spent and unspent)
   - `tx_id` (TEXT): Transaction ID
   - `output_index` (INTEGER): Index of output in transaction
   - `address` (TEXT): Recipient address
   - `value` (NUMERIC): Amount
   - `spent` (BOOLEAN): Whether this UTXO has been spent
   - `spent_in_tx` (TEXT): Transaction ID that spent this UTXO
   - `block_height` (INTEGER): Height of block that created this UTXO

### API Endpoints

#### POST /blocks
Accepts a new block and validates:
- **Height validation**: Must be exactly current_height + 1
- **Block ID validation**: Must match SHA256(height + tx1.id + tx2.id + ...)
- **Input/Output sum validation**: For each transaction, sum(inputs) must equal sum(outputs)
- **UTXO existence**: All referenced inputs must exist and be unspent

#### GET /balance/:address
Returns the current balance for an address by summing all unspent UTXOs.

#### POST /rollback?height=number
Rolls back the blockchain to a specified height by:
1. Unspending UTXOs that were spent in rolled-back transactions
2. Deleting UTXOs created in rolled-back blocks
3. Deleting transactions and blocks above the target height

## Key Features

### UTXO Model
- Each transaction output creates a new UTXO
- Each transaction input spends an existing UTXO
- Balance = sum of unspent UTXOs for an address

### Transaction Atomicity
All database operations use PostgreSQL transactions to ensure consistency.

### Validations
- Block height must increment by exactly 1
- Block hash must be correct SHA256
- Transaction inputs must equal outputs (except genesis transactions)
- Cannot spend non-existent or already-spent UTXOs
- Prevents double-spending

### Rollback Support
Efficiently rolls back blockchain state by:
- Restoring spent UTXOs
- Removing UTXOs created after rollback point
- Cleaning up transactions and blocks

## Testing

The test suite covers:
- ✅ Valid block acceptance
- ✅ Invalid height rejection
- ✅ Invalid block hash rejection
- ✅ Input/output sum mismatch rejection
- ✅ Non-existent UTXO rejection
- ✅ Balance queries (zero balance, after receiving, after spending)
- ✅ Multiple UTXOs per address
- ✅ Rollback functionality
- ✅ Post-rollback block addition
- ✅ Complete README example scenario
- ✅ Double-spending prevention

## Running the Application

### Using Docker (Recommended)
```bash
docker-compose up -d --build
```

### Using Bun
```bash
bun install
bun start
```

### Running Tests
```bash
# Make sure the server is running first
docker-compose up -d --build

# Run tests
bun test
```

## Example Usage

### Add Genesis Block
```bash
curl -X POST http://localhost:3000/blocks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "calculated-hash",
    "height": 1,
    "transactions": [{
      "id": "tx1",
      "inputs": [],
      "outputs": [{"address": "addr1", "value": 10}]
    }]
  }'
```

### Check Balance
```bash
curl http://localhost:3000/balance/addr1
# Returns: {"balance": 10}
```

### Rollback
```bash
curl -X POST http://localhost:3000/rollback?height=0
```

## Technical Decisions

1. **UTXO Table Design**: Instead of maintaining a separate balance table, balances are calculated on-demand from UTXOs. This ensures consistency and simplifies rollback logic.

2. **Spent Flag**: UTXOs are marked as spent rather than deleted, which allows for efficient rollback.

3. **Database Indexes**: Added indexes on `address`, `spent`, and `block_height` for query performance.

4. **Transaction Safety**: All operations use database transactions with proper rollback on errors.

5. **Type Safety**: TypeScript types ensure compile-time safety for block and transaction structures.
