#!/bin/bash

# WinDex Deployment Script
# Usage: ./scripts/deploy.sh [network] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
NETWORK="anvil"
VERIFY="false"
BROADCAST="true"
VERBOSE="false"

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

# Function to show usage
show_usage() {
    echo "WinDex Smart Contract Deployment Script"
    echo ""
    echo "Usage: $0 [network] [options]"
    echo ""
    echo "Networks:"
    echo "  anvil     Deploy to local Anvil network (default)"
    echo "  sepolia   Deploy to Sepolia testnet"
    echo "  mainnet   Deploy to Ethereum mainnet"
    echo ""
    echo "Options:"
    echo "  --verify      Verify contracts on block explorer"
    echo "  --no-broadcast Simulate deployment without broadcasting"
    echo "  --verbose     Enable verbose output"
    echo "  --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 anvil                    # Deploy to local Anvil"
    echo "  $0 sepolia --verify         # Deploy to Sepolia with verification"
    echo "  $0 mainnet --verify         # Deploy to mainnet with verification"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        anvil|sepolia|mainnet)
            NETWORK="$1"
            shift
            ;;
        --verify)
            VERIFY="true"
            shift
            ;;
        --no-broadcast)
            BROADCAST="false"
            shift
            ;;
        --verbose)
            VERBOSE="true"
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

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found!"
    print_warning "Please copy .env.example to .env and configure your settings"
    exit 1
fi

# Load environment variables
source .env

# Validate required environment variables
if [ -z "$PRIVATE_KEY" ]; then
    print_error "PRIVATE_KEY not set in .env file"
    exit 1
fi

print_status "Starting WinDex deployment to $NETWORK network..."

# Set network-specific RPC URL
case $NETWORK in
    anvil)
        RPC_URL=${ANVIL_RPC_URL:-"http://127.0.0.1:8545"}
        CHAIN_ID=31337
        ;;
    sepolia)
        RPC_URL=${SEPOLIA_RPC_URL}
        CHAIN_ID=11155111
        if [ -z "$RPC_URL" ]; then
            print_error "SEPOLIA_RPC_URL not set in .env file"
            exit 1
        fi
        ;;
    mainnet)
        RPC_URL=${MAINNET_RPC_URL}
        CHAIN_ID=1
        if [ -z "$RPC_URL" ]; then
            print_error "MAINNET_RPC_URL not set in .env file"
            exit 1
        fi
        print_warning "Deploying to MAINNET! This will cost real ETH."
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Deployment cancelled"
            exit 0
        fi
        ;;
esac

# Check if Anvil is running for local deployment
if [ "$NETWORK" = "anvil" ]; then
    if ! curl -s -X POST -H "Content-Type: application/json" \
         --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
         $RPC_URL > /dev/null 2>&1; then
        print_error "Anvil is not running on $RPC_URL"
        print_status "Please start Anvil with: anvil"
        exit 1
    fi
    print_success "Anvil is running"
fi

# Create deployments directory
mkdir -p deployments

# Build contracts
print_status "Building contracts..."
forge build

if [ $? -ne 0 ]; then
    print_error "Contract compilation failed"
    exit 1
fi

print_success "Contracts compiled successfully"

# Prepare forge script command
FORGE_CMD="forge script contracts/script/Deploy.s.sol:Deploy"
FORGE_CMD="$FORGE_CMD --rpc-url $RPC_URL"
FORGE_CMD="$FORGE_CMD --chain-id $CHAIN_ID"

if [ "$BROADCAST" = "true" ]; then
    FORGE_CMD="$FORGE_CMD --broadcast"
fi

if [ "$VERBOSE" = "true" ]; then
    FORGE_CMD="$FORGE_CMD -vvvv"
else
    FORGE_CMD="$FORGE_CMD -v"
fi

# Set network-specific environment variables
export VERIFY_CONTRACTS=$VERIFY

# Execute deployment
print_status "Executing deployment script..."
print_status "Command: $FORGE_CMD"

eval $FORGE_CMD

if [ $? -ne 0 ]; then
    print_error "Deployment failed"
    exit 1
fi

print_success "Deployment completed successfully!"

# Update frontend configuration if deployment was broadcast
if [ "$BROADCAST" = "true" ] && [ -f "frontend-config.ts" ]; then
    print_status "Updating frontend configuration..."
    
    # Copy to frontend directory
    cp frontend-config.ts frontend/src/lib/deployment-config.ts
    
    print_success "Frontend configuration updated"
    print_status "Please update frontend/src/lib/wagmi.ts with the new addresses"
fi

# Contract verification
if [ "$VERIFY" = "true" ] && [ "$BROADCAST" = "true" ]; then
    print_status "Starting contract verification..."
    
    case $NETWORK in
        sepolia)
            if [ -n "$SEPOLIA_ETHERSCAN_API_KEY" ]; then
                print_status "Verifying contracts on Sepolia Etherscan..."
                # Add verification commands here
                print_warning "Contract verification not yet implemented"
            else
                print_warning "SEPOLIA_ETHERSCAN_API_KEY not set, skipping verification"
            fi
            ;;
        mainnet)
            if [ -n "$ETHERSCAN_API_KEY" ]; then
                print_status "Verifying contracts on Etherscan..."
                # Add verification commands here
                print_warning "Contract verification not yet implemented"
            else
                print_warning "ETHERSCAN_API_KEY not set, skipping verification"
            fi
            ;;
        *)
            print_warning "Contract verification not available for $NETWORK"
            ;;
    esac
fi

print_success "All deployment tasks completed!"
print_status "Check the deployments/ directory for deployment artifacts"

if [ "$NETWORK" = "anvil" ]; then
    print_status "You can now start the frontend with: cd frontend && npm run dev"
fi
