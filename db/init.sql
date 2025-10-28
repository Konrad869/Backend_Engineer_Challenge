-- Create blocks table
CREATE TABLE IF NOT EXISTS blocks (
    id VARCHAR(255) PRIMARY KEY,
    height INTEGER NOT NULL UNIQUE
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(255) PRIMARY KEY,
    block_id VARCHAR(255) REFERENCES blocks(id),
    block_height INTEGER NOT NULL
);

-- Create UTXOs table
CREATE TABLE IF NOT EXISTS utxos (
    tx_id VARCHAR(255) NOT NULL,
    output_index INTEGER NOT NULL,
    address VARCHAR(255) NOT NULL,
    value BIGINT NOT NULL,
    spent BOOLEAN DEFAULT FALSE,
    spent_in_tx VARCHAR(255),
    block_height INTEGER NOT NULL,
    PRIMARY KEY (tx_id, output_index)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_utxos_address ON utxos(address) WHERE NOT spent;
CREATE INDEX IF NOT EXISTS idx_utxos_spent ON utxos(spent);
CREATE INDEX IF NOT EXISTS idx_utxos_spent_in_tx ON utxos(spent_in_tx);
CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height);
