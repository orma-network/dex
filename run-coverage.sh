#!/bin/bash

# Load deployment addresses from JSON file and run forge coverage
if [ ! -f "deployments/deployment-31337.json" ]; then
    echo "Error: Deployment file not found. Please run deployment first."
    exit 1
fi

# Export environment variables from deployment file
export FACTORY_ADDRESS=$(jq -r '.factory' deployments/deployment-31337.json)
export ROUTER_ADDRESS=$(jq -r '.router' deployments/deployment-31337.json)
export TOKEN_FACTORY_ADDRESS=$(jq -r '.tokenFactory' deployments/deployment-31337.json)
export TOKEN_A_ADDRESS=$(jq -r '.testTokenA' deployments/deployment-31337.json)
export TOKEN_B_ADDRESS=$(jq -r '.testTokenB' deployments/deployment-31337.json)
export TOKEN_C_ADDRESS=$(jq -r '.testTokenC' deployments/deployment-31337.json)

echo "Running forge coverage with deployment addresses:"
echo "  Factory: $FACTORY_ADDRESS"
echo "  Router: $ROUTER_ADDRESS"
echo "  TokenFactory: $TOKEN_FACTORY_ADDRESS"
echo "  TestTokenA: $TOKEN_A_ADDRESS"
echo "  TestTokenB: $TOKEN_B_ADDRESS"
echo "  TestTokenC: $TOKEN_C_ADDRESS"
echo ""

# Run forge coverage
forge coverage
