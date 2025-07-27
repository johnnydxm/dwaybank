# Claude Code Commands & Best Practices

## Project Structure Rules

### DwayBank + TaskMaster + SuperClaude Integration

**Always use coordination flag**: `--coordination taskmaster` for optimal agent coalition formation and resource sharing.

## Folder Structure Standards

### Root Project Structure
```
dwaybank/
├── .claude/                    # SuperClaude agent ecosystem
│   ├── agents/                # 18 specialized agents
│   ├── commands/              # This directory - Claude Code commands
│   └── CLAUDE.md              # Project-specific instructions
├── .taskmaster/               # TaskMaster coordination
│   ├── configs/               # Startup and health scripts
│   ├── logs/                  # Coordination logs
│   ├── workflows/             # Automation workflows
│   └── superclaude_bridge.js  # Integration bridge
├── src/                       # Source code (clean structure)
├── tests/                     # Test files
├── docs/                      # Documentation
└── scripts/                   # Utility scripts
```

### Clean Code Structure Requirements

#### Source Code Organization
```
src/
├── components/                # Reusable UI components
│   ├── common/               # Shared components
│   └── financial/            # Domain-specific components
├── services/                 # Business logic services
│   ├── auth/                 # Authentication services
│   ├── payments/             # Payment processing
│   └── compliance/           # Regulatory compliance
├── utils/                    # Utility functions
├── types/                    # TypeScript definitions
├── config/                   # Configuration files
└── constants/                # Application constants
```

#### Test Structure
```
tests/
├── unit/                     # Unit tests
├── integration/              # Integration tests
├── e2e/                      # End-to-end tests
└── fixtures/                 # Test data
```

## Code Quality Standards

### File Naming Conventions
- **Components**: PascalCase (`PaymentForm.tsx`)
- **Services**: camelCase (`paymentService.ts`)
- **Utilities**: camelCase (`formatCurrency.ts`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_ENDPOINTS.ts`)
- **Types**: PascalCase (`PaymentTypes.ts`)

### Code Organization Rules
1. **One responsibility per file**
2. **Maximum 200 lines per file**
3. **Clear imports/exports structure**
4. **Consistent error handling patterns**
5. **Comprehensive type definitions**

## Agent Coordination Patterns

### Always Use Coordination
```bash
# Correct - with coordination
/load @dwaybank --coordination taskmaster
/implement "feature" --coordination taskmaster
/analyze --focus security --coordination taskmaster

# Incorrect - without coordination
/load @dwaybank
/implement "feature"
```

### Agent Coalition Formation
- **Architecture**: `dwaybank-architect` leads system design
- **Security**: `dwaybank-security` validates all implementations
- **Quality**: `dwaybank-qa` ensures testing standards
- **Performance**: `dwaybank-performance` optimizes bottlenecks

## PR Review Standards

### Review Guidelines
- **Be concise and direct in PR reviews**
- **Use bullet points for feedback**
- **Focus only on critical issues**
- **Avoid verbose explanations**

### Review Template
```markdown
## Critical Issues
• [Issue description with line reference]
• [Security concern with specific fix]
• [Performance bottleneck with solution]

## Minor Suggestions
• [Code style improvement]
• [Documentation enhancement]

## Approval Status
- [ ] Security validation passed
- [ ] Performance requirements met
- [ ] Code quality standards met
```

## Development Workflow

### 1. Project Setup
```bash
cd /Users/aubk/Documents/Projects/dwaybank
/load @dwaybank --coordination taskmaster --type project
```

### 2. Feature Development
```bash
# Design phase
/design "payment system" --agents architect,security --coordination taskmaster

# Implementation phase
/implement "payment processing" --agents backend,security,qa --coordination taskmaster

# Testing phase
/test --comprehensive --agents qa,performance --coordination taskmaster
```

### 3. Code Review
```bash
# Automated review with focused feedback
/analyze --focus quality,security --agents qa,security --coordination taskmaster --format pr-review
```

## Maintenance Standards

### Regular Health Checks
```bash
# System health monitoring
./.taskmaster/configs/health-check.sh

# Coordination status
ps aux | grep superclaude_bridge
```

### Log Management
- **Bridge logs**: `.taskmaster/logs/bridge.log`
- **Agent logs**: `.taskmaster/logs/agents.log`
- **Health reports**: Real-time monitoring

## Quality Gates

### Pre-Commit Requirements
1. **Security scan passed**
2. **Performance benchmarks met**
3. **Type checking successful**
4. **Test coverage ≥80%**
5. **Code review approved**

### Deployment Checklist
- [ ] All tests passing
- [ ] Security validation complete
- [ ] Performance metrics within limits
- [ ] Documentation updated
- [ ] Monitoring configured