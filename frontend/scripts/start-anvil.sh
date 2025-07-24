#!/bin/bash

# Start Anvil with deterministic accounts
echo "Starting Anvil local testnet..."

anvil \
  --host 0.0.0.0 \
  --port 8545 \
  --chain-id 31337 \
  --accounts 10 \
  --balance 10000 \
  --mnemonic "test test test test test test test test test test test junk" \
  --block-time 2 \
  --gas-limit 30000000 \
  --gas-price 1000000000
