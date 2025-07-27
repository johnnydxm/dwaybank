/**
 * DwayBank Sub-Agent Integration with Task Master
 * Orchestration layer for managing specialized financial system agents
 */

const fs = require('fs');
const path = require('path');

class DwayBankAgentOrchestrator {
    constructor(taskMasterConfig) {
        this.taskMasterConfig = taskMasterConfig;
        this.agentConfig = this.loadAgentConfiguration();
        this.activeAgents = new Map();
        this.performanceMetrics = new Map();
        this.initializeOrchestrator();
    }

    /**
     * Load agent configuration from JSON file
     */
    loadAgentConfiguration() {
        const configPath = path.join(__dirname, 'agent-orchestration-config.json');
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData).dwaybank_agent_orchestration;
    }

    /**
     * Initialize orchestrator with Task Master integration
     */
    initializeOrchestrator() {
        console.log('Initializing DwayBank Agent Orchestrator...');
        this.validateAgentDefinitions();
        this.setupMCPCoordination();
        this.initializePerformanceMonitoring();
        console.log('Agent Orchestrator initialized successfully');
    }

    /**
     * Main agent selection algorithm
     * @param {string} task - Task description
     * @param {Object} context - Task context and requirements
     * @returns {Object} Selected agent configuration
     */
    selectAgent(task, context = {}) {
        const taskAnalysis = this.analyzeTask(task, context);
        
        // Primary selection based on domain expertise
        let selectedAgent = this.primaryAgentSelection(taskAnalysis);
        
        // Fallback selection if primary fails
        if (!selectedAgent || selectedAgent.confidence < this.agentConfig.agent_selection_algorithms.primary_selection.confidence_threshold) {
            selectedAgent = this.fallbackAgentSelection(taskAnalysis);
        }

        // Multi-agent coordination if needed
        const additionalAgents = this.evaluateMultiAgentNeeds(taskAnalysis, selectedAgent);

        return {
            primary: selectedAgent,
            supporting: additionalAgents,
            coordination_strategy: this.determineCoordinationStrategy(selectedAgent, additionalAgents),
            resource_allocation: this.calculateResourceAllocation(selectedAgent, additionalAgents)
        };
    }

    /**
     * Analyze task to determine requirements and complexity
     * @param {string} task - Task description
     * @param {Object} context - Additional context
     * @returns {Object} Task analysis results
     */
    analyzeTask(task, context) {
        const keywords = this.extractKeywords(task);
        const domains = this.identifyDomains(keywords, context);
        const complexity = this.assessComplexity(task, context);
        const financialAspects = this.identifyFinancialAspects(task, keywords);

        return {
            task: task,
            context: context,
            keywords: keywords,
            domains: domains,
            complexity: complexity,
            financial_aspects: financialAspects,
            urgency: context.urgency || 'medium',
            compliance_requirements: this.identifyComplianceRequirements(task, keywords)
        };
    }

    /**
     * Primary agent selection based on domain expertise
     * @param {Object} taskAnalysis - Task analysis results
     * @returns {Object} Selected agent with confidence score
     */
    primaryAgentSelection(taskAnalysis) {
        const agents = this.agentConfig.agent_definitions;
        const weights = this.agentConfig.agent_selection_algorithms.primary_selection.weights;
        
        let bestAgent = null;
        let highestScore = 0;

        for (const [agentName, agentDef] of Object.entries(agents)) {
            const score = this.calculateAgentScore(agentDef, taskAnalysis, weights);
            
            if (score > highestScore) {
                highestScore = score;
                bestAgent = {
                    name: agentName,
                    definition: agentDef,
                    confidence: score,
                    selection_reasoning: this.generateSelectionReasoning(agentDef, taskAnalysis, score)
                };
            }
        }

        return bestAgent;
    }

    /**
     * Calculate agent suitability score
     * @param {Object} agentDef - Agent definition
     * @param {Object} taskAnalysis - Task analysis
     * @param {Object} weights - Scoring weights
     * @returns {number} Suitability score (0-1)
     */
    calculateAgentScore(agentDef, taskAnalysis, weights) {
        // Keyword matching score
        const keywordScore = this.calculateKeywordMatch(
            agentDef.activation_triggers.keywords,
            taskAnalysis.keywords
        );

        // Domain expertise score
        const domainScore = this.calculateDomainMatch(
            agentDef.domains,
            taskAnalysis.domains
        );

        // Complexity alignment score
        const complexityScore = this.calculateComplexityAlignment(
            agentDef.activation_triggers.complexity_threshold,
            taskAnalysis.complexity
        );

        // Resource availability score
        const resourceScore = this.calculateResourceAvailability(agentDef);

        // Financial aspect alignment
        const financialScore = this.calculateFinancialAlignment(
            agentDef,
            taskAnalysis.financial_aspects
        );

        // Compliance requirement alignment
        const complianceScore = this.calculateComplianceAlignment(
            agentDef,
            taskAnalysis.compliance_requirements
        );

        return (
            keywordScore * weights.keyword_match +
            domainScore * weights.domain_expertise +
            complexityScore * weights.complexity_alignment +
            resourceScore * weights.resource_availability +
            financialScore * 0.1 +
            complianceScore * 0.1
        );
    }

    /**
     * Evaluate need for multi-agent coordination
     * @param {Object} taskAnalysis - Task analysis
     * @param {Object} primaryAgent - Primary selected agent
     * @returns {Array} Supporting agents if needed
     */
    evaluateMultiAgentNeeds(taskAnalysis, primaryAgent) {
        const supportingAgents = [];
        const coordinationPatterns = this.agentConfig.agent_selection_algorithms.multi_agent_coordination.coordination_patterns;

        // Check for predefined coordination patterns
        for (const [pattern, weight] of Object.entries(coordinationPatterns)) {
            const [agent1, agent2] = pattern.split('_');
            if (primaryAgent.name.includes(agent1)) {
                const supportingAgentName = `dwaybank-${agent2}`;
                if (this.agentConfig.agent_definitions[supportingAgentName]) {
                    supportingAgents.push({
                        name: supportingAgentName,
                        definition: this.agentConfig.agent_definitions[supportingAgentName],
                        coordination_weight: weight,
                        role: 'supporting'
                    });
                }
            }
        }

        // Additional agents based on task complexity
        if (taskAnalysis.complexity > 0.8) {
            this.addComplexityBasedAgents(taskAnalysis, supportingAgents);
        }

        // Compliance-required agents
        if (taskAnalysis.compliance_requirements.length > 0) {
            this.addComplianceAgents(taskAnalysis, supportingAgents);
        }

        return supportingAgents.slice(0, this.agentConfig.agent_selection_algorithms.multi_agent_coordination.max_concurrent_agents - 1);
    }

    /**
     * MCP Server coordination based on agent preferences
     * @param {Object} selectedAgents - Primary and supporting agents
     * @returns {Object} MCP coordination plan
     */
    coordinateMCPServers(selectedAgents) {
        const mcpPlan = {
            server_allocations: {},
            load_balancing: {},
            fallback_strategies: {}
        };

        // Primary agent MCP allocation
        const primaryMCP = selectedAgents.primary.definition.mcp_preferences.primary;
        mcpPlan.server_allocations[primaryMCP] = [selectedAgents.primary.name];

        // Supporting agents MCP allocation
        selectedAgents.supporting.forEach(agent => {
            const agentMCP = agent.definition.mcp_preferences.primary;
            if (!mcpPlan.server_allocations[agentMCP]) {
                mcpPlan.server_allocations[agentMCP] = [];
            }
            mcpPlan.server_allocations[agentMCP].push(agent.name);
        });

        // Load balancing strategy
        mcpPlan.load_balancing = this.calculateMCPLoadBalancing(mcpPlan.server_allocations);

        // Fallback strategies
        mcpPlan.fallback_strategies = this.agentConfig.mcp_server_coordination.coordination_strategies.fallback_chains;

        return mcpPlan;
    }

    /**
     * Resource allocation for selected agents
     * @param {Object} primaryAgent - Primary agent
     * @param {Array} supportingAgents - Supporting agents
     * @returns {Object} Resource allocation plan
     */
    calculateResourceAllocation(primaryAgent, supportingAgents) {
        const totalAgents = 1 + supportingAgents.length;
        const allocation = {
            primary: {
                context_percentage: Math.max(60, 100 - (supportingAgents.length * 15)),
                priority: 'high',
                resource_pool: this.determineResourcePool(primaryAgent.name)
            },
            supporting: supportingAgents.map((agent, index) => ({
                name: agent.name,
                context_percentage: Math.max(10, (40 - (supportingAgents.length * 10)) / supportingAgents.length),
                priority: 'medium',
                resource_pool: this.determineResourcePool(agent.name)
            }))
        };

        return allocation;
    }

    /**
     * Monitor agent performance and adjust selections
     */
    monitorPerformance() {
        setInterval(() => {
            this.collectPerformanceMetrics();
            this.adjustSelectionAlgorithms();
            this.reportPerformanceToTaskMaster();
        }, 30000); // Every 30 seconds
    }

    /**
     * Integration with Task Master's existing workflow
     * @param {string} taskMasterCommand - Task Master command
     * @param {Object} context - Task context
     * @returns {Object} Agent delegation plan
     */
    integrateWithTaskMaster(taskMasterCommand, context) {
        // Parse Task Master command
        const parsedCommand = this.parseTaskMasterCommand(taskMasterCommand);
        
        // Map to financial domain requirements
        const financialContext = this.mapToFinancialDomain(parsedCommand, context);
        
        // Select appropriate agents
        const agentSelection = this.selectAgent(parsedCommand.task, financialContext);
        
        // Create execution plan
        const executionPlan = this.createExecutionPlan(agentSelection, parsedCommand);
        
        // Coordinate with Task Master's resource allocation
        this.coordinateWithTaskMaster(executionPlan);
        
        return executionPlan;
    }

    /**
     * Financial domain-specific optimizations
     */
    applyFinancialOptimizations(agentSelection, taskAnalysis) {
        const optimizations = this.agentConfig.financial_domain_optimization;
        
        // Apply compliance requirements
        if (taskAnalysis.compliance_requirements.includes('pci_dss')) {
            this.enforcePCICompliance(agentSelection);
        }
        
        if (taskAnalysis.compliance_requirements.includes('sox')) {
            this.enforceSOXCompliance(agentSelection);
        }
        
        // Apply financial accuracy requirements
        if (taskAnalysis.financial_aspects.includes('calculations')) {
            this.enforceCalculationPrecision(agentSelection);
        }
        
        return agentSelection;
    }

    // Utility methods for task analysis
    extractKeywords(task) {
        const financialKeywords = [
            'payment', 'transaction', 'account', 'balance', 'transfer', 'banking',
            'financial', 'compliance', 'security', 'audit', 'regulation', 'pci',
            'sox', 'gdpr', 'architecture', 'api', 'database', 'frontend', 'backend'
        ];
        
        const taskLower = task.toLowerCase();
        return financialKeywords.filter(keyword => taskLower.includes(keyword));
    }

    identifyDomains(keywords, context) {
        const domainMapping = {
            architecture: ['architecture', 'design', 'system', 'scalability'],
            frontend: ['ui', 'ux', 'component', 'interface', 'accessibility'],
            backend: ['api', 'database', 'service', 'processing'],
            security: ['security', 'compliance', 'audit', 'vulnerability'],
            performance: ['performance', 'optimization', 'speed', 'bottleneck'],
            testing: ['test', 'quality', 'validation', 'verification']
        };

        const identifiedDomains = [];
        for (const [domain, domainKeywords] of Object.entries(domainMapping)) {
            if (keywords.some(keyword => domainKeywords.includes(keyword))) {
                identifiedDomains.push(domain);
            }
        }

        return identifiedDomains;
    }

    assessComplexity(task, context) {
        let complexity = 0.3; // Base complexity
        
        // Increase complexity based on indicators
        if (task.includes('comprehensive') || task.includes('complete')) complexity += 0.3;
        if (task.includes('security') || task.includes('compliance')) complexity += 0.2;
        if (task.includes('architecture') || task.includes('design')) complexity += 0.2;
        if (context.multi_domain || context.cross_system) complexity += 0.3;
        
        return Math.min(complexity, 1.0);
    }

    identifyFinancialAspects(task, keywords) {
        const aspects = [];
        if (keywords.some(k => ['payment', 'transaction', 'transfer'].includes(k))) {
            aspects.push('payment_processing');
        }
        if (keywords.some(k => ['account', 'balance', 'banking'].includes(k))) {
            aspects.push('account_management');
        }
        if (keywords.some(k => ['compliance', 'audit', 'regulation'].includes(k))) {
            aspects.push('regulatory_compliance');
        }
        if (keywords.some(k => ['security', 'fraud', 'protection'].includes(k))) {
            aspects.push('financial_security');
        }
        
        return aspects;
    }

    identifyComplianceRequirements(task, keywords) {
        const requirements = [];
        if (keywords.includes('pci') || task.toLowerCase().includes('card')) {
            requirements.push('pci_dss');
        }
        if (keywords.includes('sox') || task.toLowerCase().includes('financial reporting')) {
            requirements.push('sox_compliance');
        }
        if (keywords.includes('gdpr') || keywords.includes('privacy')) {
            requirements.push('gdpr_ccpa');
        }
        
        return requirements;
    }

    // Additional helper methods would be implemented here...
    
    calculateKeywordMatch(triggerKeywords, taskKeywords) {
        const matches = triggerKeywords.filter(tk => 
            taskKeywords.some(tk2 => tk.toLowerCase().includes(tk2.toLowerCase()) || 
                             tk2.toLowerCase().includes(tk.toLowerCase()))
        );
        return matches.length / Math.max(triggerKeywords.length, 1);
    }

    calculateDomainMatch(agentDomains, taskDomains) {
        const matches = agentDomains.filter(ad => taskDomains.includes(ad));
        return matches.length / Math.max(agentDomains.length, taskDomains.length, 1);
    }

    calculateComplexityAlignment(threshold, taskComplexity) {
        return Math.max(0, 1 - Math.abs(threshold - taskComplexity));
    }

    calculateResourceAvailability(agentDef) {
        // Simplified - would integrate with actual resource monitoring
        return 0.8;
    }

    calculateFinancialAlignment(agentDef, financialAspects) {
        const specialization = agentDef.specialization;
        const alignmentMap = {
            'systems_architecture': ['account_management', 'payment_processing'],
            'server_systems': ['payment_processing', 'account_management'],
            'threat_modeling': ['financial_security', 'regulatory_compliance'],
            'user_experience': ['account_management'],
            'optimization': ['payment_processing']
        };
        
        const relevantAspects = alignmentMap[specialization] || [];
        const matches = financialAspects.filter(fa => relevantAspects.includes(fa));
        return matches.length / Math.max(financialAspects.length, 1);
    }

    calculateComplianceAlignment(agentDef, complianceRequirements) {
        const securityAgents = ['dwaybank-security', 'dwaybank-backend'];
        const complianceAgents = ['dwaybank-security', 'dwaybank-scribe', 'dwaybank-analyzer'];
        
        if (complianceRequirements.length === 0) return 1.0;
        
        const agentName = Object.keys(this.agentConfig.agent_definitions).find(name => 
            this.agentConfig.agent_definitions[name] === agentDef
        );
        
        if (securityAgents.includes(agentName) || complianceAgents.includes(agentName)) {
            return 1.0;
        }
        
        return 0.5;
    }

    determineResourcePool(agentName) {
        const resourcePools = this.agentConfig.resource_management.allocation_strategy.resource_pools;
        for (const [pool, agents] of Object.entries(resourcePools)) {
            if (agents.some(a => agentName.includes(a.split('-')[1]))) {
                return pool;
            }
        }
        return 'medium_priority';
    }
}

module.exports = DwayBankAgentOrchestrator;"