# DwayBank Project Instructions

## Core Rules

### TaskMaster Coordination (MANDATORY)
**Always use `--coordination taskmaster` flag** for optimal agent coalition formation and resource sharing.

### Project Structure Standards
Follow clean, structured folder organization as defined in `.claude/commands/README.md`.

### PR Review Standards
- Be concise and direct in PR reviews
- Use bullet points for feedback  
- Focus only on critical issues
- Avoid verbose explanations

## Agent Ecosystem

### Available Agents (18 Total)
**SuperClaude Agents (12)**:
- `dwaybank-architect`: Systems architecture and design
- `dwaybank-security`: Threat modeling and compliance
- `dwaybank-performance`: Optimization and bottlenecks
- `dwaybank-frontend`: UI/UX and financial interfaces
- `dwaybank-backend`: Server-side systems
- `dwaybank-analyzer`: Root cause analysis
- `dwaybank-qa`: Quality assurance and testing
- `dwaybank-devops`: Infrastructure and deployment
- `dwaybank-design`: Financial interface design
- `dwaybank-refactorer`: Code quality management
- `dwaybank-mentor`: Knowledge transfer
- `dwaybank-scribe`: Professional documentation

**TaskMaster Agents (6)**:
- `taskmaster-orchestrator`: Coalition coordination
- `taskmaster-project-manager`: Project oversight
- `taskmaster-researcher`: Requirements analysis
- `taskmaster-monitor`: System monitoring
- `taskmaster-resource-manager`: Resource optimization
- `mcp-coordinator`: MCP server management

## Development Workflow

### Project Commands
```bash
# Load project with coordination
/load @dwaybank --coordination taskmaster

# Feature development
/implement "feature-name" --agents [relevant-agents] --coordination taskmaster

# Analysis and review
/analyze --focus [domain] --agents [specialist-agents] --coordination taskmaster

# Quality improvement
/improve --[aspect] --agents [quality-agents] --coordination taskmaster

# GitHub operations with coordination
/git "create-pr" --title "feature description" --coordination taskmaster
/git "review-pr" --pr-number 123 --agents security,qa --coordination taskmaster
```

### Code Quality Requirements
1. **File Organization**: Follow src/, tests/, docs/ structure
2. **Naming Conventions**: PascalCase components, camelCase services
3. **Code Quality**: Max 200 lines per file, clear responsibilities
4. **Security**: All implementations validated by security agent
5. **Testing**: Comprehensive coverage with qa agent validation

### MCP Server Integration
- **Context7**: Documentation and best practices
- **Sequential**: Complex analysis and reasoning  
- **Magic**: UI component generation
- **Playwright**: Testing and performance validation
- **GitHub**: Version control, PR management, code review coordination

## Compliance Requirements
- **Security**: PCI DSS, SOX compliance mandatory
- **Privacy**: GDPR, CCPA compliance required
- **Performance**: >10K TPS, <200ms response, 99.99% uptime
- **Quality**: 80% test coverage minimum

## Coordination Bridge
- **Status**: Active (PID: 33774)
- **Health Check**: `./.taskmaster/configs/health-check.sh`
- **Logs**: `.taskmaster/logs/bridge.log`

## File Structure Rules
```
dwaybank/
├── .claude/agents/           # Agent configurations
├── .taskmaster/             # TaskMaster coordination
├── src/                     # Clean source code structure
├── tests/                   # Organized test files
├── docs/                    # Project documentation
└── scripts/                 # Utility scripts
```

**Project Type**: Enterprise Financial Platform  
**Security Level**: Critical  
**Coordination Mode**: Event-driven with coalition formation