# Blockchain Indexer API

A high-performance blockchain indexer that tracks address balances using the UTXO model, built with TypeScript, Bun, and PostgreSQL.

## 🚀 Features

- **UTXO-based balance tracking** - Accurately tracks balances using the Unspent Transaction Output model
- **RESTful API** - Clean and intuitive endpoints for interacting with the blockchain
- **Transaction Validation** - Comprehensive validation of blockchain rules
- **Rollback Support** - Rollback to any previous block height
- **Docker Support** - Easy setup and deployment with Docker Compose

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Database**: PostgreSQL
- **API**: Fastify
- **Containerization**: Docker
- **Testing**: Bun Test
- **Language**: TypeScript

## 🏗️ Project Structure

```
.
├── src/
│   ├── db/             # Database models and migrations
│   ├── routes/         # API route handlers
│   ├── services/       # Business logic
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Helper functions
├── spec/               # Test files
├── docker/             # Docker configuration
└── docker-compose.yml  # Docker Compose configuration
```

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- (Optional) Bun (if not using Docker)

### 🔄 Environment Cleanup (Important!)

Before the first run or if you encounter any issues, it's recommended to clean up the Docker environment:

```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Remove all unused containers, networks, and images
docker system prune -a -f

# Remove all unused volumes
docker volume prune -f

# Remove all unused networks
docker network prune -f
```

### 🛠️ Installation & Running with Docker (Recommended)

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd backend-engineer-test-main
   ```

2. **Start the application**:
   ```bash
   # Build and start containers in detached mode
   docker-compose up -d --build
   ```

3. **Verify the services are running**:
   ```bash
   # Check container status
   docker-compose ps
   
   # View logs
   docker-compose logs -f
   ```

4. **Verify database initialization**:
   ```bash
   # Check if tables were created
   docker-compose exec db psql -U myuser -d mydatabase -c "\dt"
   ```

### 🧪 Testing

1. **Run all tests**:
   ```bash
   docker-compose exec api bun test
   ```

2. **Run specific test file**:
   ```bash
   docker-compose exec api bun test spec/unit/blockchain.service.spec.ts
   ```

3. **Run with coverage**:
   ```bash
   docker-compose exec api bun test --coverage
   ```

### 🧩 Example API Requests

1. **Check API status**:
   ```bash
   curl http://localhost:3000
   # Should return: {"status":"ok","service":"blockchain-indexer"}
   ```

2. **Add a genesis block**:
   ```bash
   curl -X POST http://localhost:3000/blocks \
     -H "Content-Type: application/json" \
     -d '{
       "id": "genesis-block",
       "height": 1,
       "transactions": [{
         "id": "tx1",
         "inputs": [],
         "outputs": [{"address": "addr1", "value": 100}]
       }]
     }'
   ```

3. **Check balance**:
   ```bash
   curl http://localhost:3000/balance/addr1
   # Should return: {"balance": 100}
   ```

4. **Rollback to a specific height**:
   ```bash
   curl -X POST "http://localhost:3000/rollback?height=0"
   ```

### Running Locally

1. Install dependencies:
   ```bash
   bun install
   ```

2. Set up environment variables (copy from .env.example):
   ```bash
   cp .env.example .env
   ```

3. Start the application:
   ```bash
   bun start
   ```

4. Run tests:
   ```bash
   bun test
   ```

## 📚 API Documentation

### `POST /blocks`

Add a new block to the blockchain.

**Request Body**:
```json
{
  "id": "block-hash",
  "height": 1,
  "transactions": [
    {
      "id": "tx1",
      "inputs": [],
      "outputs": [
        {
          "address": "addr1",
          "value": 10
        }
      ]
    }
  ]
}
```

### `GET /balance/:address`

Get the current balance of an address.

**Response**:
```json
{
  "balance": 10
}
```

### `POST /rollback?height=:height`

Rollback the blockchain to a specific height.

## 🧪 Testing

The project includes a comprehensive test suite written with Bun's built-in test runner. The tests are organized in the `spec/` directory and cover various aspects of the application.

### Test Structure

```
spec/
├── unit/                  # Unit tests
│   ├── blockchain.service.spec.ts  # Tests for blockchain service
│   ├── block.repository.spec.ts    # Tests for block repository
│   ├── logger.spec.ts              # Tests for logging functionality
│   └── ...
└── index.spec.ts          # Integration/API tests
```

### Unit Tests

#### Blockchain Service Tests
Tests for the core blockchain logic including:
- Block validation and processing
- Transaction verification
- UTXO management
- Balance calculations
- Rollback functionality

Example test case:
```typescript
test('should process valid block with transactions', async () => {
  const block = createMockBlock(1, [mockTransaction]);
  await service.processBlock(block);
  const balance = await service.getBalance('addr1');
  expect(balance).toBe(100);
});
```

#### Repository Tests
- Database operations
- Data consistency
- Error handling

#### Logger Tests
- Log level filtering
- Context propagation
- Error handling

### Integration Tests

Full API endpoint tests that verify:
- HTTP status codes
- Response formats
- Data validation
- Error handling

### Running Tests

Run all tests:
```bash
bun test
```

Run specific test file:
```bash
bun test spec/unit/blockchain.service.spec.ts
```

Run with coverage:
```bash
bun test --coverage
```

### Test Coverage

The test suite aims to maintain high test coverage, particularly for:
- Core blockchain logic (100%)
- API endpoints (100%)
- Database operations (100%)
- Error handling paths (100%)

## 📊 Database Schema

### Tables
- `blocks` - Stores block information
- `transactions` - Tracks all transactions
- `utxos` - Tracks unspent transaction outputs
- `address_balances` - Cached balances for fast lookups

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

# EMURGO Backend Engineer Challenge

*Original challenge instructions below:*

This challenge is designed to evaluate your skills with data processing and API development. You will be responsible for creating an indexer that will keep track of the balance of each address in a blockchain.

Please read all instructions bellow carefully.

## Instructions
Fork this repository and make the necessary changes to complete the challenge. Once you are done, simply send your repository link to us and we will review it.

## Setup
This coding challenge uses [Bun](https://bun.sh/) as its runtime. If you are unfamiliar with it, you can follow the instructions on the official website to install it - it works pretty much the same as NodeJS, but has a ton of features that make our life easier, like a built-in test engine and TypeScript compiler.

Strictly speaking, because we run this project on Docker, you don't even need to have Bun installed on your machine. You can run the project using the `docker-compose` command, as described below.

The setup for this coding challenge is quite simple. You need to have `docker` and `docker-compose` installed on your machine. If you don't have them installed, you can follow the instructions on the official docker website to install them.

https://docs.docker.com/engine/install/
https://docs.docker.com/compose/install/

Once you have `docker` and `docker-compose` installed, you can run the following command to start the application:

```bash
docker-compose up -d --build
```

or using `Bun`

```bash
bun run-docker
```

## The Challenge
Your job is to create an indexer that will keep track of the current balance for each address. To do that, you will need to implement the following endpoints:

### `POST /blocks`
This endpoint will receive a JSON object that should match the `Block` type from the following schema:

```ts
Output = {
  address: string;
  value: number;
}

Input = {
  txId: string;
  index: number;
}

Transaction = {
  id: string;
  inputs: Array<Input>
  outputs: Array<Output>
}

Block = {
  id: string;
  height: number;
  transactions: Array<Transaction>;
}
```

Based on the received message you should update the balance of each address accordingly. This endpoint should also run the following validations:
- validate if the `height` is exactly one unit higher than the current height - this also means that the first ever block should have `height = 1`. If it is not, you should return a `400` status code with an appropriate message;
- validate if the sum of the values of the inputs is exactly equal to the sum of the values of the outputs. If it is not, you should return a `400` status code with an appropriate message;
- validate if the `id` of the Block correct. For that, the `id` of the block must be the sha256 hash of the sum of its transaction's ids together with its own height. In other words: `sha256(height + transaction1.id + transaction2.id + ... + transactionN.id)`. If it is not, you should return a `400` status code with an appropriate message;

#### Understanding the Schema
If you are familiar with the UTXO model, you will recognize the schema above. If you are not, here is a brief explanation:
- each transaction is composed of inputs and outputs;
- each input is a reference to an output of a previous transaction;
- each output means a given address **received** a certain amount of value;
- from the above, it follows that each input **spends** a certain amount of value from its original address;
- in summary, the balance of an address is the sum of all the values it received minus the sum of all the values it spent;

### `GET /balance/:address`
This endpoint should return the current balance of the given address. Simple as that.

### `POST /rollback?height=number`
This endpoint should rollback the state of the indexer to the given height. This means that you should undo all the transactions that were added after the given height and recalculate the balance of each address. You can assume the `height` will **never** be more than 2000 blocks from the current height.

