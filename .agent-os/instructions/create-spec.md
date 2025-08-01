---
description: Financial technical specification creation with Agent OS integration
globs:
alwaysApply: false
version: 2.0
encoding: UTF-8
---

# Financial Technical Specification Creation

<ai_meta>
  <rules>Financial domain expertise required, compliance validation mandatory, multi-agent coordination essential</rules>
  <format>UTF-8, LF, 2-space indent, financial standards compliance</format>
</ai_meta>

## Overview

Create comprehensive technical specifications for financial features using DwayBank Agent OS framework with specialized financial agents, MCP server integration, and regulatory compliance validation.

<agent_detection>
  <check_once>
    AT START OF PROCESS:
    SET has_architect = (dwaybank-architect agent available)
    SET has_security = (dwaybank-security agent available)
    SET has_researcher = (taskmaster-researcher agent available)
    SET has_mcp_coordinator = (mcp-coordinator agent available)
    USE these flags throughout specification creation
  </check_once>
</agent_detection>

<process_flow>

<step number="1" name="requirements_gathering">

### Step 1: Requirements Gathering & Analysis

<step_metadata>
  <inputs>
    - feature_name: string (required)
    - business_context: string (optional)
    - regulatory_requirements: array[string] (optional)
    - technical_constraints: object (optional)
  </inputs>
  <agents_involved>
    - taskmaster-researcher (primary)
    - dwaybank-architect (secondary)
    - dwaybank-security (compliance)
  </agents_involved>
</step_metadata>

<requirements_analysis>
  <business_analysis>
    - Feature purpose and business value
    - Target user personas and use cases
    - Success metrics and KPIs
    - Revenue/cost impact analysis
  </business_analysis>
  <technical_analysis>
    - Integration points with existing systems
    - Performance requirements and constraints
    - Scalability and reliability requirements
    - Data flow and architecture implications  
  </technical_analysis>
  <compliance_analysis>
    - Regulatory compliance requirements (PCI DSS, SOX, GDPR, AML/KYC)
    - Security and privacy considerations
    - Audit trail and reporting requirements
    - Industry standards and best practices
  </compliance_analysis>
</requirements_analysis>

<instructions>
  IF has_researcher:
    USE: @agent:taskmaster-researcher
    REQUEST: "Analyze requirements for [FEATURE_NAME]:
              - Business context and user needs analysis
              - Technical requirements and constraints
              - Regulatory compliance requirements
              - Integration impact assessment"
    PROCESS: Research findings and requirements matrix
  ELSE:
    GATHER: Requirements manually through stakeholder interviews
    DOCUMENT: Requirements in structured format
  
  VALIDATE: Requirements completeness and feasibility
  IDENTIFY: Key stakeholders and approval requirements
</instructions>

</step>

<step number="2" name="architecture_design">

### Step 2: Technical Architecture Design

<step_metadata>
  <inputs>
    - requirements_analysis: object (from step 1)
    - existing_architecture: context (system knowledge)
    - performance_targets: object (from requirements)
  </inputs>
  <agents_involved>
    - dwaybank-architect (primary)
    - dwaybank-backend (technical input)
    - dwaybank-security (security review)
  </agents_involved>
</step_metadata>

<architecture_design>
  <system_design>
    - High-level architecture and component design
    - Database schema and data model design
    - API design and service interfaces
    - Integration patterns and data flows
  </system_design>
  <scalability_design>
    - Performance targets and optimization strategies
    - Caching strategies and data partitioning
    - Load balancing and redundancy planning
    - Monitoring and observability requirements
  </scalability_design>
  <security_design>
    - Authentication and authorization mechanisms
    - Data encryption and protection strategies
    - Audit logging and compliance tracking
    - Threat modeling and risk mitigation
  </security_design>
</architecture_design>

<instructions>
  IF has_architect:
    USE: @agent:dwaybank-architect
    REQUEST: "Design technical architecture for [FEATURE_NAME]:
              - System architecture and component design
              - Database design and data modeling
              - API design and integration patterns
              - Scalability and performance optimization
              - Include compliance and security considerations"
    COORDINATE: With dwaybank-backend for implementation details
    COORDINATE: With dwaybank-security for security validation
  ELSE:
    DESIGN: Architecture manually with technical team input
    FOCUS: Scalability, security, and maintainability
  
  DOCUMENT: Architecture decisions and rationale
  CREATE: Technical diagrams and specifications
  VALIDATE: Architecture against requirements and constraints
</instructions>

</step>

<step number="3" name="security_compliance_review">

### Step 3: Security & Compliance Validation

<step_metadata>
  <inputs>
    - architecture_design: object (from step 2)
    - regulatory_requirements: array[string] (from step 1)
    - security_constraints: object (from requirements)
  </inputs>
  <agents_involved>
    - dwaybank-security (primary)
    - dwaybank-qa (validation)
    - dwaybank-architect (consultation)
  </agents_involved>
</step_metadata>

<security_compliance_validation>
  <threat_modeling>
    - Identify potential security threats and attack vectors
    - Assess risk levels and impact scenarios
    - Design security controls and mitigation strategies
    - Validate security architecture and implementations
  </threat_modeling>
  <compliance_validation>
    - PCI DSS compliance for payment processing
    - SOX compliance for financial reporting
    - GDPR/CCPA compliance for data privacy
    - AML/KYC compliance for customer onboarding
    - Industry-specific regulatory requirements
  </compliance_validation>
  <audit_preparation>
    - Audit trail design and implementation
    - Compliance reporting and documentation
    - Security testing and validation procedures
    - Incident response and recovery planning
  </audit_preparation>
</security_compliance_validation>

<instructions>
  IF has_security:
    USE: @agent:dwaybank-security
    REQUEST: "Conduct security and compliance review for [FEATURE_NAME]:
              - Threat modeling and risk assessment
              - Security controls and mitigation strategies
              - Regulatory compliance validation
              - Audit trail and reporting requirements
              - Security testing requirements"
    COORDINATE: With dwaybank-qa for testing requirements
    VALIDATE: All security and compliance requirements
  ELSE:
    CONDUCT: Security review with security team
    FOCUS: Financial industry security standards
  
  DOCUMENT: Security requirements and controls
  CREATE: Compliance checklist and validation procedures
  APPROVE: Security architecture before proceeding
</instructions>

</step>

<step number="4" name="implementation_planning">

### Step 4: Implementation Planning & Resource Allocation

<step_metadata>
  <inputs>
    - architecture_design: object (validated)
    - security_requirements: object (from step 3)
    - resource_constraints: object (from requirements)
  </inputs>
  <agents_involved>
    - taskmaster-project-manager (primary)
    - dwaybank-architect (technical planning)
    - taskmaster-resource-manager (resource allocation)
  </agents_involved>
</step_metadata>

<implementation_planning>
  <development_phases>
    - Break down implementation into manageable phases
    - Define deliverables and success criteria
    - Identify dependencies and critical path
    - Estimate effort and timeline for each phase
  </development_phases>
  <resource_allocation>
    - Identify required skill sets and team composition
    - Allocate development, testing, and DevOps resources
    - Plan infrastructure and tooling requirements
    - Coordinate with existing project commitments
  </resource_allocation>
  <risk_management>
    - Identify technical and business risks
    - Develop risk mitigation strategies
    - Plan contingency approaches for high-risk areas
    - Establish monitoring and early warning systems
  </risk_management>
</implementation_planning>

<instructions>
  COORDINATE: Implementation planning with project management
  BREAKDOWN: Feature into development phases and tasks
  ESTIMATE: Effort, timeline, and resource requirements
  IDENTIFY: Dependencies, risks, and mitigation strategies
  
  CREATE: Detailed implementation roadmap
  ASSIGN: Agent responsibilities and coordination patterns
  VALIDATE: Implementation plan feasibility and alignment
  APPROVE: Implementation plan with stakeholders
</instructions>

</step>

<step number="5" name="specification_documentation">

### Step 5: Technical Specification Documentation

<step_metadata>
  <inputs>
    - all_previous_steps: objects (comprehensive input)
    - documentation_standards: object (financial industry standards)
  </inputs>
  <agents_involved>
    - dwaybank-scribe (primary documentation)
    - dwaybank-architect (technical review)
    - dwaybank-security (compliance documentation)
  </agents_involved>
</step_metadata>

<specification_documentation>
  <technical_specification>
    - Executive summary and business context
    - Technical requirements and architecture
    - API specifications and data models
    - Security and compliance requirements
    - Implementation roadmap and milestones
    - Testing and validation procedures
    - Deployment and operations procedures
  </technical_specification>
  <supporting_documentation>
    - Architecture diagrams and technical drawings
    - Database schemas and data flow diagrams
    - API documentation and integration guides
    - Security controls and compliance checklists
    - Test plans and validation procedures
    - Deployment guides and operational procedures
  </supporting_documentation>
</specification_documentation>

<instructions>
  USE: @agent:dwaybank-scribe for professional documentation
  CREATE: Comprehensive technical specification document
  INCLUDE: All architectural, security, and implementation details
  FORMAT: Professional financial industry documentation standards
  
  COORDINATE: Technical review with dwaybank-architect
  VALIDATE: Compliance documentation with dwaybank-security
  ENSURE: Documentation completeness and accuracy
  FINALIZE: Specification for stakeholder approval
</instructions>

</step>

<step number="6" name="stakeholder_review">

### Step 6: Stakeholder Review & Approval

<step_metadata>
  <inputs>
    - technical_specification: document (comprehensive)
    - stakeholder_matrix: object (approval requirements)
  </inputs>
  <agents_involved>
    - dwaybank-scribe (presentation preparation)
    - dwaybank-architect (technical Q&A)
    - dwaybank-security (compliance validation)
  </agents_involved>
</step_metadata>

<stakeholder_review>
  <review_preparation>
    - Prepare executive summary and key highlights
    - Create presentation materials for stakeholder review
    - Anticipate questions and prepare detailed responses
    - Coordinate review schedule with key stakeholders
  </review_preparation>
  <review_process>
    - Present technical specification to stakeholders
    - Address questions and concerns from reviewers
    - Incorporate feedback and requested modifications
    - Obtain formal approval signatures and documentation
  </review_process>
  <approval_documentation>
    - Document all stakeholder feedback and resolutions
    - Obtain written approval from required stakeholders
    - Version control specification with approval status
    - Communicate approval to implementation teams
  </approval_documentation>
</stakeholder_review>

<instructions>
  PREPARE: Stakeholder review materials and presentations
  SCHEDULE: Review meetings with all required stakeholders
  PRESENT: Technical specification with supporting materials
  ADDRESS: All stakeholder questions and concerns
  
  INCORPORATE: Requested changes and modifications
  OBTAIN: Formal written approval from stakeholders
  DOCUMENT: All feedback and resolution decisions
  COMMUNICATE: Approval status to implementation teams
</instructions>

</step>

<step number="7" name="specification_finalization">

### Step 7: Specification Finalization & Handoff

<step_metadata>
  <inputs>
    - approved_specification: document (stakeholder approved)
    - implementation_teams: context (development resources)
  </inputs>
  <agents_involved>
    - taskmaster-project-manager (coordination)
    - dwaybank-architect (technical handoff)
    - implementation_teams (knowledge transfer)
  </agents_involved>
</step_metadata>

<specification_finalization>
  <final_documentation>
    - Incorporate all approved changes and modifications
    - Finalize version control and change management
    - Create implementation-ready specification package
    - Prepare knowledge transfer materials for teams
  </final_documentation>
  <handoff_process>
    - Schedule technical handoff sessions with implementation teams
    - Transfer domain knowledge and technical context
    - Establish communication channels for ongoing support
    - Define change control process for specification updates
  </handoff_process>
  <monitoring_setup>
    - Establish specification compliance monitoring
    - Create implementation progress tracking mechanisms
    - Define success metrics and validation criteria
    - Set up regular review and update processes
  </monitoring_setup>
</specification_finalization>

<instructions>
  FINALIZE: All documentation and supporting materials
  PREPARE: Implementation handoff package and materials
  CONDUCT: Technical handoff sessions with implementation teams
  ESTABLISH: Communication and support channels
  
  IMPLEMENT: Change control and version management
  SETUP: Progress monitoring and compliance tracking
  DEFINE: Success metrics and validation procedures
  COMPLETE: Specification creation and approval process
</instructions>

</step>

</process_flow>

## MCP Server Integration

### Context7 Integration
```yaml
purpose: Framework documentation and best practices
usage_pattern: Research and validation
capabilities:
  - Financial framework patterns
  - Regulatory compliance standards
  - Industry best practices
  - Technical documentation templates
```

### Sequential Integration
```yaml
purpose: Complex analysis and structured reasoning
usage_pattern: Architecture design and planning
capabilities:
  - System architecture analysis
  - Risk assessment and mitigation
  - Implementation planning
  - Stakeholder coordination
```

### Magic Integration
```yaml
purpose: Documentation generation and visualization
usage_pattern: Diagram creation and documentation
capabilities:
  - Architecture diagram generation
  - Technical documentation creation
  - Presentation material development
  - Visual specification enhancement
```

## Quality Gates & Validation

### Specification Completeness
- [ ] Business requirements fully documented
- [ ] Technical architecture comprehensively designed
- [ ] Security and compliance requirements validated
- [ ] Implementation plan detailed and feasible
- [ ] Documentation meets financial industry standards
- [ ] Stakeholder approval obtained and documented

### Financial Compliance Validation
- [ ] PCI DSS requirements addressed for payment processing
- [ ] SOX compliance validated for financial reporting
- [ ] GDPR/CCPA privacy requirements incorporated
- [ ] AML/KYC compliance integrated where applicable
- [ ] Industry-specific regulations considered
- [ ] Audit trail and reporting capabilities defined

### Technical Quality Standards
- [ ] Architecture scalable and maintainable
- [ ] Performance targets realistic and measurable
- [ ] Security controls comprehensive and effective
- [ ] Integration patterns well-defined and tested
- [ ] Error handling and recovery procedures specified
- [ ] Monitoring and alerting capabilities included

## Error Handling & Contingency

### Common Issues
- **Incomplete Requirements**: Iterate requirements gathering with additional stakeholder input
- **Architecture Complexity**: Break down into simpler, manageable components
- **Compliance Conflicts**: Engage regulatory experts for clarification and resolution
- **Resource Constraints**: Adjust scope or timeline with stakeholder approval
- **Technical Feasibility**: Prototype high-risk components for validation

### Escalation Procedures
- **Technical Issues**: Escalate to dwaybank-architect for expert resolution
- **Compliance Issues**: Escalate to dwaybank-security for regulatory guidance
- **Resource Issues**: Escalate to taskmaster-resource-manager for allocation
- **Stakeholder Issues**: Escalate to taskmaster-project-manager for coordination

### Success Criteria
- **Comprehensive Specification**: All requirements, architecture, and implementation details documented
- **Stakeholder Approval**: Formal approval from all required stakeholders obtained
- **Compliance Validation**: All regulatory and security requirements validated
- **Implementation Ready**: Specification ready for development team execution
- **Quality Assurance**: Specification meets financial industry documentation standards

---

**Document Type**: Agent OS Instruction  
**Domain**: Financial Technical Specification  
**Compliance Level**: Enterprise Financial Standards  
**Last Updated**: January 2025