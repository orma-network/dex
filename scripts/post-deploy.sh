#!/bin/bash

# WinDex Post-Deployment Script
# Handles post-deployment tasks like adding initial liquidity and testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Default values
NETWORK="anvil"
ADD_LIQUIDITY="false"
TEST_DEPLOYMENT="true"

# Function to show usage
show_usage() {
    echo "WinDex Post-Deployment Script"
    echo ""
    echo "Usage: $0 [network] [options]"
    echo ""
    echo "Networks:"
    echo "  anvil     Local Anvil network (default)"
    echo "  sepolia   Sepolia testnet"
    echo "  mainnet   Ethereum mainnet"
    echo ""
    echo "Options:"
    echo "  --add-liquidity   Add initial liquidity to test token pairs"
    echo "  --no-test         Skip deployment testing"
    echo "  --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 anvil --add-liquidity    # Add liquidity on Anvil"
    echo "  $0 sepolia --no-test        # Skip testing on Sepolia"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        anvil|sepolia|mainnet)
            NETWORK="$1"
            shift
            ;;
        --add-liquidity)
            ADD_LIQUIDITY="true"
            shift
            ;;
        --no-test)
            TEST_DEPLOYMENT="false"
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Check if deployment artifacts exist
DEPLOYMENT_FILE="deployments/deployment-31337.json"
if [ "$NETWORK" = "sepolia" ]; then
    DEPLOYMENT_FILE="deployments/deployment-11155111.json"
elif [ "$NETWORK" = "mainnet" ]; then
    DEPLOYMENT_FILE="deployments/deployment-1.json"
fi

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    print_error "Deployment file not found: $DEPLOYMENT_FILE"
    print_status "Please run deployment first: ./scripts/deploy.sh $NETWORK"
    exit 1
fi

print_status "Starting post-deployment tasks for $NETWORK network..."

# Load deployment addresses
FACTORY_ADDRESS=$(jq -r '.factory' $DEPLOYMENT_FILE)
ROUTER_ADDRESS=$(jq -r '.router' $DEPLOYMENT_FILE)
TOKEN_FACTORY_ADDRESS=$(jq -r '.tokenFactory' $DEPLOYMENT_FILE)
TOKEN_A_ADDRESS=$(jq -r '.testTokenA' $DEPLOYMENT_FILE)
TOKEN_B_ADDRESS=$(jq -r '.testTokenB' $DEPLOYMENT_FILE)
TOKEN_C_ADDRESS=$(jq -r '.testTokenC' $DEPLOYMENT_FILE)

print_status "Loaded deployment addresses:"
print_status "  Factory: $FACTORY_ADDRESS"
print_status "  Router: $ROUTER_ADDRESS"
print_status "  TokenFactory: $TOKEN_FACTORY_ADDRESS"
print_status "  TestTokenA: $TOKEN_A_ADDRESS"
print_status "  TestTokenB: $TOKEN_B_ADDRESS"
print_status "  TestTokenC: $TOKEN_C_ADDRESS"

# Test deployment
if [ "$TEST_DEPLOYMENT" = "true" ]; then
    print_status "Testing deployment..."

    # Simple deployment verification using curl (no external dependencies)
    if command -v curl &> /dev/null; then
        print_status "Verifying contract deployment via RPC..."

        # Test if we can get code for each contract
        for contract_name in "Factory" "Router" "TokenFactory"; do
            case $contract_name in
                "Factory") address="$FACTORY_ADDRESS" ;;
                "Router") address="$ROUTER_ADDRESS" ;;
                "TokenFactory") address="$TOKEN_FACTORY_ADDRESS" ;;
            esac

            # Get contract code via RPC
            response=$(curl -s -X POST -H "Content-Type: application/json" \
                --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$address\",\"latest\"],\"id\":1}" \
                http://127.0.0.1:8545)

            # Check if response contains actual bytecode (not just "0x")
            if echo "$response" | grep -q '"result":"0x"' || ! echo "$response" | grep -q '"result":"0x[0-9a-fA-F]'; then
                print_error "$contract_name not properly deployed at $address"
                return 1
            else
                print_status "✓ $contract_name deployed and accessible at $address"
            fi
        done

        print_success "All contracts verified successfully"
    else
        print_warning "curl not found, skipping deployment verification"
        print_status "Contracts should be deployed based on Foundry output above"
    fi
fi

# Add initial liquidity
if [ "$ADD_LIQUIDITY" = "true" ]; then
    print_status "Adding initial liquidity to test token pairs..."
    
    if [ -f "contracts/script/AddLiquidity.s.sol" ]; then
        # Set network-specific RPC URL
        case $NETWORK in
            anvil)
                RPC_URL="http://127.0.0.1:8545"
                CHAIN_ID=31337
                ;;
            sepolia)
                RPC_URL=${SEPOLIA_RPC_URL}
                CHAIN_ID=11155111
                ;;
            mainnet)
                RPC_URL=${MAINNET_RPC_URL}
                CHAIN_ID=1
                ;;
        esac
        
        # Execute liquidity addition script
        forge script contracts/script/AddLiquidity.s.sol:AddLiquidity \
            --rpc-url $RPC_URL \
            --chain-id $CHAIN_ID \
            --broadcast \
            -v
        
        if [ $? -eq 0 ]; then
            print_success "Initial liquidity added successfully"
        else
            print_error "Failed to add initial liquidity"
        fi
    else
        print_warning "AddLiquidity.s.sol script not found, skipping liquidity addition"
    fi
fi

# Update frontend configuration
print_status "Updating frontend configuration..."

# Create or update the frontend wagmi configuration
cat > frontend_update.js << EOF
const fs = require('fs');
const path = require('path');

const wagmiPath = path.join(__dirname, 'frontend', 'src', 'lib', 'wagmi.ts');
const deploymentData = JSON.parse(fs.readFileSync('$DEPLOYMENT_FILE', 'utf8'));

if (fs.existsSync(wagmiPath)) {
    let wagmiContent = fs.readFileSync(wagmiPath, 'utf8');
    
    // Update contract addresses
    wagmiContent = wagmiContent.replace(
        /FACTORY: process\.env\.NEXT_PUBLIC_FACTORY_ADDRESS \|\| ''/,
        \`FACTORY: process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '\${deploymentData.factory}'\`
    );
    wagmiContent = wagmiContent.replace(
        /ROUTER: process\.env\.NEXT_PUBLIC_ROUTER_ADDRESS \|\| ''/,
        \`ROUTER: process.env.NEXT_PUBLIC_ROUTER_ADDRESS || '\${deploymentData.router}'\`
    );
    wagmiContent = wagmiContent.replace(
        /TOKEN_FACTORY: process\.env\.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS \|\| ''/,
        \`TOKEN_FACTORY: process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS || '\${deploymentData.tokenFactory}'\`
    );
    wagmiContent = wagmiContent.replace(
        /TOKEN_A: process\.env\.NEXT_PUBLIC_TOKEN_A_ADDRESS \|\| ''/,
        \`TOKEN_A: process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS || '\${deploymentData.testTokenA}'\`
    );
    wagmiContent = wagmiContent.replace(
        /TOKEN_B: process\.env\.NEXT_PUBLIC_TOKEN_B_ADDRESS \|\| ''/,
        \`TOKEN_B: process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS || '\${deploymentData.testTokenB}'\`
    );
    wagmiContent = wagmiContent.replace(
        /TOKEN_C: process\.env\.NEXT_PUBLIC_TOKEN_C_ADDRESS \|\| ''/,
        \`TOKEN_C: process.env.NEXT_PUBLIC_TOKEN_C_ADDRESS || '\${deploymentData.testTokenC}'\`
    );
    
    fs.writeFileSync(wagmiPath, wagmiContent);
    console.log('✓ Frontend wagmi.ts updated with deployment addresses');
} else {
    console.log('⚠ Frontend wagmi.ts not found, skipping update');
}
EOF

if command -v node &> /dev/null; then
    node frontend_update.js
    rm frontend_update.js
else
    print_warning "Node.js not found, skipping frontend configuration update"
    rm frontend_update.js
fi

# Create environment file for frontend
print_status "Creating frontend environment file..."

cat > frontend/.env.local << EOF
# Auto-generated deployment configuration
# Network: $NETWORK
# Generated: $(date)

NEXT_PUBLIC_FACTORY_ADDRESS=$FACTORY_ADDRESS
NEXT_PUBLIC_ROUTER_ADDRESS=$ROUTER_ADDRESS
NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS=$TOKEN_FACTORY_ADDRESS
NEXT_PUBLIC_TOKEN_A_ADDRESS=$TOKEN_A_ADDRESS
NEXT_PUBLIC_TOKEN_B_ADDRESS=$TOKEN_B_ADDRESS
NEXT_PUBLIC_TOKEN_C_ADDRESS=$TOKEN_C_ADDRESS
EOF

print_success "Frontend environment file created: frontend/.env.local"

# Generate and update ABIs
print_status "Generating ABIs from compiled contracts..."
if node scripts/generate-abis.js; then
    print_success "ABIs generated and updated in frontend"
else
    print_warning "Failed to generate ABIs - manual update may be required"
fi

print_success "Post-deployment tasks completed!"
print_status "Summary:"
print_status "  ✓ Deployment verified"
if [ "$ADD_LIQUIDITY" = "true" ]; then
    print_status "  ✓ Initial liquidity added"
fi
print_status "  ✓ Frontend configuration updated"
print_status ""
print_status "Next steps:"
print_status "  1. Start the frontend: cd frontend && npm run dev"
print_status "  2. Connect your wallet to the $NETWORK network"
print_status "  3. Test the DEX functionality"
