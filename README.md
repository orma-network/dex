# WinDex - Windows 98 Style Decentralized Exchange

A fully functional decentralized exchange (DEX) with an authentic Windows 98 aesthetic, built with modern Web3 technologies and running on Anvil (Foundry's local Ethereum testnet).

## 🎯 Features

### Smart Contracts
- **Factory Contract**: Creates and manages trading pairs
- **Pair Contracts**: Automated Market Maker (AMM) with constant product formula (x * y = k)
- **Router Contract**: Simplified interface for swapping and liquidity management
- **ERC-20 Test Tokens**: Three test tokens (TTA, TTB, TTC) for testing
- **Comprehensive Test Suite**: Full test coverage with Foundry

### Frontend
- **Windows 98 UI**: Authentic retro design with classic buttons, windows, and dialogs
- **Web3 Integration**: Wallet connection using wagmi and viem
- **Token Swapping**: Real-time price quotes and slippage protection
- **Responsive Design**: Maintains retro aesthetic while being functional on modern browsers
- **Desktop Environment**: Complete Windows 98 desktop experience with taskbar and icons

### Technical Stack
- **Smart Contracts**: Solidity ^0.8.19, Foundry
- **Frontend**: Next.js 15, React 19, TypeScript
- **Web3**: wagmi, viem, TanStack Query
- **Styling**: Custom CSS with Windows 98 theme, Tailwind CSS
- **Local Network**: Anvil (Foundry)

## 🚀 Quick Start

### Prerequisites
- **Foundry** (forge, anvil, cast) - [Install here](https://getfoundry.sh)
- **Node.js 18+** and npm/yarn
- **Git**

### Single-Command Setup ⚡

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd simple-dex
   ```

2. **Complete deployment** (one command does everything!)
   ```bash
   ./start-and-deploy.sh
   ```

   This automatically:
   - ✅ Starts Anvil local blockchain
   - ✅ Deploys all smart contracts
   - ✅ Configures frontend with contract addresses
   - ✅ Shows deployment summary with contract addresses

3. **Start the frontend** (in a new terminal)
   ```bash
   cd frontend && npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

5. **Connect your wallet**
   - Add Anvil network to MetaMask:
     - Network: Localhost 8545
     - Chain ID: 31337
   - Import test account:
     ```
     Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
     ```

### Alternative: Makefile Commands
```bash
make dev        # Complete development setup
make stop       # Stop development environment
make restart    # Clean restart
make help       # Show all commands
```

### Test Anvil
```
curl -s http://localhost:8545 -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | jq .result
```

### Stop Development
```bash
./stop-dev.sh   # Stop Anvil and clean up
# OR
make stop
```

## 📁 Project Structure

```
simple-dex/
├── 🚀 start-and-deploy.sh    # Single-command deployment
├── 🛑 stop-dev.sh            # Stop development environment
├── contracts/                # Smart contracts
│   ├── src/                  # Contract source files
│   │   ├── Factory.sol       # Pair factory contract
│   │   ├── Pair.sol          # AMM pair contract
│   │   ├── Router.sol        # Router for easy interactions
│   │   ├── ERC20.sol         # Basic ERC-20 implementation
│   │   └── TestTokens.sol    # Test tokens for demo
│   ├── test/                 # Contract tests
│   └── script/               # Deployment scripts
│       ├── Deploy.s.sol      # Main deployment script
│       └── DeploymentTest.s.sol # Testing script
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/              # Next.js app router
│   │   ├── components/       # React components
│   │   │   ├── ui/           # Windows 98 UI components
│   │   │   ├── dex/          # DEX-specific components
│   │   │   └── wallet/       # Wallet connection components
│   │   ├── lib/              # Utilities and configurations
│   │   └── styles/           # CSS styles
├── scripts/                  # Deployment and utility scripts
└── docs/                     # Documentation
```

## 🎮 Usage Guide

### Connecting Your Wallet

1. Click "Connect Wallet" in the taskbar
2. Choose your preferred wallet (MetaMask, WalletConnect, etc.)
3. Make sure you're connected to the Anvil network (Chain ID: 31337)
4. Add the Anvil network to your wallet:
   - Network Name: Anvil Local
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - Currency Symbol: ETH

### Using the DEX

1. **Token Swapping**:
   - Double-click the WinDex icon on the desktop
   - Select tokens to swap from the dropdown menus
   - Enter the amount you want to swap
   - Review the exchange rate and slippage
   - Click "Swap Tokens" and confirm the transaction

2. **Managing Liquidity** (Coming Soon):
   - Double-click the Liquidity icon
   - Add or remove liquidity from trading pairs
   - Earn fees from trades

3. **Viewing Pool Information** (Coming Soon):
   - Double-click the Pools icon
   - View detailed statistics for all trading pairs
   - Monitor your liquidity positions

## 🧪 Testing

### Smart Contract Tests
```bash
# Run all tests
forge test

# Run tests with verbose output
forge test -vv

# Run specific test
forge test --match-test testSwapExactTokensForTokens
```

## 🔧 Development

### Smart Contract Development
```bash
# Compile contracts
forge build

# Run tests
forge test

# Deploy to local network
forge script contracts/script/Deploy.s.sol:DeployScript --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Frontend Development
```bash
cd frontend

# Start development server
yarn dev

# Build for production
yarn build

# Run linting
yarn lint
```

## 📋 Contract Addresses

After deployment, contract addresses are automatically saved to:
- **JSON format**: `deployments/deployment-31337.json`
- **Frontend config**: `frontend/.env.local`
- **TypeScript config**: `frontend-config.ts`

The single-command deployment system handles all configuration automatically!

## 📄 License

This project is licensed under the MIT License.
