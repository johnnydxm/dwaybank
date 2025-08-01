---
description: Financial payment processing system implementation with PCI DSS compliance
globs:
alwaysApply: false
version: 2.0
encoding: UTF-8
---

# Financial Payment Processing System Implementation

<ai_meta>
  <rules>PCI DSS compliance mandatory, secure payment processing, fraud prevention essential</rules>
  <format>UTF-8, LF, 2-space indent, financial payment security standards</format>
</ai_meta>

## Overview

Implement comprehensive financial payment processing system with PCI DSS compliance, fraud prevention, and multi-payment method support using DwayBank Agent OS framework.

<agent_detection>
  <check_once>
    AT START OF PROCESS:
    SET has_backend = (dwaybank-backend agent available)
    SET has_security = (dwaybank-security agent available)
    SET has_qa = (dwaybank-qa agent available)
    SET has_architect = (dwaybank-architect agent available)
    SET has_frontend = (dwaybank-frontend agent available)
    USE these flags throughout payment implementation
  </check_once>
</agent_detection>

<process_flow>

<step number="1" name="payment_requirements_analysis">

### Step 1: Payment Processing Requirements Analysis

<step_metadata>
  <inputs>
    - payment_methods: array[string] (cards, ACH, wire, digital wallets)
    - regulatory_requirements: array[string] (PCI DSS, PSD2, AML)
    - fraud_prevention: object (risk assessment, monitoring)
  </inputs>
  <agents_involved>
    - dwaybank-backend (primary)
    - dwaybank-security (compliance)
    - dwaybank-architect (design)
  </agents_involved>
</step_metadata>

<payment_requirements>
  <payment_methods>
    - Credit and debit card processing (Visa, Mastercard, Amex, Discover)
    - ACH (Automated Clearing House) payments and bank transfers
    - Wire transfers and international payments
    - Digital wallets (Apple Pay, Google Pay, PayPal, Venmo)
    - Cryptocurrency payments and digital assets
    - Buy now, pay later (BNPL) integration
  </payment_methods>
  <regulatory_compliance>
    - PCI DSS Level 1 compliance for card data security
    - PSD2 Strong Customer Authentication (SCA) requirements
    - AML/BSA compliance for payment monitoring and reporting
    - GDPR compliance for payment data processing and privacy
    - International payment regulations and cross-border compliance
  </regulatory_compliance>
  <security_requirements>
    - End-to-end encryption for payment data transmission
    - Tokenization for sensitive payment data storage
    - Fraud detection and prevention systems
    - Real-time transaction monitoring and risk assessment
    - Secure payment API design and implementation
  </security_requirements>
  <performance_requirements>
    - Sub-second payment authorization processing
    - High availability and fault tolerance (99.99% uptime)
    - Scalability for peak payment volumes (10K+ TPS)
    - Real-time payment status and notification systems
    - Comprehensive payment reconciliation and reporting
  </performance_requirements>
</payment_requirements>

<instructions>
  IF has_backend:
    USE: @agent:dwaybank-backend
    REQUEST: "Analyze payment processing system requirements:
              - Payment method support and integration requirements
              - Performance and scalability requirements
              - API design and system architecture requirements
              - Database design for payment data and transaction history
              - Integration requirements with payment processors and banks"
    COORDINATE: With dwaybank-security for compliance analysis
    COORDINATE: With dwaybank-architect for system design
  ELSE:
    ANALYZE: Payment requirements manually with development team
    FOCUS: Payment processing functionality and performance
  
  DOCUMENT: All payment processing requirements and specifications
  VALIDATE: Requirements against business and regulatory needs
  PRIORITIZE: Payment methods and features for implementation
</instructions>

</step>

<step number="2" name="pci_dss_compliance_design">

### Step 2: PCI DSS Compliance Architecture Design

<step_metadata>
  <inputs>
    - pci_dss_requirements: object (Level 1 compliance)
    - cardholder_data_environment: object (CDE design)
    - security_controls: object (technical and procedural)
  </inputs>
  <agents_involved>
    - dwaybank-security (primary)
    - dwaybank-architect (architecture)
    - dwaybank-backend (implementation)
  </agents_involved>
</step_metadata>

<pci_dss_compliance>
  <cardholder_data_environment>
    - Network segmentation and DMZ design for payment processing
    - Secure cardholder data transmission and storage architecture
    - Payment processor integration with tokenization and encryption
    - PCI DSS compliant infrastructure and configuration management
    - Access control and authentication for cardholder data environment
  </cardholder_data_environment>
  <data_protection>
    - Primary Account Number (PAN) tokenization and encryption
    - Secure cryptographic key management and rotation
    - Cardholder data retention and secure deletion policies
    - Payment data transmission encryption (TLS 1.3, AES-256)
    - Database encryption for payment and customer data
  </data_protection>
  <security_controls>
    - Vulnerability management and security scanning
    - Network security monitoring and intrusion detection
    - Access control and strong authentication requirements
    - Security testing and code review for payment applications
    - Incident response and forensics for payment security events
  </security_controls>
</pci_dss_compliance>

<instructions>
  IF has_security:
    USE: @agent:dwaybank-security
    REQUEST: "Design PCI DSS compliant payment system architecture:
              - Cardholder data environment (CDE) segmentation and protection
              - Payment data encryption, tokenization, and key management
              - PCI DSS security controls implementation and validation
              - Payment processor integration security and compliance
              - Vulnerability management and security monitoring systems"
    COORDINATE: With dwaybank-architect for architecture integration
    COORDINATE: With dwaybank-backend for implementation feasibility
  ELSE:
    DESIGN: PCI DSS compliance with security team
    FOCUS: Cardholder data protection and regulatory compliance
  
  DESIGN: Complete PCI DSS compliant payment architecture
  VALIDATE: Architecture against PCI DSS requirements
  DOCUMENT: Security controls and compliance procedures
</instructions>

</step>

<step number="3" name="payment_processor_integration">

### Step 3: Payment Processor Integration Implementation

<step_metadata>
  <inputs>
    - payment_processors: array[string] (Stripe, Square, Adyen, etc.)
    - integration_requirements: object (API, webhooks, security)
    - payment_methods: object (cards, ACH, wallets)
  </inputs>
  <agents_involved>
    - dwaybank-backend (primary)
    - dwaybank-security (security validation)
    - dwaybank-qa (integration testing)
  </agents_involved>
</step_metadata>

<payment_processor_integration>
  <primary_processors>
    - Stripe integration for card payments and digital wallets
    - Square integration for point-of-sale and in-person payments
    - PayPal integration for digital wallet and express checkout
    - Adyen integration for international and multi-currency payments
    - Bank integration for ACH and wire transfer processing
  </primary_processors>
  <integration_architecture>
    - Payment abstraction layer for multi-processor support
    - Webhook handling for real-time payment status updates
    - Payment method routing based on geography and optimization
    - Failover and redundancy for payment processor availability
    - Payment reconciliation and settlement processing
  </integration_architecture>
  <security_implementation>
    - OAuth 2.0 and API key management for processor authentication
    - Payment data encryption and secure transmission protocols
    - Webhook signature validation and authentication
    - Rate limiting and abuse prevention for payment APIs
    - Payment fraud detection and risk assessment integration
  </security_implementation>
</payment_processor_integration>

<instructions>
  IF has_backend:
    USE: @agent:dwaybank-backend
    REQUEST: "Implement payment processor integrations:
              - Multi-processor abstraction layer and routing
              - Card payment processing with Stripe and Square
              - Digital wallet integration (Apple Pay, Google Pay, PayPal)
              - ACH and bank transfer processing integration
              - Webhook handling and real-time payment status updates"
    COORDINATE: With dwaybank-security for security validation
    COORDINATE: With dwaybank-qa for integration testing
  ELSE:
    IMPLEMENT: Payment processor integrations with development team
    FOCUS: Security, reliability, and performance
  
  IMPLEMENT: Complete payment processor integration layer
  VALIDATE: Security and compliance of all integrations
  TEST: Payment processing flows and error handling
</instructions>

</step>

<step number="4" name="fraud_prevention_system">

### Step 4: Fraud Prevention and Risk Management System

<step_metadata>
  <inputs>
    - fraud_detection_requirements: object (real-time monitoring)
    - risk_assessment_rules: object (machine learning, rules)
    - compliance_requirements: object (AML, transaction monitoring)
  </inputs>
  <agents_involved>
    - dwaybank-security (primary)
    - dwaybank-backend (implementation)
    - dwaybank-analyzer (risk analysis)
  </agents_involved>
</step_metadata>

<fraud_prevention_system>
  <real_time_monitoring>
    - Transaction velocity and pattern analysis
    - Geolocation and device fingerprinting
    - Behavioral analysis and anomaly detection
    - Card testing and stolen card detection
    - Account takeover and identity theft prevention
  </real_time_monitoring>
  <risk_assessment_engine>
    - Machine learning fraud detection models
    - Rule-based risk scoring and assessment
    - Customer risk profiling and scoring
    - Transaction risk analysis and classification
    - Dynamic risk thresholds and adaptive security
  </risk_assessment_engine>
  <fraud_response_automation>
    - Automated transaction blocking and review
    - Customer notification and verification workflows
    - Fraud alert generation and investigation queues
    - Chargeback prevention and dispute management
    - Law enforcement reporting and compliance
  </fraud_response_automation>
</fraud_prevention_system>

<instructions>
  IF has_security:
    USE: @agent:dwaybank-security
    REQUEST: "Implement fraud prevention and risk management system:
              - Real-time transaction monitoring and pattern analysis
              - Machine learning fraud detection and risk scoring
              - Automated fraud response and investigation workflows
              - Customer verification and authentication challenges
              - Compliance reporting and law enforcement coordination"
    COORDINATE: With dwaybank-backend for system integration
    COORDINATE: With dwaybank-analyzer for risk analysis
  ELSE:
    IMPLEMENT: Fraud prevention with security team
    FOCUS: Real-time detection and automated response
  
  IMPLEMENT: Complete fraud prevention and risk management system
  VALIDATE: Fraud detection accuracy and performance
  OPTIMIZE: Risk assessment algorithms and thresholds
</instructions>

</step>

<step number="5" name="payment_api_development">

### Step 5: Payment API Development and Security

<step_metadata>
  <inputs>
    - api_requirements: object (REST, GraphQL, webhooks)
    - security_requirements: object (authentication, authorization)
    - integration_requirements: object (SDKs, documentation)
  </inputs>
  <agents_involved>
    - dwaybank-backend (primary)
    - dwaybank-security (API security)
    - dwaybank-frontend (client integration)
  </agents_involved>
</step_metadata>

<payment_api_development>
  <api_design>
    - RESTful payment API design with OpenAPI specification
    - GraphQL API for flexible payment data queries
    - Webhook API for real-time payment event notifications
    - Payment method management API for customer wallets
    - Transaction history and reporting API endpoints
  </api_design>
  <api_security>
    - OAuth 2.0 and API key authentication for payment APIs
    - Rate limiting and DDoS protection for payment endpoints
    - Input validation and sanitization for payment data
    - API versioning and backward compatibility management
    - Comprehensive API security testing and validation
  </api_security>
  <integration_support>
    - Payment SDK development for popular programming languages
    - Comprehensive API documentation and integration guides
    - Sandbox environment for payment integration testing
    - Webhook simulation and testing tools
    - Developer portal and community support resources
  </integration_support>
</payment_api_development>

<instructions>
  IF has_backend:
    USE: @agent:dwaybank-backend
    REQUEST: "Develop comprehensive payment API system:
              - RESTful and GraphQL payment APIs with OpenAPI specification
              - Payment method management and customer wallet APIs
              - Webhook system for real-time payment event notifications
              - Transaction processing and history APIs
              - API security, rate limiting, and DDoS protection"
    COORDINATE: With dwaybank-security for API security validation
    COORDINATE: With dwaybank-frontend for client integration
  ELSE:
    DEVELOP: Payment APIs with development team
    FOCUS: Security, performance, and developer experience
  
  DEVELOP: Complete payment API system with documentation
  SECURE: All API endpoints with comprehensive security measures
  VALIDATE: API functionality and security through testing
</instructions>

</step>

<step number="6" name="payment_ui_implementation">

### Step 6: Payment UI and User Experience Implementation

<step_metadata>
  <inputs>
    - ui_requirements: object (responsive, accessible)
    - payment_flows: object (checkout, wallet, recurring)
    - security_requirements: object (PCI DSS, fraud prevention)
  </inputs>
  <agents_involved>
    - dwaybank-frontend (primary)
    - dwaybank-design (UI design)
    - dwaybank-security (UI security)
  </agents_involved>
</step_metadata>

<payment_ui_implementation>
  <payment_interfaces>
    - Secure payment forms with PCI DSS compliant design
    - Digital wallet integration (Apple Pay, Google Pay)
    - Payment method management and customer wallets
    - Recurring payment setup and subscription management
    - Payment history and transaction detail interfaces
  </payment_interfaces>
  <user_experience>
    - One-click payment flows and express checkout
    - Progressive payment forms with real-time validation
    - Payment error handling and user-friendly messaging
    - Mobile-optimized payment interfaces and touch interactions
    - Accessibility compliance (WCAG 2.1 AA) for payment forms
  </user_experience>
  <security_features>
    - Client-side payment data encryption and tokenization
    - Payment form security and XSS prevention
    - Device fingerprinting and fraud prevention integration
    - Secure payment confirmation and receipt generation
    - Payment security indicators and user trust signals
  </security_features>
</payment_ui_implementation>

<instructions>
  IF has_frontend:
    USE: @agent:dwaybank-frontend
    REQUEST: "Implement payment user interfaces and experiences:
              - PCI DSS compliant payment forms and checkout flows
              - Digital wallet integration and one-click payments
              - Payment method management and customer wallets
              - Mobile-optimized and accessible payment interfaces
              - Real-time validation and user-friendly error handling"
    COORDINATE: With dwaybank-design for UI design optimization
    COORDINATE: With dwaybank-security for UI security validation
  ELSE:
    IMPLEMENT: Payment UI with frontend team
    FOCUS: User experience, security, and accessibility
  
  IMPLEMENT: Complete payment user interface system
  OPTIMIZE: Payment flow user experience and conversion
  VALIDATE: UI security and accessibility compliance
</instructions>

</step>

<step number="7" name="payment_testing_validation">

### Step 7: Payment System Testing and Validation

<step_metadata>
  <inputs>
    - payment_system: object (complete implementation)
    - testing_requirements: object (functional, security, performance)
    - compliance_validation: object (PCI DSS, regulatory)
  </inputs>
  <agents_involved>
    - dwaybank-qa (primary)
    - dwaybank-security (security testing)
    - dwaybank-performance (performance testing)
  </agents_involved>
</step_metadata>

<payment_testing_validation>
  <functional_testing>
    - End-to-end payment processing workflow testing
    - Payment method integration and processor validation
    - Payment error handling and edge case testing
    - Refund and chargeback processing testing
    - Payment reconciliation and reporting validation
  </functional_testing>
  <security_testing>
    - Payment security vulnerability assessment and penetration testing
    - PCI DSS compliance validation and security controls testing
    - Payment data encryption and tokenization validation
    - Fraud prevention system testing and validation
    - API security testing and rate limiting validation
  </security_testing>
  <performance_testing>
    - Payment processing load testing and scalability validation
    - Payment API performance testing and optimization
    - Database performance testing for payment and transaction data
    - Payment processor integration performance and reliability
    - Real-time payment monitoring and alerting validation
  </performance_testing>
  <compliance_testing>
    - PCI DSS compliance audit and validation testing
    - AML/BSA transaction monitoring and reporting testing
    - GDPR payment data processing and privacy validation
    - International payment regulation compliance testing
    - Payment accessibility and usability testing
  </compliance_testing>
</payment_testing_validation>

<instructions>
  IF has_qa:
    USE: @agent:dwaybank-qa
    REQUEST: "Execute comprehensive payment system testing:
              - Functional testing for all payment methods and workflows
              - Security testing and PCI DSS compliance validation
              - Performance testing for scalability and reliability
              - Integration testing with payment processors and banks
              - User experience testing for payment interfaces"
    COORDINATE: With dwaybank-security for security validation
    COORDINATE: With dwaybank-performance for performance optimization
  ELSE:
    EXECUTE: Payment testing manually with QA team
    FOCUS: Functionality, security, and compliance
  
  EXECUTE: Complete payment system testing and validation
  VALIDATE: All security and compliance requirements
  DOCUMENT: Testing results and compliance evidence
</instructions>

</step>

<step number="8" name="payment_deployment_monitoring">

### Step 8: Payment System Deployment and Monitoring

<step_metadata>
  <inputs>
    - payment_system: object (validated system)
    - deployment_requirements: object (production standards)
    - monitoring_requirements: object (security, performance, compliance)
  </inputs>
  <agents_involved>
    - dwaybank-devops (primary)
    - taskmaster-monitor (monitoring)
    - dwaybank-backend (deployment support)
  </agents_involved>
</step_metadata>

<payment_deployment_monitoring>
  <production_deployment>
    - Payment system production deployment and configuration
    - PCI DSS compliant infrastructure setup and validation
    - Payment processor integration configuration and testing
    - Database deployment and payment data migration
    - Load balancer and CDN configuration for payment APIs
  </production_deployment>
  <monitoring_implementation>
    - Real-time payment processing monitoring and alerting
    - Payment security event monitoring and incident response
    - Payment performance monitoring and SLA tracking
    - Fraud detection system monitoring and alert management
    - Payment processor integration health and status monitoring
  </monitoring_implementation>
  <operational_procedures>
    - Payment system maintenance and update procedures
    - Payment data backup and disaster recovery procedures
    - Payment security incident response and forensics
    - Payment compliance monitoring and reporting
    - Customer support procedures for payment issues
  </operational_procedures>
</payment_deployment_monitoring>

<instructions>
  COORDINATE: Production deployment with dwaybank-devops
  IMPLEMENT: Comprehensive payment monitoring and alerting
  ESTABLISH: Payment operational procedures and support
  VALIDATE: Production payment system functionality
  
  MONITOR: Payment processing performance and security
  DOCUMENT: Deployment procedures and operational runbooks
  TRAIN: Operations and support teams on payment systems
  COMPLETE: Payment system implementation and production launch
</instructions>

</step>

</process_flow>

## MCP Server Integration for Payments

### Context7 Integration
```yaml
purpose: Payment processing standards and compliance documentation
usage_pattern: Research and validation
capabilities:
  - PCI DSS compliance standards and implementation guides
  - Payment processor API documentation and integration patterns
  - Financial payment regulations and compliance requirements
  - Payment security best practices and fraud prevention
```

### Sequential Integration
```yaml
purpose: Complex payment workflow analysis and fraud detection
usage_pattern: System design and risk assessment
capabilities:
  - Payment processing workflow optimization
  - Fraud detection algorithm development
  - Payment security architecture analysis
  - Compliance workflow coordination
```

### Magic Integration
```yaml
purpose: Payment UI component generation
usage_pattern: Frontend payment interfaces
capabilities:
  - PCI DSS compliant payment forms
  - Digital wallet integration components
  - Payment method management interfaces
  - Mobile payment optimization
```

### Playwright Integration
```yaml
purpose: Payment system testing and validation
usage_pattern: End-to-end payment testing
capabilities:
  - Payment flow testing across browsers
  - Payment security and fraud prevention testing
  - Payment performance and load testing
  - Payment accessibility and usability testing
```

## Payment System Quality Gates

### PCI DSS Compliance Checklist
- [ ] Cardholder data environment (CDE) properly segmented
- [ ] Payment data encryption and tokenization implemented
- [ ] PCI DSS security controls validated and tested
- [ ] Vulnerability management and security scanning operational
- [ ] Access control and authentication for CDE implemented
- [ ] Payment security monitoring and incident response active

### Payment Processing Checklist
- [ ] Multi-payment method support implemented and tested
- [ ] Payment processor integrations secure and reliable
- [ ] Real-time payment processing and status updates
- [ ] Payment reconciliation and settlement processing
- [ ] Refund and chargeback processing workflows
- [ ] Payment API security and rate limiting implemented

### Fraud Prevention Checklist
- [ ] Real-time fraud detection and monitoring active
- [ ] Machine learning fraud models trained and deployed
- [ ] Automated fraud response and investigation workflows
- [ ] Customer verification and authentication challenges
- [ ] AML/BSA transaction monitoring and reporting
- [ ] Fraud prevention system performance optimized

## Success Criteria

### Security and Compliance
- **PCI DSS Compliance**: Level 1 certification achieved and maintained
- **Fraud Prevention**: <0.1% fraud rate with real-time detection
- **Payment Security**: Zero critical security vulnerabilities
- **Regulatory Compliance**: 100% compliance with financial regulations

### Performance and Reliability
- **Payment Processing**: <1 second authorization times
- **System Availability**: 99.99% uptime for payment processing
- **Transaction Volume**: 10K+ TPS capacity with auto-scaling
- **API Performance**: <200ms response times for payment APIs

### User Experience and Business
- **Payment Success Rate**: >99% successful payment processing
- **Conversion Optimization**: Optimized checkout flows and UX
- **Payment Method Coverage**: Support for all major payment methods
- **Customer Satisfaction**: >95% satisfaction with payment experience

---

**Document Type**: Agent OS Financial Instruction  
**Domain**: Financial Payment Processing  
**Compliance Level**: PCI DSS Level 1  
**Last Updated**: January 2025