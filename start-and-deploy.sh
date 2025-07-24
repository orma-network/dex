#!/bin/bash

# WinDex Complete Local Development Setup Script
# Automates: Anvil startup → Contract deployment → Frontend configuration → Status display

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
ANVIL_PORT=8545
ANVIL_HOST="127.0.0.1"
ANVIL_RPC_URL="http://${ANVIL_HOST}:${ANVIL_PORT}"
ANVIL_PID_FILE=".anvil.pid"
FRONTEND_PID_FILE=".frontend.pid"
DEPLOYMENT_FILE="deployments/deployment-31337.json"
MAX_WAIT_ANVIL=10
MAX_WAIT_DEPLOYMENT=120

# Function to print colored output
print_header() {
    echo -e "\n${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}\n"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
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

print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# Function to cleanup on exit
cleanup() {
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        print_error "Deployment failed! Cleaning up..."
    fi

    # Kill frontend server if we started it
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local frontend_pid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$frontend_pid" 2>/dev/null; then
            print_info "Stopping frontend server (PID: $frontend_pid)..."
            kill "$frontend_pid" 2>/dev/null || true
            sleep 2
            # Force kill if still running
            if kill -0 "$frontend_pid" 2>/dev/null; then
                kill -9 "$frontend_pid" 2>/dev/null || true
            fi
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi

    # Kill Anvil if we started it
    if [ -f "$ANVIL_PID_FILE" ]; then
        local anvil_pid=$(cat "$ANVIL_PID_FILE")
        if kill -0 "$anvil_pid" 2>/dev/null; then
            print_info "Stopping Anvil (PID: $anvil_pid)..."
            kill "$anvil_pid" 2>/dev/null || true
            sleep 2
            # Force kill if still running
            if kill -0 "$anvil_pid" 2>/dev/null; then
                kill -9 "$anvil_pid" 2>/dev/null || true
            fi
        fi
        rm -f "$ANVIL_PID_FILE"
    fi

    if [ $exit_code -ne 0 ]; then
        print_error "Setup incomplete. Please check the errors above."
        exit $exit_code
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if Anvil is running
is_anvil_running() {
    curl -s -X POST -H "Content-Type: application/json" \
         --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
         "$ANVIL_RPC_URL" >/dev/null 2>&1
}

# Function to wait for Anvil to be ready
wait_for_anvil() {
    local count=0
    print_step "Waiting for Anvil to be ready..."
    
    while [ $count -lt $MAX_WAIT_ANVIL ]; do
        if is_anvil_running; then
            print_success "Anvil is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 1
        count=$((count + 1))
    done
    
    print_error "Anvil failed to start within ${MAX_WAIT_ANVIL} seconds"
    return 1
}

# Function to start Anvil
start_anvil() {
    print_step "Starting Anvil local node..."
    
    # Check if Anvil is already running
    if is_anvil_running; then
        print_warning "Anvil is already running on $ANVIL_RPC_URL"
        return 0
    fi
    
    # Start Anvil in background
    anvil --host "$ANVIL_HOST" --port "$ANVIL_PORT" >/dev/null 2>&1 &
    local anvil_pid=$!
    
    # Save PID for cleanup
    echo "$anvil_pid" > "$ANVIL_PID_FILE"
    
    # Wait for Anvil to be ready
    if wait_for_anvil; then
        print_success "Anvil started successfully (PID: $anvil_pid)"
        print_info "RPC URL: $ANVIL_RPC_URL"
        return 0
    else
        return 1
    fi
}

# Function to deploy contracts
deploy_contracts() {
    print_step "Deploying WinDex smart contracts..."
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        print_warning ".env file not found, creating from template..."
        if [ -f .env.example ]; then
            cp .env.example .env
            print_info "Please edit .env file if needed (using default Anvil settings)"
        else
            print_error ".env.example not found"
            return 1
        fi
    fi
    
    # Build contracts first
    print_info "Building smart contracts..."
    cd contracts
    if ! forge build >/dev/null 2>&1; then
        print_error "Contract compilation failed"
        return 1
    fi
    print_success "Contracts compiled successfully"
    
    # Deploy contracts
    print_info "Executing deployment script..."
    if forge script script/Deploy.s.sol:Deploy \
        --rpc-url "$ANVIL_RPC_URL" \
        --broadcast \
        --chain-id 31337 \
        -v; then
        cd ..
        print_success "Contracts deployed successfully"
        return 0
    else
        cd ..
        print_error "Contract deployment failed"
        return 1
    fi
}

# Function to configure frontend
configure_frontend() {
    print_step "Configuring frontend..."

    # Move deployment artifacts to correct location
    if [ -f "deployment-31337.json" ]; then
        mkdir -p deployments
        mv deployment-31337.json deployments/
        print_info "Moved deployment artifacts to deployments/"
    fi

    if [ -f "frontend-config.ts" ]; then
        print_info "Generated TypeScript configuration"
    fi

    # Run post-deployment script with better error handling
    print_info "Running post-deployment configuration..."
    if ./scripts/post-deploy.sh anvil; then
        print_success "Frontend configuration completed"
        return 0
    else
        local exit_code=$?
        print_error "Frontend configuration failed with exit code: $exit_code"
        print_error "Check the output above for details"
        return 1
    fi
}

# Function to start frontend server
start_frontend() {
    print_step "Starting frontend development server..."

    # Check if frontend directory exists
    if [ ! -d "frontend" ]; then
        print_error "Frontend directory not found"
        return 1
    fi

    # Check if package.json exists
    if [ ! -f "frontend/package.json" ]; then
        print_error "Frontend package.json not found"
        return 1
    fi

    # Check if node_modules exists, install if not
    if [ ! -d "frontend/node_modules" ]; then
        print_info "Installing frontend dependencies..."
        cd frontend
        if ! npm install >/dev/null 2>&1; then
            cd ..
            print_error "Failed to install frontend dependencies"
            return 1
        fi
        cd ..
        print_success "Frontend dependencies installed"
    fi

    # Start frontend server in background
    print_info "Starting Next.js development server..."
    cd frontend
    npm run dev >/dev/null 2>&1 &
    local frontend_pid=$!
    cd ..

    # Save frontend PID for cleanup
    echo "$frontend_pid" > .frontend.pid

    # Wait a moment for the server to start
    sleep 3

    # Check if the server is running
    if kill -0 "$frontend_pid" 2>/dev/null; then
        print_success "Frontend server started successfully (PID: $frontend_pid)"
        print_info "Frontend URL: http://localhost:3000"
        return 0
    else
        print_error "Failed to start frontend server"
        return 1
    fi
}

# Function to display deployment status
display_status() {
    print_header "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY"

    if [ ! -f "$DEPLOYMENT_FILE" ]; then
        print_error "Deployment file not found: $DEPLOYMENT_FILE"
        return 1
    fi

    # Extract contract addresses
    local factory=$(jq -r '.factory' "$DEPLOYMENT_FILE" 2>/dev/null || echo "N/A")
    local router=$(jq -r '.router' "$DEPLOYMENT_FILE" 2>/dev/null || echo "N/A")
    local token_factory=$(jq -r '.tokenFactory' "$DEPLOYMENT_FILE" 2>/dev/null || echo "N/A")
    local token_a=$(jq -r '.testTokenA' "$DEPLOYMENT_FILE" 2>/dev/null || echo "N/A")
    local token_b=$(jq -r '.testTokenB' "$DEPLOYMENT_FILE" 2>/dev/null || echo "N/A")
    local token_c=$(jq -r '.testTokenC' "$DEPLOYMENT_FILE" 2>/dev/null || echo "N/A")

    echo -e "${GREEN}📊 Contract Addresses:${NC}"
    echo -e "   ${CYAN}Factory:${NC}      $factory"
    echo -e "   ${CYAN}Router:${NC}       $router"
    echo -e "   ${CYAN}TokenFactory:${NC} $token_factory"
    echo -e "   ${CYAN}TestTokenA:${NC}   $token_a"
    echo -e "   ${CYAN}TestTokenB:${NC}   $token_b"
    echo -e "   ${CYAN}TestTokenC:${NC}   $token_c"

    echo -e "\n${GREEN}🌐 Network Information:${NC}"
    echo -e "   ${CYAN}RPC URL:${NC}      $ANVIL_RPC_URL"
    echo -e "   ${CYAN}Chain ID:${NC}     31337"
    echo -e "   ${CYAN}Network:${NC}      Anvil (Local)"

    echo -e "\n${GREEN}📁 Generated Files:${NC}"
    echo -e "   ${CYAN}Deployment:${NC}   $DEPLOYMENT_FILE"
    echo -e "   ${CYAN}Frontend ENV:${NC} frontend/.env.local"
    echo -e "   ${CYAN}Summary:${NC}      deployments/summary-anvil.md"

    echo -e "\n${GREEN}🚀 Development Environment:${NC}"
    echo -e "   ${YELLOW}✅${NC} Anvil node running on:"
    echo -e "      ${CYAN}http://localhost:8545${NC}"
    echo -e "   ${YELLOW}✅${NC} Frontend server running on:"
    echo -e "      ${CYAN}http://localhost:3000${NC}"
    echo -e "   ${YELLOW}✅${NC} Smart contracts deployed and configured"

    echo -e "\n${GREEN}🔗 Quick Setup:${NC}"
    echo -e "   ${YELLOW}1.${NC} Open your browser:"
    echo -e "      ${CYAN}http://localhost:3000${NC}"
    echo -e "   ${YELLOW}2.${NC} Connect MetaMask to:"
    echo -e "      ${CYAN}Network: Localhost 8545${NC}"
    echo -e "      ${CYAN}Chain ID: 31337${NC}"
    echo -e "   ${YELLOW}3.${NC} Import Anvil test account:"
    echo -e "      ${CYAN}Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80${NC}"

    echo -e "\n${GREEN}🛠️  Useful Commands:${NC}"
    echo -e "   ${CYAN}make status${NC}           # Check deployment status"
    echo -e "   ${CYAN}make test-deployment${NC}  # Test contract functionality"
    echo -e "   ${CYAN}make stop${NC}             # Stop all services"

    echo -e "\n${PURPLE}================================${NC}"
    echo -e "${GREEN}✅ WinDex DEX is ready for development!${NC}"
    echo -e "${PURPLE}================================${NC}\n"
}

# Main execution function
main() {
    print_header "🚀 WinDex Complete Local Development Setup"
    
    # Check prerequisites
    print_step "Checking prerequisites..."
    
    if ! command_exists anvil; then
        print_error "Anvil not found. Please install Foundry: https://getfoundry.sh"
        exit 1
    fi
    
    if ! command_exists forge; then
        print_error "Forge not found. Please install Foundry: https://getfoundry.sh"
        exit 1
    fi
    
    if ! command_exists jq; then
        print_warning "jq not found. Installing via package manager recommended for better output formatting"
    fi
    
    print_success "Prerequisites check passed"
    
    # Step 1: Start Anvil
    print_header "🔧 Step 1: Starting Anvil Node"
    if ! start_anvil; then
        print_error "Failed to start Anvil"
        exit 1
    fi
    
    # Step 2: Deploy contracts
    print_header "📦 Step 2: Deploying Smart Contracts"
    if ! deploy_contracts; then
        print_error "Failed to deploy contracts"
        exit 1
    fi
    
    # Step 3: Configure frontend
    print_header "⚙️  Step 3: Configuring Frontend"
    if ! configure_frontend; then
        print_error "Failed to configure frontend"
        exit 1
    fi

    # Step 4: Start frontend server
    print_header "🌐 Step 4: Starting Frontend Server"
    if ! start_frontend; then
        print_error "Failed to start frontend server"
        exit 1
    fi

    # Step 5: Display status
    display_status

    # Keep services running
    print_info "Services running in the background:"
    print_info "  Anvil: PID $(cat $ANVIL_PID_FILE 2>/dev/null || echo 'unknown')"
    print_info "  Frontend: PID $(cat $FRONTEND_PID_FILE 2>/dev/null || echo 'unknown')"
    print_info "Use 'make stop' to stop all services when done"

    # Remove the cleanup trap since we want to keep services running
    trap - EXIT
}

# Show usage if help requested
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "WinDex Complete Local Development Setup"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "This script automates the complete WinDex DEX setup process:"
    echo "  1. Starts Anvil local node"
    echo "  2. Deploys all smart contracts"
    echo "  3. Configures frontend"
    echo "  4. Starts frontend development server"
    echo "  5. Displays deployment summary"
    echo ""
    echo "Options:"
    echo "  --help, -h    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0            # Complete setup"
    echo ""
    echo "After successful deployment:"
    echo "  Frontend will be running at:  http://localhost:3000"
    echo "  make stop                     # Stop all services"
    echo ""
    exit 0
fi

# Run main function
main "$@"
