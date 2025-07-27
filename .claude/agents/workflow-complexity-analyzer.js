/**
 * Workflow Complexity Analyzer
 * Advanced complexity analysis for intelligent agent selection and resource allocation
 */

class WorkflowComplexityAnalyzer {
    constructor() {
        this.complexityModels = new Map();
        this.domainFactors = new Map();
        this.capabilityWeights = new Map();
        this.historicalComplexity = new Map();
        this.complexityPatterns = new Map();
    }

    async initialize() {
        await this.setupComplexityModels();
        await this.setupDomainFactors();
        await this.setupCapabilityWeights();
        await this.setupComplexityPatterns();
        console.log('Workflow Complexity Analyzer initialized');
    }

    /**
     * Setup complexity analysis models
     */
    async setupComplexityModels() {
        // Technical Complexity Model
        this.complexityModels.set('technical', {
            factors: [
                'capability_count',
                'capability_interdependence',
                'technology_stack_complexity',
                'integration_points',
                'performance_requirements',
                'security_requirements'
            ],
            weights: {
                capability_count: 0.15,
                capability_interdependence: 0.25,
                technology_stack_complexity: 0.20,
                integration_points: 0.15,
                performance_requirements: 0.15,
                security_requirements: 0.10
            },
            base_complexity: 0.2
        });

        // Domain Complexity Model
        this.complexityModels.set('domain', {
            factors: [
                'domain_expertise_required',
                'regulatory_compliance',
                'business_logic_complexity',
                'stakeholder_count',
                'domain_specificity'
            ],
            weights: {
                domain_expertise_required: 0.30,
                regulatory_compliance: 0.25,
                business_logic_complexity: 0.20,
                stakeholder_count: 0.15,
                domain_specificity: 0.10
            },
            base_complexity: 0.1
        });

        // Coordination Complexity Model
        this.complexityModels.set('coordination', {
            factors: [
                'agent_count',
                'communication_overhead',
                'synchronization_requirements',
                'conflict_resolution_needs',
                'workflow_dependencies'
            ],
            weights: {
                agent_count: 0.25,
                communication_overhead: 0.20,
                synchronization_requirements: 0.20,
                conflict_resolution_needs: 0.20,
                workflow_dependencies: 0.15
            },
            base_complexity: 0.1
        });

        // Temporal Complexity Model
        this.complexityModels.set('temporal', {
            factors: [
                'time_constraints',
                'scheduling_complexity',
                'real_time_requirements',
                'deadline_pressure',
                'time_zone_coordination'
            ],
            weights: {
                time_constraints: 0.30,
                scheduling_complexity: 0.25,
                real_time_requirements: 0.20,
                deadline_pressure: 0.15,
                time_zone_coordination: 0.10
            },
            base_complexity: 0.05
        });

        // Quality Complexity Model
        this.complexityModels.set('quality', {
            factors: [
                'quality_standards',
                'validation_requirements',
                'compliance_checks',
                'testing_complexity',
                'documentation_requirements'
            ],
            weights: {
                quality_standards: 0.25,
                validation_requirements: 0.25,
                compliance_checks: 0.20,
                testing_complexity: 0.20,
                documentation_requirements: 0.10
            },
            base_complexity: 0.1
        });
    }

    /**
     * Setup domain-specific complexity factors
     */
    async setupDomainFactors() {
        // Financial Domain Factors
        this.domainFactors.set('financial', {
            base_complexity: 0.7, // Financial domain is inherently complex
            regulatory_multiplier: 1.5,
            security_multiplier: 1.4,
            accuracy_requirements: 0.99,
            audit_requirements: 'strict',
            compliance_frameworks: ['PCI_DSS', 'SOX', 'GDPR', 'BASEL_III'],
            risk_factors: {
                financial_loss: 'high',
                regulatory_penalty: 'high',
                reputation_damage: 'critical'
            }
        });

        // Architecture Domain Factors
        this.domainFactors.set('architecture', {
            base_complexity: 0.6,
            scalability_multiplier: 1.3,
            integration_complexity: 1.4,
            future_proofing_requirements: 'high',
            technical_debt_considerations: 'critical'
        });

        // Security Domain Factors
        this.domainFactors.set('security', {
            base_complexity: 0.8,
            threat_landscape_complexity: 1.5,
            compliance_multiplier: 1.6,
            validation_requirements: 'extensive',
            false_positive_tolerance: 'very_low'
        });

        // Frontend Domain Factors
        this.domainFactors.set('frontend', {
            base_complexity: 0.4,
            user_experience_complexity: 1.2,
            cross_platform_multiplier: 1.3,
            accessibility_requirements: 'mandatory',
            performance_optimization: 'critical'
        });

        // Backend Domain Factors
        this.domainFactors.set('backend', {
            base_complexity: 0.5,
            data_consistency_requirements: 1.4,
            performance_multiplier: 1.3,
            integration_complexity: 1.5,
            scalability_requirements: 'high'
        });
    }

    /**
     * Setup capability complexity weights
     */
    async setupCapabilityWeights() {
        const weights = {
            // High complexity capabilities
            'system_design': 0.9,
            'architecture_review': 0.85,
            'threat_modeling': 0.9,
            'vulnerability_assessment': 0.8,
            'compliance': 0.85,
            'performance_optimization': 0.8,

            // Medium complexity capabilities
            'api_development': 0.6,
            'database_design': 0.7,
            'ui_development': 0.5,
            'testing': 0.5,
            'quality_validation': 0.6,

            // Lower complexity capabilities
            'documentation': 0.3,
            'monitoring': 0.4,
            'deployment': 0.5,

            // Management capabilities
            'project_coordination': 0.7,
            'resource_management': 0.6,
            'workflow_coordination': 0.8,

            // Analysis capabilities
            'root_cause_analysis': 0.7,
            'data_analysis': 0.6,
            'investigation': 0.6
        };

        for (const [capability, weight] of Object.entries(weights)) {
            this.capabilityWeights.set(capability, weight);
        }
    }

    /**
     * Setup complexity patterns for pattern matching
     */
    async setupComplexityPatterns() {
        // High Complexity Patterns
        this.complexityPatterns.set('enterprise_integration', {
            complexity_score: 0.9,
            indicators: ['multiple_systems', 'data_synchronization', 'legacy_integration'],
            typical_capabilities: ['system_design', 'api_development', 'data_migration'],
            risk_factors: ['data_loss', 'system_downtime', 'integration_failures']
        });

        this.complexityPatterns.set('financial_compliance', {
            complexity_score: 0.95,
            indicators: ['regulatory_requirements', 'audit_trails', 'financial_calculations'],
            typical_capabilities: ['compliance', 'security', 'documentation'],
            risk_factors: ['regulatory_violations', 'financial_penalties', 'audit_failures']
        });

        this.complexityPatterns.set('real_time_trading', {
            complexity_score: 0.92,
            indicators: ['low_latency', 'high_throughput', 'market_data'],
            typical_capabilities: ['performance_optimization', 'system_design', 'monitoring'],
            risk_factors: ['trade_failures', 'latency_spikes', 'data_inconsistency']
        });

        // Medium Complexity Patterns
        this.complexityPatterns.set('user_interface_development', {
            complexity_score: 0.6,
            indicators: ['responsive_design', 'user_experience', 'accessibility'],
            typical_capabilities: ['ui_development', 'user_experience', 'testing'],
            risk_factors: ['usability_issues', 'accessibility_violations', 'performance_problems']
        });

        this.complexityPatterns.set('api_integration', {
            complexity_score: 0.65,
            indicators: ['third_party_apis', 'data_transformation', 'error_handling'],
            typical_capabilities: ['api_development', 'integration', 'testing'],
            risk_factors: ['service_dependencies', 'rate_limiting', 'data_quality']
        });

        // Low Complexity Patterns
        this.complexityPatterns.set('documentation_update', {
            complexity_score: 0.3,
            indicators: ['content_creation', 'formatting', 'review_process'],
            typical_capabilities: ['documentation', 'technical_writing'],
            risk_factors: ['outdated_information', 'accuracy_issues']
        });

        this.complexityPatterns.set('monitoring_setup', {
            complexity_score: 0.4,
            indicators: ['metrics_collection', 'alerting', 'dashboard_creation'],
            typical_capabilities: ['monitoring', 'configuration', 'analysis'],
            risk_factors: ['false_alerts', 'missed_incidents', 'performance_overhead']
        });
    }

    /**
     * Analyze overall workflow complexity
     */
    async analyzeComplexity(taskRequirements) {
        const analysis = {
            overall_complexity: 0,
            complexity_breakdown: {},
            domain_count: 0,
            capability_requirements: taskRequirements.capabilities || [],
            resource_intensity: 0,
            time_constraints: 0,
            quality_requirements: 0,
            risk_assessment: {},
            complexity_factors: {},
            patterns_detected: [],
            recommendations: []
        };

        // Analyze technical complexity
        analysis.complexity_breakdown.technical = await this.analyzeTechnicalComplexity(taskRequirements);

        // Analyze domain complexity
        analysis.complexity_breakdown.domain = await this.analyzeDomainComplexity(taskRequirements);

        // Analyze coordination complexity
        analysis.complexity_breakdown.coordination = await this.analyzeCoordinationComplexity(taskRequirements);

        // Analyze temporal complexity
        analysis.complexity_breakdown.temporal = await this.analyzeTemporalComplexity(taskRequirements);

        // Analyze quality complexity
        analysis.complexity_breakdown.quality = await this.analyzeQualityComplexity(taskRequirements);

        // Calculate overall complexity
        analysis.overall_complexity = await this.calculateOverallComplexity(analysis.complexity_breakdown);

        // Detect patterns
        analysis.patterns_detected = await this.detectComplexityPatterns(taskRequirements);

        // Count domains involved
        analysis.domain_count = this.countInvolvedDomains(taskRequirements);

        // Assess other factors
        analysis.resource_intensity = await this.assessResourceIntensity(taskRequirements);
        analysis.time_constraints = await this.assessTimeConstraints(taskRequirements);
        analysis.quality_requirements = await this.assessQualityRequirements(taskRequirements);

        // Risk assessment
        analysis.risk_assessment = await this.assessComplexityRisks(analysis);

        // Generate recommendations
        analysis.recommendations = await this.generateComplexityRecommendations(analysis);

        return analysis;
    }

    /**
     * Analyze technical complexity
     */
    async analyzeTechnicalComplexity(taskRequirements) {
        const model = this.complexityModels.get('technical');
        let complexity = model.base_complexity;

        // Capability count factor
        const capabilityCount = (taskRequirements.capabilities || []).length;
        const capabilityFactor = Math.min(1.0, capabilityCount / 10); // Normalize to 0-1
        complexity += capabilityFactor * model.weights.capability_count;

        // Capability interdependence
        const interdependence = await this.calculateCapabilityInterdependence(taskRequirements.capabilities || []);
        complexity += interdependence * model.weights.capability_interdependence;

        // Technology stack complexity
        const techComplexity = await this.assessTechnologyComplexity(taskRequirements);
        complexity += techComplexity * model.weights.technology_stack_complexity;

        // Integration points
        const integrationComplexity = await this.assessIntegrationComplexity(taskRequirements);
        complexity += integrationComplexity * model.weights.integration_points;

        // Performance requirements
        const performanceComplexity = await this.assessPerformanceComplexity(taskRequirements);
        complexity += performanceComplexity * model.weights.performance_requirements;

        // Security requirements
        const securityComplexity = await this.assessSecurityComplexity(taskRequirements);
        complexity += securityComplexity * model.weights.security_requirements;

        return Math.min(1.0, complexity);
    }

    /**
     * Analyze domain complexity
     */
    async analyzeDomainComplexity(taskRequirements) {
        const model = this.complexityModels.get('domain');
        let complexity = model.base_complexity;

        const domain = taskRequirements.domain || 'general';
        const domainFactors = this.domainFactors.get(domain);

        if (domainFactors) {
            complexity += domainFactors.base_complexity;

            // Apply domain-specific multipliers
            if (domainFactors.regulatory_multiplier && taskRequirements.compliance_required) {
                complexity *= domainFactors.regulatory_multiplier;
            }

            if (domainFactors.security_multiplier && this.hasSecurityRequirements(taskRequirements)) {
                complexity *= domainFactors.security_multiplier;
            }
        }

        // Domain expertise requirements
        const expertiseRequirement = taskRequirements.expertise_level || 0.5;
        complexity += expertiseRequirement * model.weights.domain_expertise_required;

        // Regulatory compliance
        const complianceComplexity = this.assessComplianceComplexity(taskRequirements);
        complexity += complianceComplexity * model.weights.regulatory_compliance;

        // Business logic complexity
        const businessLogicComplexity = taskRequirements.business_logic_complexity || 0.5;
        complexity += businessLogicComplexity * model.weights.business_logic_complexity;

        return Math.min(1.0, complexity);
    }

    /**
     * Analyze coordination complexity
     */
    async analyzeCoordinationComplexity(taskRequirements) {
        const model = this.complexityModels.get('coordination');
        let complexity = model.base_complexity;

        // Agent count factor
        const estimatedAgentCount = await this.estimateRequiredAgentCount(taskRequirements);
        const agentFactor = Math.min(1.0, estimatedAgentCount / 10);
        complexity += agentFactor * model.weights.agent_count;

        // Communication overhead
        const communicationOverhead = this.calculateCommunicationOverhead(estimatedAgentCount);
        complexity += communicationOverhead * model.weights.communication_overhead;

        // Synchronization requirements
        const syncRequirements = taskRequirements.synchronization_required ? 0.8 : 0.2;
        complexity += syncRequirements * model.weights.synchronization_requirements;

        // Conflict resolution needs
        const conflictResolution = this.assessConflictResolutionNeeds(taskRequirements);
        complexity += conflictResolution * model.weights.conflict_resolution_needs;

        // Workflow dependencies
        const workflowDependencies = this.assessWorkflowDependencies(taskRequirements);
        complexity += workflowDependencies * model.weights.workflow_dependencies;

        return Math.min(1.0, complexity);
    }

    /**
     * Analyze temporal complexity
     */
    async analyzeTemporalComplexity(taskRequirements) {
        const model = this.complexityModels.get('temporal');
        let complexity = model.base_complexity;

        // Time constraints
        const timeConstraints = this.assessTimeConstraintSeverity(taskRequirements);
        complexity += timeConstraints * model.weights.time_constraints;

        // Scheduling complexity
        const schedulingComplexity = this.assessSchedulingComplexity(taskRequirements);
        complexity += schedulingComplexity * model.weights.scheduling_complexity;

        // Real-time requirements
        const realTimeRequirements = taskRequirements.real_time_required ? 0.9 : 0.1;
        complexity += realTimeRequirements * model.weights.real_time_requirements;

        // Deadline pressure
        const deadlinePressure = this.assessDeadlinePressure(taskRequirements);
        complexity += deadlinePressure * model.weights.deadline_pressure;

        return Math.min(1.0, complexity);
    }

    /**
     * Analyze quality complexity
     */
    async analyzeQualityComplexity(taskRequirements) {
        const model = this.complexityModels.get('quality');
        let complexity = model.base_complexity;

        // Quality standards
        const qualityStandards = taskRequirements.quality_standards || 0.8;
        complexity += qualityStandards * model.weights.quality_standards;

        // Validation requirements
        const validationReqs = taskRequirements.validation_required ? 0.8 : 0.4;
        complexity += validationReqs * model.weights.validation_requirements;

        // Compliance checks
        const complianceChecks = this.assessComplianceComplexity(taskRequirements);
        complexity += complianceChecks * model.weights.compliance_checks;

        // Testing complexity
        const testingComplexity = this.assessTestingComplexity(taskRequirements);
        complexity += testingComplexity * model.weights.testing_complexity;

        return Math.min(1.0, complexity);
    }

    /**
     * Calculate overall complexity from breakdown
     */
    async calculateOverallComplexity(complexityBreakdown) {
        const weights = {
            technical: 0.3,
            domain: 0.25,
            coordination: 0.2,
            temporal: 0.15,
            quality: 0.1
        };

        let overallComplexity = 0;
        for (const [aspect, weight] of Object.entries(weights)) {
            overallComplexity += (complexityBreakdown[aspect] || 0) * weight;
        }

        return Math.min(1.0, overallComplexity);
    }

    /**
     * Detect complexity patterns
     */
    async detectComplexityPatterns(taskRequirements) {
        const detectedPatterns = [];

        for (const [patternName, pattern] of this.complexityPatterns.entries()) {
            const matchScore = await this.calculatePatternMatch(taskRequirements, pattern);
            
            if (matchScore > 0.7) {
                detectedPatterns.push({
                    pattern: patternName,
                    match_score: matchScore,
                    complexity_score: pattern.complexity_score,
                    risk_factors: pattern.risk_factors
                });
            }
        }

        return detectedPatterns.sort((a, b) => b.match_score - a.match_score);
    }

    /**
     * Calculate pattern match score
     */
    async calculatePatternMatch(taskRequirements, pattern) {
        let matchScore = 0;
        let indicatorCount = 0;

        // Check for pattern indicators
        for (const indicator of pattern.indicators) {
            if (this.hasIndicator(taskRequirements, indicator)) {
                matchScore++;
            }
            indicatorCount++;
        }

        // Check for typical capabilities
        if (pattern.typical_capabilities && taskRequirements.capabilities) {
            const capabilityMatches = pattern.typical_capabilities.filter(cap =>
                taskRequirements.capabilities.includes(cap)
            ).length;
            
            matchScore += capabilityMatches / pattern.typical_capabilities.length;
            indicatorCount++;
        }

        return indicatorCount > 0 ? matchScore / indicatorCount : 0;
    }

    /**
     * Helper methods for complexity assessment
     */
    async calculateCapabilityInterdependence(capabilities) {
        if (capabilities.length < 2) return 0;

        let interdependenceScore = 0;
        const pairs = this.generateCapabilityPairs(capabilities);

        for (const [cap1, cap2] of pairs) {
            interdependenceScore += this.getCapabilityRelationship(cap1, cap2);
        }

        return Math.min(1.0, interdependenceScore / pairs.length);
    }

    generateCapabilityPairs(capabilities) {
        const pairs = [];
        for (let i = 0; i < capabilities.length; i++) {
            for (let j = i + 1; j < capabilities.length; j++) {
                pairs.push([capabilities[i], capabilities[j]]);
            }
        }
        return pairs;
    }

    getCapabilityRelationship(cap1, cap2) {
        // Define known relationships between capabilities
        const relationships = {
            'system_design-api_development': 0.8,
            'security-compliance': 0.9,
            'testing-quality_validation': 0.7,
            'performance_optimization-monitoring': 0.6,
            'ui_development-user_experience': 0.9
        };

        const key1 = `${cap1}-${cap2}`;
        const key2 = `${cap2}-${cap1}`;
        
        return relationships[key1] || relationships[key2] || 0.3; // Default relationship
    }

    async assessTechnologyComplexity(taskRequirements) {
        const techStack = taskRequirements.technology_stack || [];
        const complexTechnologies = ['microservices', 'kubernetes', 'blockchain', 'machine_learning'];
        
        let complexity = 0.3; // Base complexity
        
        for (const tech of techStack) {
            if (complexTechnologies.includes(tech)) {
                complexity += 0.2;
            }
        }

        return Math.min(1.0, complexity);
    }

    async assessIntegrationComplexity(taskRequirements) {
        const integrations = taskRequirements.integrations || [];
        const legacySystems = taskRequirements.legacy_systems || false;
        
        let complexity = integrations.length * 0.1;
        if (legacySystems) complexity += 0.3;
        
        return Math.min(1.0, complexity);
    }

    async assessPerformanceComplexity(taskRequirements) {
        const performanceReqs = taskRequirements.performance_requirements || {};
        let complexity = 0.2;

        if (performanceReqs.low_latency) complexity += 0.3;
        if (performanceReqs.high_throughput) complexity += 0.3;
        if (performanceReqs.scalability) complexity += 0.2;

        return Math.min(1.0, complexity);
    }

    async assessSecurityComplexity(taskRequirements) {
        const securityReqs = taskRequirements.security_requirements || {};
        let complexity = 0.1;

        if (securityReqs.encryption_required) complexity += 0.2;
        if (securityReqs.audit_trails) complexity += 0.2;
        if (securityReqs.compliance_required) complexity += 0.3;
        if (securityReqs.penetration_testing) complexity += 0.2;

        return Math.min(1.0, complexity);
    }

    hasSecurityRequirements(taskRequirements) {
        return taskRequirements.security_requirements ||
               taskRequirements.compliance_required ||
               (taskRequirements.capabilities || []).includes('security');
    }

    assessComplianceComplexity(taskRequirements) {
        const complianceReqs = taskRequirements.compliance_requirements || [];
        return Math.min(1.0, complianceReqs.length * 0.2);
    }

    async estimateRequiredAgentCount(taskRequirements) {
        const capabilities = taskRequirements.capabilities || [];
        const domains = this.identifyRequiredDomains(capabilities);
        
        // Estimate based on capabilities and domains
        return Math.max(1, Math.min(domains.length + 1, capabilities.length));
    }

    calculateCommunicationOverhead(agentCount) {
        if (agentCount <= 1) return 0;
        
        const connections = (agentCount * (agentCount - 1)) / 2;
        return Math.min(1.0, connections / 15); // Normalize
    }

    assessConflictResolutionNeeds(taskRequirements) {
        const conflictProne = taskRequirements.conflict_prone || false;
        const multiStakeholder = (taskRequirements.stakeholders || []).length > 2;
        
        return (conflictProne ? 0.6 : 0.2) + (multiStakeholder ? 0.3 : 0);
    }

    assessWorkflowDependencies(taskRequirements) {
        const dependencies = taskRequirements.dependencies || [];
        return Math.min(1.0, dependencies.length * 0.15);
    }

    assessTimeConstraintSeverity(taskRequirements) {
        const urgency = taskRequirements.urgency || 'normal';
        const urgencyMap = {
            'low': 0.2,
            'normal': 0.4,
            'high': 0.7,
            'critical': 0.9
        };
        return urgencyMap[urgency] || 0.4;
    }

    assessSchedulingComplexity(taskRequirements) {
        const timeZones = (taskRequirements.time_zones || []).length;
        const dependencies = (taskRequirements.dependencies || []).length;
        
        return Math.min(1.0, (timeZones * 0.1) + (dependencies * 0.1));
    }

    assessDeadlinePressure(taskRequirements) {
        const deadline = taskRequirements.deadline;
        if (!deadline) return 0.3;
        
        const now = new Date();
        const deadlineDate = new Date(deadline);
        const timeDiff = deadlineDate.getTime() - now.getTime();
        const days = timeDiff / (1000 * 60 * 60 * 24);
        
        if (days < 1) return 0.9;
        if (days < 7) return 0.7;
        if (days < 30) return 0.5;
        return 0.3;
    }

    assessTestingComplexity(taskRequirements) {
        const testingReqs = taskRequirements.testing_requirements || {};
        let complexity = 0.2;

        if (testingReqs.unit_tests) complexity += 0.1;
        if (testingReqs.integration_tests) complexity += 0.2;
        if (testingReqs.e2e_tests) complexity += 0.3;
        if (testingReqs.performance_tests) complexity += 0.2;
        if (testingReqs.security_tests) complexity += 0.2;

        return Math.min(1.0, complexity);
    }

    countInvolvedDomains(taskRequirements) {
        const capabilities = taskRequirements.capabilities || [];
        const domains = this.identifyRequiredDomains(capabilities);
        return domains.length;
    }

    identifyRequiredDomains(capabilities) {
        const domainMapping = {
            'system_design': 'architecture',
            'api_development': 'backend',
            'ui_development': 'frontend',
            'security': 'security',
            'testing': 'qa',
            'performance_optimization': 'performance',
            'documentation': 'documentation'
        };

        const domains = new Set();
        for (const capability of capabilities) {
            const domain = domainMapping[capability] || 'general';
            domains.add(domain);
        }

        return Array.from(domains);
    }

    async assessResourceIntensity(taskRequirements) {
        const factors = [
            taskRequirements.data_volume || 0.3,
            taskRequirements.processing_requirements || 0.3,
            taskRequirements.storage_requirements || 0.3,
            taskRequirements.network_requirements || 0.3
        ];

        return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
    }

    async assessTimeConstraints(taskRequirements) {
        return this.assessTimeConstraintSeverity(taskRequirements);
    }

    async assessQualityRequirements(taskRequirements) {
        return taskRequirements.quality_standards || 0.8;
    }

    async assessComplexityRisks(analysis) {
        const risks = {
            technical_risks: [],
            coordination_risks: [],
            timeline_risks: [],
            quality_risks: []
        };

        if (analysis.complexity_breakdown.technical > 0.8) {
            risks.technical_risks.push('high_technical_complexity');
        }

        if (analysis.complexity_breakdown.coordination > 0.7) {
            risks.coordination_risks.push('complex_coordination_requirements');
        }

        if (analysis.complexity_breakdown.temporal > 0.8) {
            risks.timeline_risks.push('tight_timeline_constraints');
        }

        if (analysis.complexity_breakdown.quality > 0.8) {
            risks.quality_risks.push('strict_quality_requirements');
        }

        return risks;
    }

    async generateComplexityRecommendations(analysis) {
        const recommendations = [];

        if (analysis.overall_complexity > 0.8) {
            recommendations.push({
                type: 'complexity_reduction',
                priority: 'high',
                suggestion: 'Consider breaking down the task into smaller, more manageable components'
            });
        }

        if (analysis.domain_count > 3) {
            recommendations.push({
                type: 'coordination_strategy',
                priority: 'medium',
                suggestion: 'Implement strong coordination mechanisms for multi-domain collaboration'
            });
        }

        if (analysis.complexity_breakdown.temporal > 0.7) {
            recommendations.push({
                type: 'timeline_management',
                priority: 'high',
                suggestion: 'Consider timeline adjustments or parallel execution strategies'
            });
        }

        return recommendations;
    }

    hasIndicator(taskRequirements, indicator) {
        // Simple indicator checking logic
        const indicators = taskRequirements.indicators || [];
        return indicators.includes(indicator) ||
               (taskRequirements.description || '').toLowerCase().includes(indicator.replace('_', ' '));
    }
}

module.exports = { WorkflowComplexityAnalyzer };