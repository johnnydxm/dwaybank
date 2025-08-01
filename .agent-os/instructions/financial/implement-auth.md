---
description: Financial authentication system implementation with MFA and KYC integration
globs:
alwaysApply: false
version: 2.0
encoding: UTF-8
---

# Financial Authentication System Implementation

<ai_meta>
  <rules>Financial security compliance mandatory, MFA required, KYC integration essential</rules>
  <format>UTF-8, LF, 2-space indent, financial security standards</format>
</ai_meta>

## Overview

Implement comprehensive financial authentication system with multi-factor authentication (MFA), Know Your Customer (KYC) compliance, and regulatory standards adherence using DwayBank Agent OS framework.

<agent_detection>
  <check_once>
    AT START OF PROCESS:
    SET has_security = (dwaybank-security agent available)
    SET has_backend = (dwaybank-backend agent available)
    SET has_qa = (dwaybank-qa agent available)
    SET has_architect = (dwaybank-architect agent available)
    SET has_mcp_coordinator = (mcp-coordinator agent available)
    USE these flags throughout authentication implementation
  </check_once>
</agent_detection>

<process_flow>

<step number="1" name="authentication_requirements_analysis">

### Step 1: Financial Authentication Requirements Analysis

<step_metadata>
  <inputs>
    - regulatory_requirements: array[string] (PCI DSS, SOX, GDPR, AML/KYC)
    - security_requirements: object (MFA, biometric, device)
    - compliance_framework: object (financial regulations)
  </inputs>
  <agents_involved>
    - dwaybank-security (primary)
    - dwaybank-architect (design)
    - dwaybank-backend (implementation)
  </agents_involved>
</step_metadata>

<authentication_requirements>
  <regulatory_compliance>
    - PCI DSS authentication requirements for payment processing
    - SOX access control requirements for financial reporting
    - GDPR consent management and privacy by design
    - AML/KYC identity verification and customer due diligence
    - Financial industry authentication standards and best practices
  </regulatory_compliance>
  <security_requirements>
    - Multi-factor authentication (MFA) with multiple options
    - Biometric authentication support (fingerprint, face recognition)
    - Device-based authentication and trust management
    - Risk-based authentication and adaptive security
    - Session management and secure token handling
  </security_requirements>
  <user_experience_requirements>
    - Seamless authentication flows for financial operations
    - Accessibility compliance for authentication interfaces
    - Mobile-first authentication design for banking applications
    - Progressive authentication based on risk and operation type
    - Recovery and account restoration procedures
  </user_experience_requirements>
</authentication_requirements>

<instructions>
  IF has_security:
    USE: @agent:dwaybank-security
    REQUEST: "Analyze financial authentication security requirements:
              - Regulatory compliance requirements (PCI DSS, SOX, GDPR, AML/KYC)
              - Multi-factor authentication security standards
              - Biometric authentication security considerations
              - Risk-based authentication and adaptive security
              - Session management and token security"
    COORDINATE: With dwaybank-architect for system design
    COORDINATE: With dwaybank-backend for implementation planning
  ELSE:
    ANALYZE: Authentication requirements manually with security team
    FOCUS: Financial industry security standards and compliance
  
  DOCUMENT: All authentication requirements and compliance standards
  VALIDATE: Requirements against financial industry standards
  PRIORITIZE: Security and compliance requirements for implementation
</instructions>

</step>

<step number="2" name="authentication_architecture_design">

### Step 2: Financial Authentication Architecture Design

<step_metadata>
  <inputs>
    - authentication_requirements: object (from step 1)
    - system_architecture: context (existing system)
    - security_standards: object (financial compliance)
  </inputs>
  <agents_involved>
    - dwaybank-architect (primary)
    - dwaybank-security (security design)
    - dwaybank-backend (technical implementation)
  </agents_involved>
</step_metadata>

<authentication_architecture>
  <core_authentication_system>
    - JWT-based token authentication with refresh token rotation
    - OAuth 2.0 / OpenID Connect integration for third-party authentication
    - Multi-factor authentication orchestration and management
    - Biometric authentication integration and device trust management
    - Risk-based authentication engine and adaptive security controls
  </core_authentication_system>
  <identity_management>
    - User identity lifecycle management and provisioning
    - Role-based access control (RBAC) for financial operations
    - Customer identity verification and KYC compliance
    - Identity federation and single sign-on (SSO) integration
    - Identity audit trail and compliance reporting
  </identity_management>
  <session_management>
    - Secure session creation and management
    - Session timeout and idle detection
    - Concurrent session management and device tracking
    - Session invalidation and security incident response
    - Cross-device session synchronization and security
  </session_management>
</authentication_architecture>

<instructions>
  IF has_architect:
    USE: @agent:dwaybank-architect
    REQUEST: "Design financial authentication system architecture:
              - Core authentication system with JWT and OAuth 2.0
              - Multi-factor authentication orchestration
              - Identity management and role-based access control
              - Session management and security controls
              - Integration with existing financial system architecture"
    COORDINATE: With dwaybank-security for security validation
    COORDINATE: With dwaybank-backend for implementation feasibility
  ELSE:
    DESIGN: Authentication architecture with technical team
    FOCUS: Scalability, security, and regulatory compliance
  
  DOCUMENT: Complete authentication architecture specification
  VALIDATE: Architecture against security and compliance requirements
  REVIEW: Integration points with existing financial systems
</instructions>

</step>

<step number="3" name="mfa_implementation">

### Step 3: Multi-Factor Authentication Implementation

<step_metadata>
  <inputs>
    - authentication_architecture: object (from step 2)
    - mfa_requirements: object (security standards)
    - user_experience_requirements: object (accessibility)
  </inputs>
  <agents_involved>
    - dwaybank-backend (primary)
    - dwaybank-security (security validation)
    - dwaybank-frontend (UI implementation)
  </agents_involved>
</step_metadata>

<mfa_implementation>
  <mfa_methods>
    - Time-based One-Time Password (TOTP) with authenticator apps
    - SMS-based authentication with carrier validation
    - Email-based authentication with secure delivery
    - Hardware security keys (FIDO2/WebAuthn) for high-security operations
    - Biometric authentication (fingerprint, face recognition, voice)
    - Push notifications with cryptographic validation
  </mfa_methods>
  <mfa_orchestration>
    - MFA method selection based on user preferences and risk assessment
    - Progressive MFA based on operation sensitivity and risk level
    - MFA backup methods and recovery procedures
    - MFA method enrollment and management workflows
    - MFA compliance validation and audit trail generation
  </mfa_orchestration>
  <risk_based_authentication>
    - Device fingerprinting and trust scoring
    - Behavioral analysis and anomaly detection
    - Geolocation analysis and travel pattern recognition
    - Transaction pattern analysis and risk scoring
    - Adaptive MFA requirements based on calculated risk
  </risk_based_authentication>
</mfa_implementation>

<instructions>
  IF has_backend:
    USE: @agent:dwaybank-backend
    REQUEST: "Implement multi-factor authentication system:
              - TOTP, SMS, email, hardware key, and biometric authentication
              - MFA orchestration and method selection engine
              - Risk-based authentication and adaptive security
              - MFA enrollment and management workflows
              - Integration with financial system APIs and databases"
    COORDINATE: With dwaybank-security for security validation
    COORDINATE: With dwaybank-frontend for UI integration
  ELSE:
    IMPLEMENT: MFA system with development team
    FOCUS: Security, usability, and regulatory compliance
  
  IMPLEMENT: All MFA methods and orchestration logic
  VALIDATE: MFA security and compliance requirements
  TEST: MFA workflows and user experience
</instructions>

</step>

<step number="4" name="kyc_integration">

### Step 4: KYC and Identity Verification Integration

<step_metadata>
  <inputs>
    - kyc_requirements: object (AML/KYC regulations)
    - identity_verification: object (document verification)
    - compliance_standards: object (financial regulations)
  </inputs>
  <agents_involved>
    - dwaybank-security (primary)
    - dwaybank-backend (implementation)
    - dwaybank-qa (validation)
  </agents_involved>
</step_metadata>

<kyc_integration>
  <identity_verification>
    - Document verification (passport, driver's license, ID cards)
    - Biometric verification (facial recognition, liveness detection)
    - Address verification and proof of residence
    - Phone number verification and ownership validation
    - Email verification and ownership confirmation
  </identity_verification>
  <kyc_workflow>
    - Customer risk assessment and due diligence procedures
    - Enhanced due diligence for high-risk customers
    - Ongoing monitoring and periodic re-verification
    - Sanctions screening and PEP (Politically Exposed Person) checking
    - KYC documentation and audit trail maintenance
  </kyc_workflow>
  <compliance_reporting>
    - AML/KYC compliance reporting and regulatory filing
    - Suspicious activity monitoring and reporting
    - Customer due diligence documentation and evidence
    - Regulatory audit preparation and evidence collection
    - Cross-border compliance and international standards
  </compliance_reporting>
</kyc_integration>

<instructions>
  IF has_security:
    USE: @agent:dwaybank-security
    REQUEST: "Implement KYC and identity verification system:
              - Document and biometric verification workflows
              - Customer risk assessment and due diligence procedures
              - AML/KYC compliance reporting and documentation
              - Sanctions screening and PEP checking integration
              - Ongoing monitoring and re-verification processes"
    COORDINATE: With dwaybank-backend for system integration
    COORDINATE: With dwaybank-qa for compliance validation
  ELSE:
    IMPLEMENT: KYC system with compliance team
    FOCUS: Regulatory compliance and audit trail
  
  IMPLEMENT: Complete KYC and identity verification system
  VALIDATE: Compliance with AML/KYC regulations
  DOCUMENT: KYC procedures and compliance evidence
</instructions>

</step>

<step number="5" name="session_security_implementation">

### Step 5: Session Security and Token Management

<step_metadata>
  <inputs>
    - session_requirements: object (security standards)
    - token_security: object (JWT standards)
    - device_management: object (trust and security)
  </inputs>
  <agents_involved>
    - dwaybank-backend (primary)
    - dwaybank-security (security validation)
    - dwaybank-performance (optimization)
  </agents_involved>
</step_metadata>

<session_security>
  <jwt_token_management>
    - JWT access token creation with financial claims
    - Refresh token rotation and secure storage
    - Token expiration and automatic renewal
    - Token revocation and blacklist management
    - Token encryption and signature validation
  </jwt_token_management>
  <session_lifecycle>
    - Secure session creation and initialization
    - Session timeout and idle detection with financial context
    - Concurrent session management and device limits
    - Session invalidation and logout procedures
    - Cross-device session synchronization and security
  </session_lifecycle>
  <device_trust_management>
    - Device registration and trust establishment
    - Device fingerprinting and identification
    - Device-based authentication and authorization
    - Device security monitoring and threat detection
    - Device revocation and security incident response
  </device_trust_management>
</session_security>

<instructions>
  IF has_backend:
    USE: @agent:dwaybank-backend
    REQUEST: "Implement session security and token management:
              - JWT token creation, rotation, and revocation
              - Secure session lifecycle management
              - Device trust establishment and management
              - Session timeout and security monitoring
              - Integration with Redis for session storage"
    COORDINATE: With dwaybank-security for security validation
    COORDINATE: With dwaybank-performance for optimization
  ELSE:
    IMPLEMENT: Session security with development team
    FOCUS: Security, performance, and scalability
  
  IMPLEMENT: Complete session security and token management
  OPTIMIZE: Session performance and scalability
  VALIDATE: Security and compliance requirements
</instructions>

</step>

<step number="6" name="authentication_testing">

### Step 6: Authentication System Testing and Validation

<step_metadata>
  <inputs>
    - authentication_system: object (implemented system)
    - security_requirements: object (validation criteria)
    - compliance_standards: object (testing requirements)
  </inputs>
  <agents_involved>
    - dwaybank-qa (primary)
    - dwaybank-security (security testing)
    - dwaybank-performance (performance testing)
  </agents_involved>
</step_metadata>

<authentication_testing>
  <security_testing>
    - Authentication bypass and vulnerability testing
    - MFA security and implementation validation
    - Session security and token validation testing
    - Biometric authentication security testing
    - Risk-based authentication effectiveness testing
  </security_testing>
  <compliance_testing>
    - PCI DSS authentication compliance validation
    - SOX access control testing and validation
    - GDPR privacy and consent management testing
    - AML/KYC identity verification testing
    - Financial industry standard compliance testing
  </compliance_testing>
  <performance_testing>
    - Authentication system load and stress testing
    - MFA performance and user experience testing
    - Session management performance and scalability
    - Database and cache performance optimization
    - API response time and throughput validation
  </performance_testing>
  <user_experience_testing>
    - Authentication flow usability and accessibility
    - MFA enrollment and management user experience
    - Error handling and recovery procedure testing
    - Cross-device and browser compatibility testing
    - Mobile authentication and responsive design testing
  </user_experience_testing>
</authentication_testing>

<instructions>
  IF has_qa:
    USE: @agent:dwaybank-qa
    REQUEST: "Execute comprehensive authentication system testing:
              - Security testing for authentication vulnerabilities
              - Compliance testing for regulatory requirements
              - Performance testing for scalability and reliability
              - User experience testing for usability and accessibility
              - Integration testing with financial system components"
    COORDINATE: With dwaybank-security for security validation
    COORDINATE: With dwaybank-performance for performance optimization
  ELSE:
    EXECUTE: Testing manually with QA team
    FOCUS: Security, compliance, and user experience
  
  EXECUTE: Complete authentication system testing
  VALIDATE: All security and compliance requirements
  DOCUMENT: Test results and validation evidence
</instructions>

</step>

<step number="7" name="compliance_documentation">

### Step 7: Authentication Compliance Documentation

<step_metadata>
  <inputs>
    - authentication_implementation: object (complete system)
    - testing_results: object (validation evidence)
    - compliance_requirements: object (regulatory standards)
  </inputs>
  <agents_involved>
    - dwaybank-scribe (primary)
    - dwaybank-security (compliance validation)
    - dwaybank-qa (evidence documentation)
  </agents_involved>
</step_metadata>

<compliance_documentation>
  <regulatory_documentation>
    - PCI DSS authentication compliance documentation
    - SOX access control implementation and testing evidence
    - GDPR privacy by design and consent management documentation
    - AML/KYC identity verification procedures and evidence
    - Financial industry authentication standard compliance
  </regulatory_documentation>
  <security_documentation>
    - Authentication security architecture and design documentation
    - MFA implementation and security validation documentation
    - Session security and token management procedures
    - Risk-based authentication and adaptive security documentation
    - Security testing results and vulnerability assessment
  </security_documentation>
  <operational_documentation>
    - Authentication system operational procedures and runbooks
    - User management and access control procedures
    - Incident response and security event handling procedures
    - Authentication system monitoring and alerting configuration
    - Backup and recovery procedures for authentication system
  </operational_documentation>
</compliance_documentation>

<instructions>
  USE: @agent:dwaybank-scribe for professional documentation
  CREATE: Comprehensive authentication compliance documentation
  INCLUDE: All regulatory, security, and operational requirements
  FORMAT: Professional financial industry documentation standards
  
  COORDINATE: Technical review with dwaybank-security
  VALIDATE: Compliance documentation completeness
  ENSURE: Documentation meets audit and regulatory requirements
  FINALIZE: Documentation for stakeholder approval and filing
</instructions>

</step>

<step number="8" name="deployment_monitoring">

### Step 8: Authentication System Deployment and Monitoring

<step_metadata>
  <inputs>
    - authentication_system: object (validated system)
    - deployment_requirements: object (production standards)
    - monitoring_requirements: object (security and performance)
  </inputs>
  <agents_involved>
    - dwaybank-devops (primary)
    - dwaybank-backend (deployment support)
    - taskmaster-monitor (monitoring setup)
  </agents_involved>
</step_metadata>

<deployment_monitoring>
  <production_deployment>
    - Authentication system production deployment procedures
    - Database migration and data initialization
    - Configuration management and environment setup
    - Load balancer and infrastructure configuration
    - Security configuration and SSL/TLS setup
  </production_deployment>
  <monitoring_implementation>
    - Authentication system performance monitoring
    - Security event monitoring and alerting
    - Failed authentication attempt monitoring
    - MFA usage and effectiveness monitoring
    - Session security and token validation monitoring
  </monitoring_implementation>
  <operational_procedures>
    - Authentication system maintenance and updates
    - User account management and support procedures
    - Security incident response and recovery procedures
    - Performance optimization and capacity planning
    - Backup and disaster recovery procedures
  </operational_procedures>
</deployment_monitoring>

<instructions>
  COORDINATE: Production deployment with dwaybank-devops
  IMPLEMENT: Comprehensive monitoring and alerting systems
  ESTABLISH: Operational procedures and support workflows
  VALIDATE: Production deployment and system functionality
  
  MONITOR: Authentication system performance and security
  DOCUMENT: Deployment procedures and operational runbooks
  TRAIN: Operations team on authentication system management
  COMPLETE: Authentication system implementation and validation
</instructions>

</step>

</process_flow>

## MCP Server Integration for Authentication

### Context7 Integration
```yaml
purpose: Authentication standards and compliance documentation
usage_pattern: Research and validation
capabilities:
  - OAuth 2.0 and OpenID Connect standards
  - Financial authentication compliance standards
  - MFA implementation best practices
  - Security and privacy regulations
```

### Sequential Integration
```yaml
purpose: Complex authentication workflow analysis
usage_pattern: System design and risk assessment
capabilities:
  - Authentication architecture analysis
  - Risk-based authentication logic
  - Compliance workflow coordination
  - Security incident response planning
```

### Magic Integration
```yaml
purpose: Authentication UI component generation
usage_pattern: Frontend authentication interfaces
capabilities:
  - Login and registration forms
  - MFA enrollment interfaces
  - Authentication flow components
  - Accessibility-compliant designs
```

### Playwright Integration
```yaml
purpose: Authentication system testing
usage_pattern: End-to-end testing and validation
capabilities:
  - Authentication flow testing
  - MFA workflow validation
  - Cross-browser compatibility testing
  - Security and performance testing
```

## Financial Authentication Quality Gates

### Security Validation Checklist
- [ ] Multi-factor authentication implemented and tested
- [ ] Biometric authentication integrated and validated
- [ ] Risk-based authentication engine operational
- [ ] Session security and token management implemented
- [ ] Device trust management and security monitoring active
- [ ] KYC and identity verification workflows operational

### Compliance Validation Checklist
- [ ] PCI DSS authentication requirements satisfied
- [ ] SOX access control requirements implemented
- [ ] GDPR privacy by design principles applied
- [ ] AML/KYC identity verification compliance validated
- [ ] Financial industry authentication standards satisfied
- [ ] Regulatory audit trail and documentation complete

### Performance and Reliability Checklist
- [ ] Authentication system load testing completed
- [ ] MFA performance and usability validated
- [ ] Session management scalability confirmed
- [ ] Database and cache optimization implemented
- [ ] API response time and throughput requirements met
- [ ] Cross-device and browser compatibility validated

## Error Handling and Recovery

### Authentication Failure Scenarios
- **Invalid Credentials**: Clear error messages and account lockout protection
- **MFA Failures**: Backup authentication methods and recovery procedures
- **Session Expiration**: Automatic renewal and user notification procedures
- **Device Trust Issues**: Device re-verification and security validation
- **System Unavailability**: Graceful degradation and offline authentication

### Recovery Procedures
- **Account Recovery**: Secure account restoration with identity verification
- **MFA Recovery**: Backup codes and alternative authentication methods
- **Device Recovery**: Device re-registration and trust re-establishment
- **System Recovery**: Backup authentication systems and disaster recovery
- **Compliance Recovery**: Audit trail restoration and regulatory notification

### Success Criteria
- **Authentication Security**: Zero critical security vulnerabilities
- **Regulatory Compliance**: 100% compliance with financial regulations
- **User Experience**: >95% user satisfaction with authentication flows
- **System Performance**: <200ms authentication response times
- **Reliability**: 99.99% authentication system availability

---

**Document Type**: Agent OS Financial Instruction  
**Domain**: Financial Authentication System  
**Compliance Level**: Enterprise Financial Standards  
**Last Updated**: January 2025