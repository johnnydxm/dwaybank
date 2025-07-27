# PR Review Template

## Instructions for Agents
Use this template for all PR reviews. Be concise, direct, and focus only on critical issues.

## Review Format

### Critical Issues
• **Security**: [Specific security vulnerability with line number]
• **Performance**: [Performance bottleneck with impact assessment]
• **Logic**: [Business logic error with correction]
• **Compliance**: [Regulatory compliance violation]

### Code Quality
• **Structure**: [File organization or naming issue]
• **Types**: [TypeScript/type safety concern]
• **Error Handling**: [Missing or incorrect error handling]

### Testing
• **Coverage**: [Missing test cases for critical paths]
• **Quality**: [Test quality or reliability issues]

### Documentation
• **API**: [Missing or incorrect API documentation]
• **Code**: [Complex code requiring comments]

## Approval Criteria
- [ ] No security vulnerabilities
- [ ] Performance requirements met
- [ ] Code quality standards followed
- [ ] Test coverage ≥80%
- [ ] Documentation complete

## Review Guidelines

### DO
• Focus on critical business impact
• Reference specific line numbers
• Suggest concrete solutions
• Validate against DwayBank requirements

### DON'T
• Write verbose explanations
• Comment on minor style preferences
• Block PRs for non-critical issues
• Duplicate automated tool feedback

## Example Reviews

### Good Review
```markdown
## Critical Issues
• L23: SQL injection vulnerability - use parameterized queries
• L45: Async operation not awaited - causes race condition
• L67: Missing input validation for amount field

## Approval Status
❌ Blocked - security issues must be resolved
```

### Bad Review
```markdown
This code looks pretty good overall, but I have a few concerns about the implementation. 
The error handling pattern isn't quite following our established conventions, and there 
are some opportunities for optimization that we should consider...
```

## Agent-Specific Guidelines

### dwaybank-security
• Focus on vulnerabilities, compliance, data protection
• Reference security standards (PCI DSS, SOX)
• Validate authentication/authorization

### dwaybank-performance  
• Identify bottlenecks, memory leaks, inefficiencies
• Validate against 10K TPS requirement
• Check response time targets (<200ms)

### dwaybank-qa
• Verify test coverage and quality
• Check edge case handling
• Validate error scenarios

### dwaybank-architect
• Review structural decisions
• Validate architectural patterns
• Check scalability implications