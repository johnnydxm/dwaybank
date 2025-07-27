#!/bin/bash

# DwayBank Quick Start Script
# Quickly check status and provide session initiation options

echo "🎯 === DWAYBANK QUICK START ==="
echo ""

# Configuration
PROJECT_ROOT="/Users/aubk/Documents/Projects/dwaybank"
TASKMASTER_DIR="$PROJECT_ROOT/.taskmaster"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if process is running
process_running() {
    pgrep -f "$1" >/dev/null 2>&1
}

echo "📊 === SYSTEM STATUS ==="

# Check if we're in the right directory
if [ "$PWD" != "$PROJECT_ROOT" ]; then
    echo "📁 Current directory: $PWD"
    echo "💡 Recommended: cd $PROJECT_ROOT"
    echo ""
fi

# Check coordination bridge status
if process_running "superclaude_bridge.js"; then
    BRIDGE_PID=$(pgrep -f "superclaude_bridge.js")
    echo "✅ Coordination Bridge: ACTIVE (PID: $BRIDGE_PID)"
    BRIDGE_STATUS="active"
else
    echo "❌ Coordination Bridge: INACTIVE"
    BRIDGE_STATUS="inactive"
fi

# Check Task Master structure
if [ -d "$TASKMASTER_DIR" ]; then
    echo "✅ Task Master Structure: EXISTS"
    TM_STATUS="ready"
else
    echo "❌ Task Master Structure: MISSING"
    TM_STATUS="missing"
fi

# Check SuperClaude configuration
if [ -f "/Users/aubk/.claude/CLAUDE.md" ]; then
    echo "✅ SuperClaude Config: EXISTS"
    SC_STATUS="ready"
else
    echo "❌ SuperClaude Config: MISSING"
    SC_STATUS="missing"
fi

# Check agent configurations
AGENT_COUNT=$(find "$PROJECT_ROOT/.claude/agents" -name "*.js" -o -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
echo "📊 Agent Configurations: $AGENT_COUNT files"

# Check recent activity
if [ -f "$TASKMASTER_DIR/logs/bridge.log" ]; then
    LAST_ACTIVITY=$(tail -1 "$TASKMASTER_DIR/logs/bridge.log" 2>/dev/null | head -c 50)
    if [ -n "$LAST_ACTIVITY" ]; then
        echo "📈 Recent Activity: Found"
    else
        echo "📈 Recent Activity: None"
    fi
fi

echo ""
echo "🚀 === INITIATION OPTIONS ==="

# Option 1: Everything is ready
if [ "$BRIDGE_STATUS" = "active" ] && [ "$TM_STATUS" = "ready" ] && [ "$SC_STATUS" = "ready" ]; then
    echo "🎯 RECOMMENDED: Use Claude Code with coordination"
    echo "   cd $PROJECT_ROOT"
    echo "   /load @dwaybank --coordination taskmaster"
    echo ""
    echo "📋 OTHER OPTIONS:"
    echo "   /spawn --agents architect,security --coordination taskmaster"
    echo "   /analyze --comprehensive --coordination taskmaster"
    echo "   /implement \"new feature\" --coordination taskmaster"
    
    # Check if tm command exists
    if command_exists tm; then
        echo ""
        echo "🛠️  TASK MASTER COMMANDS (if preferred):"
        echo "   tm init --agents superclaude"
        echo "   tm assign \"task\" --agents dwaybank-*"
    fi

# Option 2: Bridge inactive but structure exists
elif [ "$BRIDGE_STATUS" = "inactive" ] && [ "$TM_STATUS" = "ready" ] && [ "$SC_STATUS" = "ready" ]; then
    echo "🔄 RESTART COORDINATION:"
    echo "   cd $PROJECT_ROOT"
    echo "   ./.taskmaster/configs/startup.sh"
    echo ""
    echo "⚡ QUICK AGENT ACTIVATION (without coordination):"
    echo "   node activate-full-framework.js"

# Option 3: Missing components
else
    echo "🚨 SETUP REQUIRED:"
    
    if [ "$TM_STATUS" = "missing" ]; then
        echo "   ❌ Task Master structure missing - run integration setup"
    fi
    
    if [ "$SC_STATUS" = "missing" ]; then
        echo "   ❌ SuperClaude config missing - check ~/.claude/CLAUDE.md"
    fi
    
    echo ""
    echo "🔧 RECOVERY OPTIONS:"
    echo "   1. Re-run Task Master integration setup"
    echo "   2. Check SuperClaude installation"
    echo "   3. Verify project structure"
fi

echo ""
echo "🏥 === HEALTH MONITORING ==="
echo "📊 System Status:"
echo "   tail -f .taskmaster/logs/bridge.log     # Monitor coordination"
echo "   tail -f .taskmaster/logs/agents.log     # Monitor agents"
echo "   cat .taskmaster/logs/initialization_report.json  # Full status"
echo ""
echo "🔍 Quick Checks:"
echo "   ps aux | grep superclaude_bridge        # Check bridge process"
echo "   ls .claude/agents/                      # List agent configs"
echo "   grep -c 'activated' .taskmaster/logs/agents.log  # Count active agents"

echo ""
echo "📖 === DOCUMENTATION ==="
echo "📋 Complete Guide: .taskmaster/SESSION_GUIDE.md"
echo "🔧 Project Setup: .taskmaster/README.md"
echo "📊 Requirements: .taskmaster/docs/requirements.md"

echo ""
echo "💡 === QUICK TIPS ==="
echo "• Always use --coordination taskmaster with SuperClaude commands"
echo "• Monitor .taskmaster/logs/ for system activity"
echo "• Restart coordination if bridge becomes unresponsive"
echo "• Use /load first to establish project context"

echo ""

# Display current working directory advice
if [ "$PWD" != "$PROJECT_ROOT" ]; then
    echo "🎯 === NEXT STEP ==="
    echo "cd $PROJECT_ROOT"
    if [ "$BRIDGE_STATUS" = "active" ]; then
        echo "/load @dwaybank --coordination taskmaster"
    else
        echo "./.taskmaster/configs/startup.sh"
    fi
fi