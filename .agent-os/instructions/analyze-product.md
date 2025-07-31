---
title: Analyze Current Product & Install Agent OS
description: Deep product analysis and Agent OS framework installation for existing financial codebases
version: 1.0.0
agents: 
  - dwaybank-architect
  - dwaybank-analyzer 
  - taskmaster-researcher
mcp_servers:
  - sequential
  - context7
compliance: PCI DSS, SOX, GDPR
---

# Analyze Current Product & Install Agent OS

<ai_meta>
  <rules>Process XML blocks sequentially, use exact templates, request missing data</rules>
  <format>UTF-8, LF, 2-space indent, no header indent</format>
  <financial_compliance>PCI DSS Level 1, SOX Section 404, GDPR Article 25</financial_compliance>
</ai_meta>

## Overview

Install Agent OS into an existing financial codebase, analyze current product state and progress, with specialized focus on financial compliance, security standards, and scalability requirements. Builds on comprehensive product planning methodologies with financial industry best practices.

<process_flow>

<step number="1" name="comprehensive_codebase_analysis">

### Step 1: Comprehensive Financial Codebase Analysis

<step_metadata>
  <action>deep financial codebase analysis</action>
  <purpose>understand current state before Agent OS installation</purpose>
  <compliance>PCI DSS requirement validation, SOX control assessment</compliance>
  <agents>dwaybank-architect, dwaybank-analyzer, dwaybank-security</agents>
</step_metadata>

<analysis_areas>
  <financial_architecture>
    - Payment processing workflows and PCI DSS compliance
    - Authentication and authorization systems (MFA, KYC, AML)
    - Database schema for financial transactions and audit trails
    - API security and rate limiting implementations
    - Regulatory compliance integrations (GDPR, SOX, AML)
  </financial_architecture>
  <technology_stack>
    - Financial frameworks in use (Apache Fineract, Blnk, Midaz)
    - Security libraries and encryption implementations
    - Database systems (PostgreSQL, Redis, time-series databases)
    - Message queues and event streaming (for audit trails)
    - Infrastructure configuration (Docker, Kubernetes, cloud providers)
  </technology_stack>
  <implementation_progress>
    - Completed financial features (authentication, payments, KYC)
    - Work in progress (wallet aggregation, risk management)
    - Authentication/authorization state and MFA implementation
    - API endpoints and financial service integrations
    - Database schema maturity and audit trail completeness
  </implementation_progress>
  <financial_compliance>
    - PCI DSS compliance level and certification status
    - SOX controls implementation and testing
    - GDPR privacy controls and data handling procedures
    - AML/KYC workflow implementation and validation
    - Financial audit trail completeness and immutability
  </financial_compliance>
  <security_posture>
    - Threat modeling and vulnerability assessment results
    - Security testing and penetration testing status
    - Encryption implementation (at rest, in transit, in processing)
    - Access controls and privilege management
    - Security monitoring and incident response capabilities
  </security_posture>
  <performance_metrics>
    - Transaction processing performance and scalability
    - API response times and throughput capabilities
    - Database performance under financial workloads
    - System reliability and uptime requirements
    - Load testing results and capacity planning
  </performance_metrics>
</analysis_areas>

<instructions>
  ACTION: Thoroughly analyze the existing financial codebase with compliance focus
  DOCUMENT: Current technologies, financial features, and compliance status
  IDENTIFY: Financial architectural decisions and regulatory requirements
  NOTE: Implementation progress and financial feature completeness
  VALIDATE: Security posture and compliance control effectiveness
</instructions>

</step>

<step number="2" name="financial_product_context">

### Step 2: Gather Financial Product Context

<step_metadata>
  <supplements>codebase analysis with business and regulatory context</supplements>
  <gathers>financial business context, regulatory requirements, and compliance obligations</gathers>
  <agents>taskmaster-researcher, dwaybank-scribe</agents>
</step_metadata>

<financial_context_questions>
  Based on my analysis of your financial codebase, I can see you're building [OBSERVED_FINANCIAL_PRODUCT_TYPE].

  To properly set up Agent OS for financial development, I need to understand:

  1. **Financial Product Vision**: What specific financial problem does this solve? Who are the target users (consumers, businesses, institutions)?

  2. **Regulatory Environment**: What specific financial regulations apply (PCI DSS level, SOX requirements, regional privacy laws)?

  3. **Current Financial Features**: Are there implemented financial features I should know about that aren't obvious from the code?

  4. **Financial Roadmap**: What financial features are planned next? Any major compliance certifications or audits planned?

  5. **Risk Management**: What risk management and compliance decisions have been made that I should document?

  6. **Financial Team Preferences**: Any financial coding standards, security practices, or compliance procedures the team follows?

  7. **Integration Requirements**: What external financial services, payment processors, or regulatory systems need integration?

  8. **Performance Requirements**: What are the transaction volume, response time, and uptime requirements for this financial system?
</financial_context_questions>

<instructions>
  ACTION: Ask user for comprehensive financial product context
  COMBINE: Merge user input with detailed codebase analysis
  PREPARE: Information for Agent OS financial product planning
  VALIDATE: Regulatory and compliance requirement completeness
</instructions>

</step>

<step number="3" name="execute_agent_os_product_planning">

### Step 3: Execute Agent OS Product Planning with Financial Context

<step_metadata>
  <uses>@.agent-os/instructions/plan-product.md</uses>
  <modifies>standard flow for existing financial products</modifies>
  <agents>dwaybank-architect, taskmaster-project-manager</agents>
</step_metadata>

<execution_parameters>
  <main_idea>[DERIVED_FROM_FINANCIAL_ANALYSIS_AND_USER_INPUT]</main_idea>
  <financial_features>[IDENTIFIED_IMPLEMENTED_AND_PLANNED_FINANCIAL_FEATURES]</financial_features>
  <compliance_requirements>[REGULATORY_AND_COMPLIANCE_OBLIGATIONS]</compliance_requirements>
  <target_users>[FROM_FINANCIAL_USER_CONTEXT]</target_users>
  <tech_stack>[DETECTED_FINANCIAL_TECH_STACK]</tech_stack>
  <security_requirements>[IDENTIFIED_FINANCIAL_SECURITY_NEEDS]</security_requirements>
</execution_parameters>

<execution_prompt>
  @.agent-os/instructions/plan-product.md

  I'm installing Agent OS into an existing financial product. Here's what I've gathered:

  **Main Idea**: [SUMMARY_FROM_FINANCIAL_ANALYSIS_AND_CONTEXT]

  **Financial Features**:
  - Already Implemented: [LIST_FROM_FINANCIAL_ANALYSIS]
  - Planned: [LIST_FROM_USER_AND_ROADMAP_ANALYSIS]

  **Target Users**: [FROM_FINANCIAL_USER_RESPONSE]

  **Tech Stack**: [DETECTED_FINANCIAL_STACK_WITH_VERSIONS]

  **Compliance Requirements**: [IDENTIFIED_REGULATORY_OBLIGATIONS]

  **Security Posture**: [CURRENT_SECURITY_IMPLEMENTATION_STATUS]

  **Performance Requirements**: [IDENTIFIED_FINANCIAL_PERFORMANCE_NEEDS]
</execution_prompt>

<instructions>
  ACTION: Execute Agent OS product planning with gathered financial information
  PROVIDE: All financial and compliance context as structured input
  ALLOW: Agent OS product planning to create .agent-os/product/ structure
  VALIDATE: Financial compliance and security requirement coverage
</instructions>

</step>

<step number="4" name="customize_financial_documentation">

### Step 4: Customize Generated Documentation for Financial Product

<step_metadata>
  <refines>generated documentation for financial product accuracy</refines>
  <ensures>financial compliance and regulatory requirement accuracy</ensures>
  <agents>dwaybank-scribe, dwaybank-security</agents>
</step_metadata>

<financial_customization_tasks>
  <roadmap_adjustment>
    - Mark completed financial features as done with compliance validation
    - Move implemented items to "Phase 0: Already Completed - Financial Foundation"
    - Adjust future phases based on actual financial development progress
    - Include regulatory milestones and compliance certification timelines
  </roadmap_adjustment>
  <financial_tech_stack_verification>
    - Verify detected financial technology versions are correct
    - Add any missing financial infrastructure details (payment processors, compliance tools)
    - Document actual financial system deployment and security setup
    - Include financial data flow and audit trail architecture
  </financial_tech_stack_verification>
  <financial_decisions_documentation>
    - Add historical financial architectural decisions that shaped current system
    - Document why certain financial technologies and compliance approaches were chosen
    - Capture any financial regulatory pivots or major compliance changes
    - Include risk management and security decision rationale
  </financial_decisions_documentation>
  <compliance_framework_documentation>
    - Document current compliance status and certification progress
    - Include regulatory requirement mapping and control implementation
    - Add financial audit trail and monitoring capabilities
    - Document security controls and threat mitigation strategies
  </compliance_framework_documentation>
</financial_customization_tasks>

<financial_roadmap_template>
  ## Phase 0: Already Completed - Financial Foundation

  The following financial features have been implemented:

  - [x] [FINANCIAL_FEATURE_1] - [DESCRIPTION_FROM_CODE_WITH_COMPLIANCE_STATUS]
  - [x] [FINANCIAL_FEATURE_2] - [DESCRIPTION_FROM_CODE_WITH_COMPLIANCE_STATUS]
  - [x] [FINANCIAL_FEATURE_3] - [DESCRIPTION_FROM_CODE_WITH_COMPLIANCE_STATUS]

  ## Phase 1: Current Financial Development

  - [ ] [IN_PROGRESS_FINANCIAL_FEATURE] - [DESCRIPTION_WITH_COMPLIANCE_REQUIREMENTS]

  ## Financial Compliance Status
  
  - **PCI DSS**: [CURRENT_COMPLIANCE_LEVEL] - [CERTIFICATION_STATUS]
  - **SOX Controls**: [IMPLEMENTATION_STATUS] - [TESTING_STATUS]
  - **GDPR/Privacy**: [COMPLIANCE_STATUS] - [PRIVACY_CONTROLS]
  - **AML/KYC**: [WORKFLOW_STATUS] - [VALIDATION_PROCEDURES]

  [CONTINUE_WITH_FINANCIAL_PHASES_INCLUDING_REGULATORY_MILESTONES]
</financial_roadmap_template>

<instructions>
  ACTION: Update generated files to reflect financial product reality
  MODIFY: Roadmap to show completed financial work with compliance status
  VERIFY: Financial tech stack matches actual implementation with security details
  ADD: Historical financial context and regulatory decisions to decisions.md
  VALIDATE: Compliance framework completeness and accuracy
</instructions>

</step>

<step number="5" name="agent_os_installation_verification">

### Step 5: Agent OS Installation Verification and Financial Validation

<step_metadata>
  <verifies>Agent OS installation completeness for financial development</verifies>
  <provides>next steps for financial team adoption</provides>
  <agents>dwaybank-architect, taskmaster-monitor</agents>
</step_metadata>

<financial_verification_checklist>
  - [ ] .agent-os/product/ directory created with financial product documentation
  - [ ] All financial product documentation reflects actual codebase and compliance status
  - [ ] Roadmap shows completed and planned financial features accurately
  - [ ] Financial tech stack matches installed dependencies and security implementations
  - [ ] Compliance requirements and regulatory obligations documented
  - [ ] Security posture and threat mitigation strategies captured
  - [ ] Financial performance requirements and scalability plans included
  - [ ] Agent OS financial workflow instructions customized for product
</financial_verification_checklist>

<financial_summary_template>
  ## ✅ Agent OS Successfully Installed for Financial Development

  I've analyzed your [FINANCIAL_PRODUCT_TYPE] codebase and set up Agent OS with comprehensive financial development capabilities.

  ### What I Found

  - **Financial Tech Stack**: [SUMMARY_OF_DETECTED_FINANCIAL_STACK]
  - **Completed Financial Features**: [COUNT] features already implemented with compliance status
  - **Security Posture**: [DETECTED_SECURITY_PATTERNS_AND_COMPLIANCE_LEVEL]
  - **Current Phase**: [IDENTIFIED_FINANCIAL_DEVELOPMENT_STAGE]
  - **Compliance Status**: [REGULATORY_COMPLIANCE_SUMMARY]

  ### What Was Created

  - ✓ Financial product documentation in `.agent-os/product/`
  - ✓ Roadmap with completed financial work in Phase 0
  - ✓ Financial tech stack reflecting actual dependencies and security
  - ✓ 18 specialized financial development agents configured
  - ✓ MCP server integrations for Context7, Sequential, Magic, Playwright, GitHub
  - ✓ Financial compliance workflows and security templates
  - ✓ TaskMaster coordination patterns for financial project management

  ### Available Financial Agents

  **Core Financial Development**:
  - `dwaybank-architect`: Financial systems architecture and scalability
  - `dwaybank-security`: Threat modeling, compliance, and vulnerability assessment
  - `dwaybank-backend`: Financial API development and reliability engineering
  - `dwaybank-frontend`: Financial UI/UX and accessibility compliance

  **Specialized Financial Operations**:
  - `dwaybank-performance`: High-frequency trading and optimization
  - `dwaybank-analyzer`: Root cause analysis for financial systems
  - `dwaybank-qa`: Financial accuracy validation and compliance testing
  - `dwaybank-devops`: Financial infrastructure and deployment automation

  **Financial Compliance & Documentation**:
  - `dwaybank-scribe`: Financial documentation and regulatory compliance
  - `dwaybank-mentor`: Financial domain knowledge transfer and training

  ### Next Steps

  1. Review the generated financial documentation in `.agent-os/product/`
  2. Customize financial workflows and compliance procedures as needed
  3. See the Agent OS README for financial development usage instructions
  4. Start using Agent OS for your next financial feature:
     ```
     @.agent-os/instructions/create-spec.md "Payment Processing Enhancement"
     ```
  5. Execute financial development tasks:
     ```
     @.agent-os/instructions/execute-tasks.md
     ```

  Your financial codebase is now Agent OS-enabled with world-class financial development capabilities! 🏦🚀

  ### Financial Compliance Ready
  
  - ✅ **PCI DSS**: Payment card industry compliance workflows
  - ✅ **SOX**: Financial reporting and internal controls
  - ✅ **GDPR/CCPA**: Privacy and data protection compliance
  - ✅ **AML/KYC**: Anti-money laundering and customer verification
  - ✅ **Security**: Threat modeling and vulnerability management
</financial_summary_template>

<instructions>
  ACTION: Verify all Agent OS financial components are correctly installed
  SUMMARIZE: What was found and created with financial compliance focus
  PROVIDE: Clear next steps for financial development team adoption
  VALIDATE: Financial workflow and compliance template availability
</instructions>

</step>

</process_flow>

## Financial Error Handling

<financial_error_scenarios>
  <scenario name="compliance_uncertainty">
    <condition>Cannot determine regulatory requirements or compliance status</condition>
    <action>Request detailed compliance and regulatory context from user</action>
    <validation>Verify regulatory requirement completeness before proceeding</validation>
  </scenario>
  <scenario name="security_posture_unclear">
    <condition>Security implementation patterns not clearly identifiable</condition>
    <action>Perform comprehensive security analysis and request security architecture details</action>
    <validation>Validate security control effectiveness and threat coverage</validation>
  </scenario>
  <scenario name="financial_tech_stack_complexity">
    <condition>Cannot determine complete financial technology dependencies</condition>
    <action>List detected financial technologies and request missing infrastructure details</action>
    <validation>Ensure all financial system components are documented</validation>
  </scenario>
  <scenario name="performance_requirements_missing">
    <condition>Financial performance and scalability requirements unclear</condition>
    <action>Request transaction volume, response time, and scalability requirements</action>
    <validation>Validate performance requirements against current implementation</validation>
  </scenario>
</financial_error_scenarios>

## Agent OS Financial Execution Summary

<final_financial_checklist>
  <verify>
    - [ ] Financial codebase analyzed thoroughly with compliance focus
    - [ ] Financial user context gathered including regulatory requirements
    - [ ] Agent OS product planning executed with financial context
    - [ ] Documentation customized for financial product accuracy
    - [ ] Financial team can adopt Agent OS workflow with compliance confidence
    - [ ] All 18 financial development agents properly configured
    - [ ] MCP server integrations validated for financial development needs
    - [ ] Financial compliance workflows and templates available
  </verify>
</final_financial_checklist>

---

**Agent OS Financial Development Framework** - Transforming financial software development with intelligent agent coordination and built-in compliance.