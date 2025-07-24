# WinDex Smart Contract Deployment Makefile
# Streamlined commands for development and deployment

.PHONY: help install build test dev stop restart deploy-sepolia deploy-mainnet test-deployment status clean

# Default target
help:
	@echo "WinDex Smart Contract Deployment Commands"
	@echo ""
	@echo "🚀 Primary Commands:"
	@echo "  dev              Complete development setup (recommended)"
	@echo "  stop             Stop development environment"
	@echo "  restart          Clean restart development environment"
	@echo ""
	@echo "Development Commands:"
	@echo "  install          Install dependencies and setup environment"
	@echo "  build            Compile smart contracts"
	@echo "  test             Run contract tests"
	@echo "  test-deployment  Test deployed contracts functionality"
	@echo "  generate-abis    Generate ABIs from compiled contracts"
	@echo "  status           Show deployment status"
	@echo "  clean            Clean build artifacts"
	@echo ""
	@echo "Production Deployment:"
	@echo "  deploy-sepolia   Deploy to Sepolia testnet"
	@echo "  deploy-mainnet   Deploy to Ethereum mainnet"
	@echo ""
	@echo "Examples:"
	@echo "  make dev             # Complete development setup"
	@echo "  make stop            # Stop development environment"
	@echo "  make deploy-sepolia  # Deploy to testnet"

# Installation and setup
install:
	@echo "Installing dependencies..."
	@if ! command -v forge >/dev/null 2>&1; then \
		echo "Installing Foundry..."; \
		curl -L https://foundry.paradigm.xyz | bash; \
		foundryup; \
	fi
	@if [ ! -f .env ]; then \
		echo "Creating .env file from template..."; \
		cp .env.example .env; \
		echo "Please edit .env file with your configuration"; \
	fi
	@echo "Installing Node.js dependencies..."
	@cd frontend && npm install
	@echo "Setup complete!"

# Build contracts
build:
	@echo "Building smart contracts..."
	@cd contracts && forge build
	@echo "Build complete!"

# Run tests
test:
	@echo "Running smart contract tests..."
	@cd contracts && forge test -vv
	@echo "Tests complete!"

# Single-command development setup
dev:
	@echo "🚀 Starting complete WinDex development environment..."
	@./start-and-deploy.sh

# Stop development environment
stop:
	@echo "🛑 Stopping WinDex development environment..."
	@./stop-dev.sh

# Clean restart development environment
restart:
	@echo "🔄 Restarting WinDex development environment..."
	@./stop-dev.sh --clean-all
	@./start-and-deploy.sh

# Note: For local development, use 'make dev' instead of individual commands

# Deploy to Sepolia
deploy-sepolia:
	@echo "Deploying to Sepolia testnet..."
	@./scripts/deploy.sh sepolia --verify
	@echo "Sepolia deployment complete!"

# Deploy to Mainnet
deploy-mainnet:
	@echo "⚠️  WARNING: Deploying to Ethereum mainnet!"
	@echo "This will cost real ETH. Are you sure? (Press Ctrl+C to cancel)"
	@read -p "Type 'YES' to continue: " confirm && [ "$$confirm" = "YES" ]
	@./scripts/deploy.sh mainnet --verify
	@echo "Mainnet deployment complete!"

# Post-deployment setup is now handled automatically by the single-command system

# Test deployment
test-deployment:
	@echo "Testing deployed contracts..."
	@if [ ! -f deployments/deployment-31337.json ]; then \
		echo "No Anvil deployment found. Run 'make deploy-anvil' first."; \
		exit 1; \
	fi
	@export FACTORY_ADDRESS=$$(jq -r '.factory' deployments/deployment-31337.json) && \
	 export ROUTER_ADDRESS=$$(jq -r '.router' deployments/deployment-31337.json) && \
	 export TOKEN_FACTORY_ADDRESS=$$(jq -r '.tokenFactory' deployments/deployment-31337.json) && \
	 export TOKEN_A_ADDRESS=$$(jq -r '.testTokenA' deployments/deployment-31337.json) && \
	 export TOKEN_B_ADDRESS=$$(jq -r '.testTokenB' deployments/deployment-31337.json) && \
	 export TOKEN_C_ADDRESS=$$(jq -r '.testTokenC' deployments/deployment-31337.json) && \
	 cd contracts && forge script script/DeploymentTest.s.sol:DeploymentTest \
		--rpc-url http://127.0.0.1:8545 \
		--broadcast \
		-v
	@echo "Deployment test complete!"

# Verify contracts
verify-contracts:
	@echo "Contract verification not yet implemented"
	@echo "Please verify manually on the block explorer"

# Generate ABIs from compiled contracts
generate-abis:
	@echo "Generating ABIs from compiled contracts..."
	@node scripts/generate-abis.js

# Frontend configuration is now handled automatically

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@cd contracts && forge clean
	@rm -rf deployments/*.json
	@rm -f frontend-config.ts
	@rm -f frontend/.env.local
	@echo "Clean complete!"

# Legacy shortcuts - use 'make dev' instead

# Production deployment checklist
production-checklist:
	@echo "Production Deployment Checklist:"
	@echo ""
	@echo "Pre-deployment:"
	@echo "  [ ] Contracts audited"
	@echo "  [ ] Tests passing"
	@echo "  [ ] Testnet deployment tested"
	@echo "  [ ] Gas prices checked"
	@echo "  [ ] Sufficient ETH in deployer account"
	@echo "  [ ] Private keys secured"
	@echo "  [ ] Etherscan API key configured"
	@echo ""
	@echo "Deployment:"
	@echo "  [ ] Run 'make deploy-mainnet'"
	@echo "  [ ] Verify all contract addresses"
	@echo "  [ ] Verify contracts on Etherscan"
	@echo ""
	@echo "Post-deployment:"
	@echo "  [ ] Test basic functionality"
	@echo "  [ ] Update frontend configuration"
	@echo "  [ ] Monitor for issues"
	@echo "  [ ] Document all addresses"
	@echo ""

# Show deployment status
status:
	@echo "WinDex Deployment Status:"
	@echo ""
	@if [ -f deployments/deployment-31337.json ]; then \
		echo "✓ Anvil deployment found"; \
		echo "  Factory: $$(jq -r '.factory' deployments/deployment-31337.json)"; \
		echo "  Router: $$(jq -r '.router' deployments/deployment-31337.json)"; \
		echo "  TokenFactory: $$(jq -r '.tokenFactory' deployments/deployment-31337.json)"; \
	else \
		echo "✗ No Anvil deployment found"; \
	fi
	@echo ""
	@if [ -f deployments/deployment-11155111.json ]; then \
		echo "✓ Sepolia deployment found"; \
		echo "  Factory: $$(jq -r '.factory' deployments/deployment-11155111.json)"; \
		echo "  Router: $$(jq -r '.router' deployments/deployment-11155111.json)"; \
		echo "  TokenFactory: $$(jq -r '.tokenFactory' deployments/deployment-11155111.json)"; \
	else \
		echo "✗ No Sepolia deployment found"; \
	fi
	@echo ""
	@if [ -f deployments/deployment-1.json ]; then \
		echo "✓ Mainnet deployment found"; \
		echo "  Factory: $$(jq -r '.factory' deployments/deployment-1.json)"; \
		echo "  Router: $$(jq -r '.router' deployments/deployment-1.json)"; \
		echo "  TokenFactory: $$(jq -r '.tokenFactory' deployments/deployment-1.json)"; \
	else \
		echo "✗ No Mainnet deployment found"; \
	fi
