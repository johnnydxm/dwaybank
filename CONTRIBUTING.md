# Contributing to DwayBank Smart Wallet

Thank you for your interest in contributing to DwayBank! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm 9+
- Docker and Docker Compose
- Git with SSH keys configured
- Basic knowledge of TypeScript, Express.js, and PostgreSQL

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone git@github.com:YOUR_USERNAME/dwaybank.git`
3. Install dependencies: `npm install`
4. Copy environment file: `cp .env.example .env`
5. Start development environment: `npm run docker:run`
6. Run tests: `npm test`

## 🎯 How to Contribute

### Types of Contributions
- **Bug Reports**: Found a bug? Report it!
- **Feature Requests**: Have an idea? We'd love to hear it!
- **Code Contributions**: Fix bugs, implement features, improve performance
- **Documentation**: Improve README, add examples, fix typos
- **Testing**: Add test cases, improve coverage

### Before You Start
1. Check existing issues and PRs to avoid duplicates
2. For large changes, create an issue first to discuss the approach
3. Ensure your contribution aligns with project goals and architecture

## 📝 Development Workflow

### 1. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 2. Make Changes
- Follow existing code style and patterns
- Write clear, concise commit messages
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes
```bash
npm test                # Run all tests
npm run test:coverage   # Check coverage
npm run lint            # Check code style
npm run build          # Ensure it builds
```

### 4. Submit a Pull Request
- Push your branch to your fork
- Create a pull request against the `main` branch
- Fill out the PR template completely
- Link related issues

## 🔧 Code Standards

### TypeScript Guidelines
- Use strict TypeScript configuration
- Prefer interfaces over types for object definitions
- Use meaningful variable and function names
- Document complex logic with comments

### Code Style
```typescript
// Good
interface UserProfile {
  id: string;
  email: string;
  createdAt: Date;
}

// Bad
interface user {
  i: string;
  e: string;
  c: Date;
}
```

### Testing Requirements
- Write unit tests for all new functions
- Write integration tests for API endpoints
- Maintain minimum 80% test coverage
- Use descriptive test names

```typescript
// Good
describe('UserService', () => {
  it('should create user with valid email and password', async () => {
    // test implementation
  });
});

// Bad
describe('UserService', () => {
  it('should work', async () => {
    // test implementation
  });
});
```

## 🛡️ Security Guidelines

### Security Best Practices
- Never commit secrets, API keys, or credentials
- Use environment variables for configuration
- Validate all inputs and sanitize outputs
- Follow OWASP security guidelines
- Report security vulnerabilities privately (see SECURITY.md)

### Sensitive Information
- Personal data must be encrypted
- Financial data requires special handling
- Use secure coding practices
- Follow PCI DSS compliance requirements

## 📋 Pull Request Guidelines

### PR Requirements
- [ ] Tests pass (`npm test`)
- [ ] Code coverage maintained (≥80%)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated if needed
- [ ] PR template filled out completely

### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project standards
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added for new functionality
```

## 🐛 Bug Reports

### Before Reporting
1. Check existing issues for duplicates
2. Test with the latest version
3. Reproduce the bug consistently

### Bug Report Template
```markdown
**Describe the bug**
Clear description of the issue

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
What should happen

**Environment**
- OS: [e.g. macOS, Ubuntu]
- Node.js version: [e.g. 18.17.0]
- npm version: [e.g. 9.8.1]
- Browser: [if applicable]
```

## 💡 Feature Requests

### Before Requesting
1. Check if feature already exists
2. Search existing feature requests
3. Consider if it fits project scope

### Feature Request Template
```markdown
**Is your feature request related to a problem?**
Description of the problem

**Describe the solution you'd like**
Clear description of desired feature

**Describe alternatives you've considered**
Alternative approaches considered

**Additional context**
Screenshots, mockups, or examples
```

## 🏷️ Issue Labels

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Documentation improvements
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention needed
- `question`: Further information requested
- `security`: Security-related issues
- `performance`: Performance improvements

## 📞 Getting Help

### Community Support
- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Code Review**: All PRs receive thorough review

### Response Times
- **Bug reports**: 2-3 business days
- **Feature requests**: 1 week
- **Pull requests**: 3-5 business days
- **Security issues**: Within 24 hours

## 🎉 Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- CONTRIBUTORS.md file (if created)

## 📄 License

By contributing to DwayBank, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to DwayBank Smart Wallet! Together we're building the future of unified financial management.