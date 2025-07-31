#!/bin/bash

# DwayBank Agent Management Script
# Automates Claude Code agent creation and management

set -e

AGENTS_DIR=".claude/agents"
SCRIPTS_DIR="scripts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Claude Code is available
check_claude_code() {
    if ! command -v claude &> /dev/null; then
        log_error "Claude Code CLI not found. Please install Claude Code first."
        exit 1
    fi
}

# List all available agent files
list_agents() {
    log_info "Available agent files in $AGENTS_DIR:"
    find "$AGENTS_DIR" -name "dwaybank-*.md" -exec basename {} .md \; | sort
}

# Create agent from file
create_agent() {
    local agent_name="$1"
    local agent_file="$AGENTS_DIR/$agent_name.md"
    
    if [[ ! -f "$agent_file" ]]; then
        log_error "Agent file not found: $agent_file"
        return 1
    fi
    
    log_info "Creating agent: $agent_name"
    
    # Read the agent file and create using Claude Code
    if claude agents create "$agent_name" < "$agent_file"; then
        log_info "✅ Successfully created agent: $agent_name"
    else
        log_error "❌ Failed to create agent: $agent_name"
        return 1
    fi
}

# Create all DwayBank agents
create_all_agents() {
    log_info "Creating all DwayBank agents..."
    
    local agents=(
        "dwaybank-architect"
        "dwaybank-analyzer" 
        "dwaybank-backend"
        "dwaybank-devops"
        "dwaybank-frontend"
        "dwaybank-mentor"
        "dwaybank-performance"
        "dwaybank-qa-converted"
        "dwaybank-refactorer"
        "dwaybank-scribe"
        "dwaybank-security"
    )
    
    local success_count=0
    local total_count=${#agents[@]}
    
    for agent in "${agents[@]}"; do
        if create_agent "$agent"; then
            ((success_count++))
        fi
        sleep 1  # Brief pause between creations
    done
    
    log_info "Agent creation complete: $success_count/$total_count successful"
}

# Fix the dwaybank-qa agent specifically
fix_qa_agent() {
    log_info "Fixing dwaybank-qa agent..."
    
    # Remove existing if it exists
    claude agents delete dwaybank-qa 2>/dev/null || true
    
    # Create from the converted file
    if create_agent "dwaybank-qa-converted"; then
        log_info "✅ dwaybank-qa agent fixed successfully"
    else
        log_error "❌ Failed to fix dwaybank-qa agent"
        return 1
    fi
}

# Remove all DwayBank agents
cleanup_agents() {
    log_warn "Removing all DwayBank agents..."
    
    claude agents list | grep "dwaybank-" | while read -r agent_name; do
        log_info "Removing agent: $agent_name"
        claude agents delete "$agent_name" || log_warn "Could not remove $agent_name"
    done
}

# Check agent status
check_agents() {
    log_info "Current Claude Code agents:"
    claude agents list || log_error "Failed to list agents"
}

# Validate agent files
validate_agents() {
    log_info "Validating agent files..."
    
    find "$AGENTS_DIR" -name "dwaybank-*.md" | while read -r file; do
        local agent_name=$(basename "$file" .md)
        
        # Check for required frontmatter
        if ! grep -q "^name:" "$file"; then
            log_error "Missing 'name' in frontmatter: $file"
        fi
        
        if ! grep -q "^description:" "$file"; then
            log_error "Missing 'description' in frontmatter: $file"  
        fi
        
        if ! grep -q "^tools:" "$file"; then
            log_error "Missing 'tools' in frontmatter: $file"
        fi
        
        log_info "✅ $agent_name validated"
    done
}

# Main menu
show_help() {
    echo "DwayBank Agent Management Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  list         List available agent files"
    echo "  create-all   Create all DwayBank agents"
    echo "  fix-qa       Fix the dwaybank-qa agent specifically"
    echo "  cleanup      Remove all DwayBank agents"
    echo "  check        Check current agent status"
    echo "  validate     Validate agent file formats"
    echo "  help         Show this help message"
    echo ""
}

# Main execution
main() {
    # Ensure we're in the project root
    if [[ ! -d "$AGENTS_DIR" ]]; then
        log_error "Must be run from DwayBank project root (looking for $AGENTS_DIR)"
        exit 1
    fi
    
    check_claude_code
    
    case "${1:-help}" in
        "list")
            list_agents
            ;;
        "create-all")
            create_all_agents
            ;;
        "fix-qa")
            fix_qa_agent
            ;;
        "cleanup")
            cleanup_agents
            ;;
        "check")
            check_agents
            ;;
        "validate")
            validate_agents
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

main "$@"