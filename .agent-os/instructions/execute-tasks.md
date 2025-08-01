---
description: Agent OS task execution coordination with financial domain specialization
globs:
alwaysApply: false
version: 2.0
encoding: UTF-8
---

# Agent OS Task Execution Framework

<ai_meta>
  <rules>Multi-agent coordination required, financial compliance mandatory, quality gates enforced</rules>
  <format>UTF-8, LF, 2-space indent, financial standards compliance</format>
</ai_meta>

## Overview

Execute financial development tasks using DwayBank Agent OS framework with specialized financial agents, MCP server coordination, and regulatory compliance validation.

<agent_detection>
  <check_once>
    AT START OF PROCESS:
    SET has_git_workflow = (Claude Code AND git-workflow agent exists)
    SET has_test_runner = (Claude Code AND test-runner agent exists)
    SET has_context_fetcher = (Claude Code AND context-fetcher agent exists)
    SET has_architect = (dwaybank-architect agent available)
    SET has_security = (dwaybank-security agent available)
    SET has_qa = (dwaybank-qa agent available)
    SET has_mcp_coordinator = (mcp-coordinator agent available)
    USE these flags throughout execution
  </check_once>
</agent_detection>

<process_flow>

<step number="1" name="task_assignment_analysis">

### Step 1: Task Assignment & Financial Domain Analysis

<step_metadata>
  <inputs>
    - spec_directory: file path
    - specific_tasks: array[string] (optional)
    - financial_domain: string (payment|trading|compliance|general)
  </inputs>
  <default>next uncompleted parent task with financial domain analysis</default>
</step_metadata>

<task_selection>
  <explicit>user specifies exact financial tasks</explicit>
  <implicit>find next uncompleted task in tasks.md with domain prioritization</implicit>
  <financial_prioritization>
    - compliance_tasks: highest priority (regulatory deadlines)
    - security_tasks: high priority (risk mitigation)
    - payment_tasks: high priority (revenue impact)
    - trading_tasks: medium priority (performance impact)
    - general_tasks: standard priority
  </financial_prioritization>
</task_selection>

<instructions>
  ACTION: Identify tasks to execute with financial domain classification
  ANALYZE: Financial compliance requirements and regulatory constraints
  PRIORITIZE: Tasks based on financial domain risk and impact
  DEFAULT: Select next uncompleted parent task if not specified
  CONFIRM: Task selection with user and domain classification
</instructions>

</step>

<step number="2" name="financial_context_analysis">

### Step 2: Financial Context & Compliance Analysis

<step_metadata>
  <reads_always>
    - spec tasks.md
    - financial compliance requirements
  </reads_always>
  <reads_conditionally>
    - @.agent-os/product/mission-lite.md (if not already in context)
    - spec-lite.md (if not already in context)
    - sub-specs/technical-spec.md (if not already in context)
    - financial compliance documentation
  </reads_conditionally>
  <purpose>comprehensive context for financial task execution</purpose>
</step_metadata>

<financial_context_gathering>
  <compliance_analysis>
    - PCI DSS requirements for payment processing tasks
    - SOX compliance for financial reporting tasks
    - GDPR/CCPA requirements for data handling tasks
    - AML/KYC requirements for customer onboarding tasks
  </compliance_analysis>
  <risk_assessment>
    - Security risk evaluation for task execution
    - Regulatory compliance risk assessment
    - Operational risk impact analysis
    - Reputational risk consideration
  </risk_assessment>
  <domain_expertise_allocation>
    - Identify required financial domain specialists
    - Allocate appropriate Agent OS financial agents
    - Coordinate MCP server integration requirements
    - Plan multi-agent collaboration patterns
  </domain_expertise_allocation>
</financial_context_gathering>

<instructions>
  IF has_context_fetcher:
    USE: @agent:context-fetcher for each file not in context:
    - REQUEST: "Get product pitch from mission-lite.md"
    - REQUEST: "Get spec summary from spec-lite.md" 
    - REQUEST: "Get technical approach from technical-spec.md"
    - REQUEST: "Get financial compliance requirements"
    PROCESS: Returned information with financial domain focus
  ELSE:
    PROCEED: To conditional loading below with financial emphasis

  IF has_security:
    USE: @agent:dwaybank-security
    REQUEST: "Analyze security and compliance requirements for task execution"
    PROCESS: Security and compliance context
  
  ANALYZE: Financial domain requirements and constraints
  CLASSIFY: Tasks by financial domain and regulatory requirements
  ALLOCATE: Appropriate financial domain agents
</instructions>

<conditional-block context-check="fallback-context-loading">
IF NOT using context-fetcher agent:
  READ: The following fallback context loading with financial focus

<conditional_loading>
  <mission_lite>
    IF NOT already in context:
      READ @.agent-os/product/mission-lite.md
      FOCUS: Financial mission and compliance objectives
  </mission_lite>
  <spec_lite>
    IF NOT already in context:
      READ spec-lite.md from spec folder
      FOCUS: Financial feature specifications
  </spec_lite>
  <technical_spec>
    IF NOT already in context:
      READ sub-specs/technical-spec.md
      FOCUS: Financial technical requirements
  </technical_spec>
  <compliance_documentation>
    IF NOT already in context:
      READ financial compliance documentation
      FOCUS: Regulatory requirements and constraints
  </compliance_documentation>
</conditional_loading>
</conditional-block>

</step>

<step number="3" name="financial_environment_validation">

### Step 3: Financial Development Environment Validation

<step_metadata>
  <checks>
    - running development server
    - financial service dependencies
    - database connections
    - external API availability
  </checks>
  <prevents>port conflicts, service disruption, data corruption</prevents>
</step_metadata>

<financial_environment_check>
  <service_validation>
    - Validate database connections (PostgreSQL, Redis)
    - Check external financial service APIs
    - Verify payment gateway connectivity
    - Validate authentication service availability
  </service_validation>
  <security_validation>
    - Verify encryption service availability
    - Check security certificate validity
    - Validate secure communication channels
    - Confirm audit logging functionality
  </security_validation>
  <compliance_validation>
    - Verify compliance monitoring tools
    - Check audit trail functionality
    - Validate data retention policies
    - Confirm regulatory reporting capabilities
  </compliance_validation>
</financial_environment_check>

<instructions>
  ACTION: Check financial development environment health
  VALIDATE: All financial service dependencies
  VERIFY: Security and compliance tool availability
  CHECK: Database and external API connectivity
  
  IF environment_issues_detected:
    RESOLVE: Critical issues before proceeding
    ESCALATE: Unresolvable issues to operations team
  
  IF development_server_running:
    ASK: User permission to shut down if necessary
    COORDINATE: Service shutdown with minimal disruption
</instructions>

</step>

<step number="4" name="financial_git_workflow">

### Step 4: Financial Git Workflow & Compliance

<step_metadata>
  <manages>git branches with financial compliance</manages>
  <ensures>proper isolation and audit trail</ensures>
</step_metadata>

<financial_git_management>
  <branch_naming_standards>
    - Format: feature/[domain]/[feature-name]
    - Examples: feature/payments/pci-compliance, feature/trading/real-time-data
    - Compliance: Include regulatory tags where applicable
  </branch_naming_standards>
  <commit_standards>
    - Include compliance tags in commit messages
    - Reference regulatory requirements
    - Include security review markers
    - Maintain audit trail compliance
  </commit_standards>
</financial_git_management>

<instructions>
  IF has_git_workflow:
    USE: @agent:git-workflow
    REQUEST: "Check and manage branch for financial spec: [SPEC_FOLDER]
              - Create branch with financial naming standards
              - Switch to correct branch for financial development
              - Handle uncommitted changes with compliance consideration
              - Include regulatory compliance markers"
    WAIT: For branch setup completion
  ELSE:
    PROCEED: To manual branch management with financial standards

  ENSURE: Branch naming follows financial development standards
  VALIDATE: Compliance with audit trail requirements
  DOCUMENT: Branch creation and management activities
</instructions>

<conditional-block context-check="manual-financial-branch-management">
IF NOT using git-workflow agent:
  READ: The following manual financial branch management

<financial_branch_logic>
  <case_a>
    <condition>current branch matches financial spec name</condition>
    <action>PROCEED immediately with compliance validation</action>
  </case_a>
  <case_b>
    <condition>current branch is main/staging/review</condition>
    <action>CREATE new financial branch and PROCEED</action>
  </case_b>
  <case_c>
    <condition>current branch is different financial feature</condition>
    <action>ASK permission to create new financial branch</action>
  </case_c>
</financial_branch_logic>

<instructions>
  ACTION: Check current git branch against financial standards
  EVALUATE: Which financial branch case applies
  EXECUTE: Appropriate financial branch action
  VALIDATE: Compliance with financial development workflow
  WAIT: Only for case C approval with compliance consideration
</instructions>
</conditional-block>

</step>

<step number="5" name="financial_task_execution_loop">

### Step 5: Financial Task Execution with Agent Coordination

<step_metadata>
  <executes>financial parent tasks and subtasks</executes>
  <uses>multi-agent financial coordination</uses>
  <continues>until all financial tasks complete with compliance</continues>
</step_metadata>

<financial_execution_flow>
  COORDINATE with appropriate financial agents based on task domain:
  
  FOR each financial_task assigned in Step 1:
    DETERMINE: Required financial domain agents
    COORDINATE: Multi-agent execution pattern
    EXECUTE: Task with financial compliance validation
    VALIDATE: Security and regulatory compliance
    UPDATE: tasks.md status with compliance markers
    AUDIT: Task execution for regulatory requirements
  END FOR
</financial_execution_flow>

<financial_agent_coordination>
  <payment_processing_tasks>
    PRIMARY: dwaybank-backend (payment API development)
    SECONDARY: dwaybank-security (PCI DSS compliance)
    VALIDATION: dwaybank-qa (payment testing)
    MCP: Context7 (payment standards), Magic (payment UI)
  </payment_processing_tasks>
  
  <trading_system_tasks>
    PRIMARY: dwaybank-performance (low-latency optimization)
    SECONDARY: dwaybank-backend (trading API)
    VALIDATION: dwaybank-qa (performance testing)
    MCP: Sequential (complex trading logic), Playwright (E2E trading)
  </trading_system_tasks>
  
  <compliance_tasks>
    PRIMARY: dwaybank-security (regulatory compliance)
    SECONDARY: dwaybank-qa (compliance testing)
    DOCUMENTATION: dwaybank-scribe (compliance documentation)
    MCP: Context7 (regulatory standards), Sequential (compliance analysis)
  </compliance_tasks>
  
  <frontend_tasks>
    PRIMARY: dwaybank-frontend (financial UI development)
    SECONDARY: dwaybank-design (financial interface design)
    VALIDATION: dwaybank-qa (UI/UX testing)
    MCP: Magic (financial components), Playwright (UI testing)
  </frontend_tasks>
</financial_agent_coordination>

<instructions>
  ACTION: Execute financial tasks with appropriate agent coordination
  COORDINATE: Multi-agent patterns based on financial domain
  VALIDATE: Each task against financial compliance requirements
  MONITOR: Task execution for security and regulatory compliance
  UPDATE: Task status with compliance validation markers
  AUDIT: All execution activities for regulatory reporting
  
  FOR payment_tasks:
    ENSURE: PCI DSS compliance throughout execution
    VALIDATE: Payment security and data protection
    
  FOR trading_tasks:
    ENSURE: Performance targets and reliability standards
    VALIDATE: Market data integrity and latency requirements
    
  FOR compliance_tasks:
    ENSURE: Regulatory requirement satisfaction
    VALIDATE: Audit trail and reporting capabilities
</instructions>

</step>

<step number="6" name="financial_testing_validation">

### Step 6: Financial Testing & Compliance Validation

<step_metadata>
  <runs>comprehensive financial test suite</runs>
  <ensures>regulatory compliance and security standards</ensures>
</step_metadata>

<financial_testing_framework>
  <security_testing>
    - PCI DSS compliance validation
    - Security vulnerability scanning
    - Penetration testing for financial interfaces
    - Data encryption and protection validation
  </security_testing>
  <compliance_testing>
    - SOX internal controls testing
    - GDPR privacy compliance validation
    - AML/KYC process testing
    - Regulatory reporting accuracy testing
  </compliance_testing>
  <performance_testing>
    - Financial transaction performance validation
    - Trading system latency testing
    - Load testing for peak financial periods
    - Disaster recovery and business continuity testing
  </performance_testing>
  <integration_testing>
    - Payment gateway integration testing
    - Banking API integration validation
    - Third-party financial service testing
    - Cross-system data integrity validation
  </integration_testing>
</financial_testing_framework>

<instructions>
  IF has_test_runner:
    USE: @agent:test-runner
    REQUEST: "Run comprehensive financial test suite with compliance validation"
    COORDINATE: With dwaybank-qa for financial domain testing
    VALIDATE: All financial compliance and security requirements
    WAIT: For complete test-runner analysis and validation
    PROCESS: Fix any reported failures with compliance priority
    REPEAT: Until all tests pass and compliance is validated
  ELSE:
    PROCEED: To fallback financial test execution

  IF has_qa:
    USE: @agent:dwaybank-qa
    REQUEST: "Execute financial quality assurance testing:
              - Security and compliance validation
              - Financial accuracy and integrity testing
              - Performance and reliability validation
              - Integration and end-to-end testing"
    COORDINATE: Multi-agent testing with security and performance specialists
</instructions>

<conditional-block context-check="fallback-financial-test-execution">
IF NOT using test-runner agent:
  READ: The following fallback financial test execution

<fallback_financial_testing>
  <test_execution_priority>
    <order>
      1. Security and compliance tests (highest priority)
      2. Financial accuracy and integrity tests
      3. Performance and reliability tests
      4. Integration and system tests
      5. User acceptance and usability tests
    </order>
    <requirement>100% pass rate for compliance-critical tests</requirement>
  </test_execution_priority>

  <financial_failure_handling>
    <action>troubleshoot and fix with financial domain expertise</action>
    <priority>compliance and security failures get immediate attention</priority>
    <escalation>complex issues escalated to appropriate financial domain agents</escalation>
  </financial_failure_handling>

  <instructions>
    ACTION: Run complete financial test suite with compliance focus
    VERIFY: All tests pass including financial compliance validation
    FIX: Any test failures with appropriate financial domain expertise
    PRIORITIZE: Security and compliance test failures
    BLOCK: Do not proceed with failing compliance-critical tests
  </instructions>
</fallback_financial_testing>
</conditional-block>

</step>

<step number="7" name="financial_git_workflow_completion">

### Step 7: Financial Git Workflow & Compliance Documentation

<step_metadata>
  <creates>
    - compliance-validated git commit
    - github push with audit trail
    - pull request with financial domain review
  </creates>
</step_metadata>

<financial_git_completion>
  <commit_compliance>
    - Include compliance validation markers
    - Reference regulatory requirements satisfied
    - Document security reviews completed
    - Include financial domain expert approvals
  </commit_compliance>
  <pull_request_standards>
    - Financial domain-specific PR template
    - Compliance checklist completion
    - Security review requirements
    - Financial domain expert review assignments
  </pull_request_standards>
</financial_git_completion>

<instructions>
  IF has_git_workflow:
    USE: @agent:git-workflow
    REQUEST: "Complete financial git workflow for [SPEC_NAME] feature:
              - Spec: [SPEC_FOLDER_PATH]
              - Changes: All modified files with compliance validation
              - Target: main branch with financial review requirements
              - Description: [SUMMARY_OF_FINANCIAL_FEATURES_IMPLEMENTED]
              - Compliance: Include all regulatory compliance markers"
    WAIT: For workflow completion
    PROCESS: Save PR URL for financial audit trail
  ELSE:
    PROCEED: To manual financial git workflow

  ENSURE: All financial compliance requirements documented
  VALIDATE: Commit messages include regulatory references
  ASSIGN: Appropriate financial domain reviewers to PR
</instructions>

<conditional-block context-check="manual-financial-git-workflow">
IF NOT using git-workflow agent:
  READ: The following manual financial git workflow

<financial_commit_process>
  <commit>
    <message>financial domain descriptive summary with compliance markers</message>
    <format>conventional commits with financial domain tags</format>
    <compliance>include regulatory requirement references</compliance>
  </commit>
  <push>
    <target>financial spec branch</target>
    <remote>origin with audit trail</remote>
  </push>
  <pull_request>
    <title>financial domain descriptive PR title</title>
    <description>financial functionality recap with compliance validation</description>
    <reviewers>assign appropriate financial domain experts</reviewers>
  </pull_request>
</financial_commit_process>

<financial_pr_template>
  ## Financial Domain Summary
  
  [BRIEF_DESCRIPTION_OF_FINANCIAL_CHANGES]
  
  ## Compliance Validation
  
  - [ ] PCI DSS compliance validated for payment processing
  - [ ] SOX controls implemented for financial reporting
  - [ ] GDPR privacy requirements satisfied
  - [ ] Security review completed by dwaybank-security
  - [ ] Performance targets validated for financial operations
  
  ## Financial Changes Made
  
  - [FINANCIAL_CHANGE_1]
  - [FINANCIAL_CHANGE_2]
  
  ## Testing & Validation
  
  - [FINANCIAL_TEST_COVERAGE]
  - All financial compliance tests passing ✓
  - Security validation completed ✓
  - Performance benchmarks satisfied ✓

  ## Regulatory Compliance
  
  - [REGULATORY_REQUIREMENTS_SATISFIED]
  - [COMPLIANCE_DOCUMENTATION_COMPLETED]
</financial_pr_template>

<instructions>
  ACTION: Commit all financial changes with compliance documentation
  PUSH: To GitHub on financial spec branch with audit trail
  CREATE: Pull request with financial domain review requirements
  ASSIGN: Financial domain expert reviewers based on task type
</instructions>
</conditional-block>

</step>

<step number="8" name="financial_compliance_audit">

### Step 8: Financial Compliance Audit & Documentation

<step_metadata>
  <condition>mandatory for all financial domain tasks</condition>
  <creates>compliance audit trail and regulatory documentation</creates>
</step_metadata>

<financial_compliance_audit>
  <audit_trail_creation>
    - Document all financial compliance validations performed
    - Record security reviews and approvals
    - Capture performance testing results for financial operations
    - Document regulatory requirement satisfaction
  </audit_trail_creation>
  <regulatory_documentation>
    - Generate compliance reports for regulatory filing
    - Create audit evidence for financial controls
    - Document security measures and data protection
    - Prepare regulatory change notifications
  </regulatory_documentation>
  <stakeholder_notification>
    - Notify compliance team of regulatory changes
    - Alert security team of new financial features
    - Inform risk management of operational changes
    - Update financial operations team on new capabilities
  </stakeholder_notification>
</financial_compliance_audit>

<instructions>
  MANDATORY: Execute compliance audit for all financial tasks
  
  IF has_security:
    USE: @agent:dwaybank-security
    REQUEST: "Generate financial compliance audit report:
              - Document all security validations completed
              - Record regulatory compliance confirmations
              - Create audit trail for financial changes
              - Generate compliance evidence for regulatory filing"
  
  DOCUMENT: All compliance activities and validations
  GENERATE: Regulatory compliance reports and evidence
  NOTIFY: Relevant stakeholders of financial system changes
  ARCHIVE: Compliance documentation for regulatory audit
</instructions>

</step>

<step number="9" name="financial_completion_notification">

### Step 9: Financial Task Completion Notification

<step_metadata>
  <plays>system sound for financial task completion</plays>
  <alerts>financial stakeholders of completion</alerts>
</step_metadata>

<financial_notification_command>
  afplay /System/Library/Sounds/Glass.aiff
</financial_notification_command>

<financial_stakeholder_notification>
  <internal_notification>
    - Development team task completion
    - QA team testing completion
    - Security team compliance validation
    - Operations team deployment readiness
  </internal_notification>
  <compliance_notification>
    - Compliance team regulatory satisfaction
    - Risk management operational impact
    - Audit team evidence availability
    - Legal team regulatory filing updates
  </compliance_notification>
</financial_stakeholder_notification>

<instructions>
  ACTION: Play financial task completion sound
  NOTIFY: All relevant financial stakeholders
  UPDATE: Financial task tracking systems
  GENERATE: Completion reports for financial operations
</instructions>

</step>

<step number="10" name="financial_completion_summary">

### Step 10: Financial Completion Summary & Audit Trail

<step_metadata>
  <creates>comprehensive financial summary with compliance markers</creates>
  <format>financial industry structured reporting with emojis</format>
</step_metadata>

<financial_summary_template>
  ## 💰 Financial Features Implemented
  
  1. **[FINANCIAL_FEATURE_1]** - [DESCRIPTION_WITH_COMPLIANCE_STATUS]
  2. **[FINANCIAL_FEATURE_2]** - [DESCRIPTION_WITH_COMPLIANCE_STATUS]
  
  ## 🛡️ Security & Compliance Validation
  
  - **PCI DSS Compliance**: ✅ Validated for payment processing features
  - **SOX Controls**: ✅ Implemented for financial reporting features
  - **GDPR Privacy**: ✅ Satisfied for data handling features
  - **Security Review**: ✅ Completed by dwaybank-security agent
  - **Performance Validation**: ✅ Financial transaction targets satisfied
  
  ## ⚠️ Issues Encountered
  
  [ONLY_IF_APPLICABLE]
  - **[FINANCIAL_ISSUE_1]** - [DESCRIPTION_AND_RESOLUTION]
  
  ## 🧪 Financial Testing Completed
  
  [ONLY_IF_APPLICABLE]
  1. [FINANCIAL_TEST_STEP_1]
  2. [FINANCIAL_TEST_STEP_2]
  
  ## 📊 Compliance Metrics
  
  - **Test Coverage**: [PERCENTAGE]% (financial compliance tests)
  - **Security Score**: [SCORE]/100 (security validation rating)
  - **Performance**: [METRICS] (financial transaction performance)
  - **Regulatory Compliance**: ✅ All requirements satisfied
  
  ## 📦 Pull Request & Audit Trail
  
  View PR: [GITHUB_PR_URL]
  Compliance Documentation: [COMPLIANCE_DOC_LINKS]
  Audit Trail: [AUDIT_TRAIL_REFERENCES]
</financial_summary_template>

<financial_summary_sections>
  <required>
    - financial functionality recap with compliance status
    - security and compliance validation summary
    - pull request info with audit trail
    - regulatory compliance confirmation
  </required>
  <conditional>
    - issues encountered (if any) with financial impact
    - testing instructions (if testable financial features)
    - compliance metrics and performance data
    - stakeholder notifications and approvals
  </conditional>
</financial_summary_sections>

<instructions>
  ACTION: Create comprehensive financial completion summary
  INCLUDE: All required financial and compliance sections
  ADD: Conditional sections if applicable to financial domain
  FORMAT: Use emoji headers for financial industry scannability
  VALIDATE: All compliance confirmations and audit trail references
  DISTRIBUTE: Summary to appropriate financial stakeholders
</instructions>

</step>

</process_flow>

## Financial Domain Error Handling

<financial_error_protocols>
  <compliance_violations>
    - IMMEDIATE: Stop execution for critical compliance violations
    - ESCALATE: Compliance team notification for regulatory issues
    - DOCUMENT: All compliance violations in audit trail
    - REMEDIATE: Compliance violations before proceeding
    - VALIDATE: Remediation with appropriate financial domain agents
  </compliance_violations>
  <security_failures>
    - IMMEDIATE: Security team notification for critical failures
    - ISOLATE: Potentially compromised systems and data
    - INVESTIGATE: Root cause with dwaybank-security agent
    - REMEDIATE: Security issues with expert guidance
    - VALIDATE: Security fixes with comprehensive testing
  </security_failures>
  <financial_accuracy_issues>
    - IMMEDIATE: Stop processing for financial calculation errors
    - VALIDATE: Financial logic with domain experts
    - TEST: Financial accuracy with comprehensive test suite
    - AUDIT: Financial calculations for regulatory compliance
    - DOCUMENT: All financial accuracy validations
  </financial_accuracy_issues>
  <performance_degradation>
    - MONITOR: Financial transaction performance continuously
    - ALERT: Performance degradation below financial thresholds
    - OPTIMIZE: Performance with dwaybank-performance agent
    - VALIDATE: Performance improvements with load testing
    - REPORT: Performance metrics to financial operations
  </performance_degradation>
</financial_error_protocols>

## Financial Quality Gates

<financial_quality_checklist>
  <verify>
    - [ ] Financial task implementation complete with domain validation
    - [ ] All financial compliance tests passing (PCI DSS, SOX, GDPR)
    - [ ] Security validation completed by dwaybank-security
    - [ ] Performance targets satisfied for financial operations
    - [ ] tasks.md updated with compliance markers
    - [ ] Code committed and pushed with audit trail
    - [ ] Pull request created with financial domain reviewers
    - [ ] Compliance audit completed and documented
    - [ ] Financial stakeholders notified of completion
    - [ ] Regulatory documentation generated and archived
  </verify>
</financial_quality_checklist>

## Agent Coordination Matrix

### Financial Domain Agent Allocation
```yaml
Payment Processing:
  primary: dwaybank-backend
  security: dwaybank-security (PCI DSS compliance)
  testing: dwaybank-qa
  documentation: dwaybank-scribe

Trading Systems:
  primary: dwaybank-performance
  backend: dwaybank-backend
  testing: dwaybank-qa
  monitoring: taskmaster-monitor

Compliance Features:
  primary: dwaybank-security
  testing: dwaybank-qa
  documentation: dwaybank-scribe
  architecture: dwaybank-architect

Frontend Financial Interfaces:
  primary: dwaybank-frontend  
  design: dwaybank-design
  testing: dwaybank-qa
  accessibility: dwaybank-frontend
```

### MCP Server Financial Integration
```yaml
Context7:
  financial_frameworks: "Banking APIs, Payment standards, Regulatory docs"
  compliance_standards: "PCI DSS, SOX, GDPR guidelines"
  
Sequential:
  complex_analysis: "Risk assessment, Compliance validation"
  financial_logic: "Trading algorithms, Payment processing"
  
Magic:
  financial_ui: "Payment forms, Trading dashboards"
  compliance_interfaces: "KYC forms, Audit interfaces"
  
Playwright:
  financial_testing: "Payment flows, Trading performance"
  compliance_testing: "Regulatory validation, Security testing"
```

---

**Document Type**: Agent OS Instruction  
**Domain**: Financial Task Execution  
**Compliance Level**: Enterprise Financial Standards  
**Last Updated**: January 2025