#!/bin/bash

# DwayBank Health Check Script
# Comprehensive system health monitoring

echo "🏥 === DWAYBANK SYSTEM HEALTH CHECK ==="
echo "⏰ $(date)"
echo ""

# Configuration
PROJECT_ROOT="/Users/aubk/Documents/Projects/dwaybank"
TASKMASTER_DIR="$PROJECT_ROOT/.taskmaster"

# Health status variables
OVERALL_HEALTH="healthy"
ISSUES_FOUND=0

# Function to report issue
report_issue() {
    echo "❌ $1"
    OVERALL_HEALTH="degraded"
    ((ISSUES_FOUND++))
}

# Function to report warning
report_warning() {
    echo "⚠️  $1"
    if [ "$OVERALL_HEALTH" = "healthy" ]; then
        OVERALL_HEALTH="warning"
    fi
    ((ISSUES_FOUND++))
}

# Function to report success
report_success() {
    echo "✅ $1"
}

echo "🔍 === COORDINATION BRIDGE HEALTH ==="

# Check bridge process
if pgrep -f "superclaude_bridge.js" >/dev/null; then
    BRIDGE_PID=$(pgrep -f "superclaude_bridge.js")
    BRIDGE_MEMORY=$(ps -p $BRIDGE_PID -o rss= 2>/dev/null | xargs)
    BRIDGE_CPU=$(ps -p $BRIDGE_PID -o %cpu= 2>/dev/null | xargs)
    
    report_success "Coordination bridge running (PID: $BRIDGE_PID)"
    echo "   📊 Memory: ${BRIDGE_MEMORY}KB, CPU: ${BRIDGE_CPU}%"
    
    # Check if bridge is responsive (look for recent log entries)
    if [ -f "$TASKMASTER_DIR/logs/bridge.log" ]; then
        RECENT_LOGS=$(tail -10 "$TASKMASTER_DIR/logs/bridge.log" 2>/dev/null | wc -l)
        if [ "$RECENT_LOGS" -gt 0 ]; then
            report_success "Bridge logging active"
        else
            report_warning "Bridge logging inactive"
        fi
    else
        report_warning "Bridge log file missing"
    fi
else
    report_issue "Coordination bridge not running"
fi

echo ""
echo "🤝 === AGENT ECOSYSTEM HEALTH ==="

# Check agent configuration files
if [ -d "$PROJECT_ROOT/.claude/agents" ]; then
    AGENT_CONFIG_COUNT=$(find "$PROJECT_ROOT/.claude/agents" -name "*.js" -o -name "*.json" | wc -l)
    report_success "Agent configurations: $AGENT_CONFIG_COUNT files"
    
    # Check specific agent files
    if [ -f "$PROJECT_ROOT/.claude/agents/agent-orchestration-config.json" ]; then
        report_success "Agent orchestration config present"
    else
        report_issue "Agent orchestration config missing"
    fi
    
    if [ -f "$PROJECT_ROOT/.claude/agents/taskmaster-researcher.js" ]; then
        report_success "Task Master agents configured"
    else
        report_warning "Task Master agent files not found"
    fi
else
    report_issue "Agent configuration directory missing"
fi

# Check recent agent activity
if [ -f "$TASKMASTER_DIR/logs/agents.log" ]; then
    AGENT_LOG_SIZE=$(wc -l < "$TASKMASTER_DIR/logs/agents.log" 2>/dev/null)
    if [ "$AGENT_LOG_SIZE" -gt 0 ]; then
        report_success "Agent activity logs present ($AGENT_LOG_SIZE lines)"
    else
        report_warning "Agent logs empty"
    fi
else
    report_warning "Agent log file missing"
fi

echo ""
echo "🔗 === MCP SERVER COORDINATION ==="

# Check Task Master configuration
if [ -f "$TASKMASTER_DIR/.taskmasterconfig" ]; then
    report_success "Task Master configuration present"
    
    # Check MCP server configuration
    MCP_SERVERS=$(grep -o '"context7"\|"sequential"\|"magic"\|"playwright"' "$TASKMASTER_DIR/.taskmasterconfig" | wc -l)
    report_success "MCP servers configured: $MCP_SERVERS"
    
    # Check coordination settings
    if grep -q "superclaude_integration" "$TASKMASTER_DIR/.taskmasterconfig"; then
        report_success "SuperClaude integration enabled"
    else
        report_warning "SuperClaude integration not configured"
    fi
else
    report_issue "Task Master configuration missing"
fi

# Check SuperClaude configuration
if [ -f "/Users/aubk/.claude/CLAUDE.md" ]; then
    report_success "SuperClaude configuration present"
else
    report_issue "SuperClaude configuration missing"
fi

echo ""
echo "📁 === FILE SYSTEM HEALTH ==="

# Check directory structure
REQUIRED_DIRS=("docs" "templates" "workflows" "research" "configs" "cache" "logs")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$TASKMASTER_DIR/$dir" ]; then
        report_success "Directory $dir exists"
    else
        report_warning "Directory $dir missing"
    fi
done

# Check key files
KEY_FILES=(
    "$TASKMASTER_DIR/superclaude_bridge.js"
    "$TASKMASTER_DIR/project.json"
    "$TASKMASTER_DIR/README.md"
    "$TASKMASTER_DIR/docs/requirements.md"
    "$PROJECT_ROOT/activate-full-framework.js"
)

for file in "${KEY_FILES[@]}"; do
    if [ -f "$file" ]; then
        report_success "$(basename "$file") present"
    else
        report_issue "$(basename "$file") missing"
    fi
done

echo ""
echo "📊 === PERFORMANCE METRICS ==="

# Check log file sizes
if [ -d "$TASKMASTER_DIR/logs" ]; then
    LOG_FILES=$(ls "$TASKMASTER_DIR/logs"/*.log 2>/dev/null | wc -l)
    report_success "Log files: $LOG_FILES"
    
    # Check for large log files
    for log_file in "$TASKMASTER_DIR/logs"/*.log; do
        if [ -f "$log_file" ]; then
            LOG_SIZE=$(wc -c < "$log_file" 2>/dev/null)
            if [ "$LOG_SIZE" -gt 1048576 ]; then  # 1MB
                report_warning "Large log file: $(basename "$log_file") (${LOG_SIZE} bytes)"
            fi
        fi
    done
fi

# Check system resources
NODE_PROCESSES=$(pgrep node | wc -l)
if [ "$NODE_PROCESSES" -gt 0 ]; then
    echo "📈 Node.js processes: $NODE_PROCESSES"
    
    # Check for high memory usage
    HIGH_MEM_PROCESSES=$(ps aux | awk '/node/ && $6 > 100000 {print $2, $6}' | wc -l)
    if [ "$HIGH_MEM_PROCESSES" -gt 0 ]; then
        report_warning "High memory Node.js processes detected"
    fi
fi

echo ""
echo "🚨 === ISSUE SUMMARY ==="

if [ "$OVERALL_HEALTH" = "healthy" ]; then
    echo "✅ SYSTEM STATUS: HEALTHY"
    echo "🎯 All systems operational and ready for coordination"
elif [ "$OVERALL_HEALTH" = "warning" ]; then
    echo "⚠️  SYSTEM STATUS: WARNING"
    echo "📊 $ISSUES_FOUND minor issues detected"
    echo "💡 System functional but monitoring recommended"
else
    echo "❌ SYSTEM STATUS: DEGRADED"
    echo "🚨 $ISSUES_FOUND issues detected"
    echo "🔧 Resolution required for optimal operation"
fi

echo ""
echo "🔧 === RECOMMENDED ACTIONS ==="

if [ "$OVERALL_HEALTH" != "healthy" ]; then
    echo "🔄 Quick Fixes:"
    
    if ! pgrep -f "superclaude_bridge.js" >/dev/null; then
        echo "   • Restart coordination: ./.taskmaster/configs/startup.sh"
    fi
    
    if [ ! -f "$TASKMASTER_DIR/.taskmasterconfig" ]; then
        echo "   • Restore Task Master configuration"
    fi
    
    if [ ! -f "/Users/aubk/.claude/CLAUDE.md" ]; then
        echo "   • Check SuperClaude installation"
    fi
    
    echo ""
    echo "📊 Health Monitoring:"
    echo "   • Monitor bridge: tail -f .taskmaster/logs/bridge.log"
    echo "   • Monitor agents: tail -f .taskmaster/logs/agents.log"
    echo "   • Rerun health check: ./.taskmaster/configs/health-check.sh"
else
    echo "🎯 Optimal Operation:"
    echo "   • Start session: /load @dwaybank --coordination taskmaster"
    echo "   • Monitor health: ./.taskmaster/configs/health-check.sh"
    echo "   • View documentation: .taskmaster/SESSION_GUIDE.md"
fi

echo ""
echo "📅 Health check completed at $(date)"

# Exit with appropriate code
if [ "$OVERALL_HEALTH" = "healthy" ]; then
    exit 0
elif [ "$OVERALL_HEALTH" = "warning" ]; then
    exit 1
else
    exit 2
fi