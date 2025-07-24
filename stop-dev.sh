#!/bin/bash

# WinDex Development Environment Cleanup Script
# Stops Anvil and cleans up development artifacts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
ANVIL_PID_FILE=".anvil.pid"
FRONTEND_PID_FILE=".frontend.pid"
ANVIL_PORT=8545
ANVIL_HOST="127.0.0.1"
ANVIL_RPC_URL="http://${ANVIL_HOST}:${ANVIL_PORT}"
FRONTEND_PORT=3000

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

# Function to check if Anvil is running
is_anvil_running() {
    curl -s -X POST -H "Content-Type: application/json" \
         --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
         "$ANVIL_RPC_URL" >/dev/null 2>&1
}

# Function to check if frontend is running
is_frontend_running() {
    curl -s "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1
}

# Function to stop Anvil
stop_anvil() {
    print_step "Stopping Anvil node..."
    
    local stopped=false
    
    # Try to stop using PID file
    if [ -f "$ANVIL_PID_FILE" ]; then
        local anvil_pid=$(cat "$ANVIL_PID_FILE")
        if kill -0 "$anvil_pid" 2>/dev/null; then
            print_info "Stopping Anvil (PID: $anvil_pid)..."
            kill "$anvil_pid" 2>/dev/null || true
            sleep 2
            
            # Check if it stopped
            if ! kill -0 "$anvil_pid" 2>/dev/null; then
                print_success "Anvil stopped successfully"
                stopped=true
            else
                print_warning "Anvil didn't stop gracefully, force killing..."
                kill -9 "$anvil_pid" 2>/dev/null || true
                sleep 1
                if ! kill -0 "$anvil_pid" 2>/dev/null; then
                    print_success "Anvil force stopped"
                    stopped=true
                fi
            fi
        else
            print_warning "PID in file is not running"
        fi
        rm -f "$ANVIL_PID_FILE"
    fi
    
    # Try to find and kill any remaining anvil processes
    if ! $stopped; then
        print_info "Looking for running Anvil processes..."
        local anvil_pids=$(pgrep -f "anvil.*--port.*$ANVIL_PORT" 2>/dev/null || true)
        if [ -n "$anvil_pids" ]; then
            print_info "Found Anvil processes: $anvil_pids"
            echo "$anvil_pids" | xargs kill 2>/dev/null || true
            sleep 2
            
            # Force kill if still running
            local remaining_pids=$(pgrep -f "anvil.*--port.*$ANVIL_PORT" 2>/dev/null || true)
            if [ -n "$remaining_pids" ]; then
                print_warning "Force killing remaining processes: $remaining_pids"
                echo "$remaining_pids" | xargs kill -9 2>/dev/null || true
            fi
            stopped=true
            print_success "Anvil processes stopped"
        fi
    fi
    
    # Final check
    if is_anvil_running; then
        print_error "Anvil is still running on $ANVIL_RPC_URL"
        print_info "You may need to manually kill the process"
        return 1
    else
        if ! $stopped; then
            print_info "Anvil was not running"
        fi
        return 0
    fi
}

# Function to stop frontend server
stop_frontend() {
    print_step "Stopping frontend server..."

    local stopped=false

    # Try to stop using PID file
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local frontend_pid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$frontend_pid" 2>/dev/null; then
            print_info "Stopping frontend server (PID: $frontend_pid)..."
            kill "$frontend_pid" 2>/dev/null || true
            sleep 2

            # Check if it stopped
            if ! kill -0 "$frontend_pid" 2>/dev/null; then
                print_success "Frontend server stopped successfully"
                stopped=true
            else
                print_warning "Frontend server didn't stop gracefully, force killing..."
                kill -9 "$frontend_pid" 2>/dev/null || true
                sleep 1
                if ! kill -0 "$frontend_pid" 2>/dev/null; then
                    print_success "Frontend server force stopped"
                    stopped=true
                fi
            fi
        else
            print_warning "PID in file is not running"
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi

    # Try to find and kill any remaining Next.js processes on the frontend port
    if ! $stopped; then
        print_info "Looking for running Next.js processes..."
        local next_pids=$(lsof -ti:$FRONTEND_PORT 2>/dev/null || true)
        if [ -n "$next_pids" ]; then
            print_info "Found processes on port $FRONTEND_PORT: $next_pids"
            echo "$next_pids" | xargs kill 2>/dev/null || true
            sleep 2

            # Force kill if still running
            local remaining_pids=$(lsof -ti:$FRONTEND_PORT 2>/dev/null || true)
            if [ -n "$remaining_pids" ]; then
                print_warning "Force killing remaining processes: $remaining_pids"
                echo "$remaining_pids" | xargs kill -9 2>/dev/null || true
            fi
            stopped=true
            print_success "Frontend processes stopped"
        fi
    fi

    # Final check
    if is_frontend_running; then
        print_error "Frontend server is still running on port $FRONTEND_PORT"
        print_info "You may need to manually kill the process"
        return 1
    else
        if ! $stopped; then
            print_info "Frontend server was not running"
        fi
        return 0
    fi
}

# Function to clean up artifacts
cleanup_artifacts() {
    print_step "Cleaning up development artifacts..."
    
    local cleaned=false
    
    # Clean deployment artifacts (optional)
    if [[ "$1" == "--clean-all" || "$1" == "-a" ]]; then
        print_info "Removing deployment artifacts..."
        rm -rf deployments/deployment-31337.json 2>/dev/null || true
        rm -rf deployments/summary-anvil.md 2>/dev/null || true
        rm -rf frontend/.env.local 2>/dev/null || true
        rm -rf frontend-config.ts 2>/dev/null || true
        cleaned=true
    fi
    
    # Clean build artifacts
    if [[ "$1" == "--clean-build" || "$1" == "--clean-all" || "$1" == "-a" ]]; then
        print_info "Removing build artifacts..."
        rm -rf contracts/out 2>/dev/null || true
        rm -rf contracts/cache 2>/dev/null || true
        rm -rf contracts/broadcast 2>/dev/null || true
        cleaned=true
    fi
    
    # Remove PID files
    rm -f "$ANVIL_PID_FILE" 2>/dev/null || true
    rm -f "$FRONTEND_PID_FILE" 2>/dev/null || true
    
    if $cleaned; then
        print_success "Artifacts cleaned up"
    else
        print_info "No artifacts to clean (use --clean-all for full cleanup)"
    fi
}

# Function to show status
show_status() {
    print_header "🔍 Development Environment Status"

    # Check Anvil status
    if is_anvil_running; then
        print_error "Anvil is still running on $ANVIL_RPC_URL"
    else
        print_success "Anvil is not running"
    fi

    # Check frontend status
    if is_frontend_running; then
        print_error "Frontend server is still running on port $FRONTEND_PORT"
    else
        print_success "Frontend server is not running"
    fi

    # Check Anvil PID file
    if [ -f "$ANVIL_PID_FILE" ]; then
        local pid=$(cat "$ANVIL_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            print_warning "Anvil PID file exists with running process: $pid"
        else
            print_warning "Stale Anvil PID file exists: $ANVIL_PID_FILE"
        fi
    else
        print_success "No Anvil PID file found"
    fi

    # Check frontend PID file
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            print_warning "Frontend PID file exists with running process: $pid"
        else
            print_warning "Stale frontend PID file exists: $FRONTEND_PID_FILE"
        fi
    else
        print_success "No frontend PID file found"
    fi
    
    # Check for deployment artifacts
    if [ -f "deployments/deployment-31337.json" ]; then
        print_info "Deployment artifacts exist"
    else
        print_info "No deployment artifacts found"
    fi
    
    # Check for running anvil processes
    local anvil_processes=$(pgrep -f "anvil" 2>/dev/null | wc -l || echo "0")
    if [ "$anvil_processes" -gt 0 ]; then
        print_warning "$anvil_processes Anvil process(es) found running"
        pgrep -fl "anvil" 2>/dev/null || true
    else
        print_success "No Anvil processes running"
    fi
}

# Main function
main() {
    local command="$1"
    
    case "$command" in
        --help|-h)
            echo "WinDex Development Environment Cleanup"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  (no args)         Stop all services (Anvil + Frontend)"
            echo "  --clean-all, -a   Stop all services and remove all artifacts"
            echo "  --clean-build     Stop all services and remove build artifacts"
            echo "  --status, -s      Show environment status"
            echo "  --help, -h        Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                # Stop all services"
            echo "  $0 --clean-all    # Stop all services and clean everything"
            echo "  $0 --status       # Check status"
            echo ""
            exit 0
            ;;
        --status|-s)
            show_status
            exit 0
            ;;
        *)
            print_header "🛑 Stopping WinDex Development Environment"

            # Stop frontend server
            stop_frontend

            # Stop Anvil
            stop_anvil

            # Clean up artifacts if requested
            cleanup_artifacts "$command"

            print_header "✅ Development Environment Stopped"
            
            if [[ "$command" != "--clean-all" && "$command" != "-a" ]]; then
                echo -e "${CYAN}💡 Tip:${NC} Use '$0 --clean-all' to also remove deployment artifacts"
            fi
            
            echo -e "${GREEN}🚀 Ready for next development session!${NC}"
            echo -e "${CYAN}   Run './start-and-deploy.sh' to start again${NC}\n"
            ;;
    esac
}

# Run main function
main "$@"
