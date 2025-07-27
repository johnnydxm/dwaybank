/**
 * DwayBank Ultra-Intelligent Agent Selection Algorithm
 * Advanced multi-dimensional agent selection and coalition formation system
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class UltraIntelligentAgentSelector extends EventEmitter {
    constructor(communicationBus, serverOptimizer) {
        super();
        this.communicationBus = communicationBus;
        this.serverOptimizer = serverOptimizer;
        this.agentRegistry = new Map();
        this.coalitionEngine = new CoalitionFormationEngine();
        this.capabilityMatcher = new AgentCapabilityMatcher();
        this.performancePredictor = new AgentPerformancePredictor();
        this.resourceOptimizer = new AgentResourceOptimizer();
        this.workflowAnalyzer = new WorkflowComplexityAnalyzer();
        
        this.initialize();
    }

    /**
     * Initialize the ultra-intelligent agent selection system
     */
    async initialize() {
        console.log('Initializing Ultra-Intelligent Agent Selector...');
        
        // Initialize agent registry with all 18 agents
        await this.initializeAgentRegistry();
        
        // Initialize coalition engine
        await this.coalitionEngine.initialize();
        
        // Initialize capability matcher
        await this.capabilityMatcher.initialize(this.agentRegistry);
        
        // Initialize performance predictor
        await this.performancePredictor.initialize(this.agentRegistry);
        
        // Initialize resource optimizer
        await this.resourceOptimizer.initialize();
        
        // Initialize workflow analyzer
        await this.workflowAnalyzer.initialize();
        
        console.log('Ultra-Intelligent Agent Selector initialized successfully');
        this.emit('selector_ready');
    }

    /**
     * Initialize comprehensive agent registry
     */
    async initializeAgentRegistry() {
        const agents = [
            // Financial Domain Agents (11)
            {
                id: 'dwaybank-architect',
                type: 'financial_specialist',
                domain: 'architecture',
                capabilities: ['system_design', 'scalability', 'architecture_review', 'technical_leadership'],
                expertise_level: 0.95,
                complexity_handling: 0.9,
                specializations: ['financial_architecture', 'compliance_architecture', 'security_architecture'],
                preferred_mcp_servers: ['sequential', 'context7'],
                resource_requirements: { cpu: 'medium', memory: 'high', context_window: 'large' },
                performance_metrics: { avg_response_time: 800, success_rate: 0.98, quality_score: 0.95 }
            },
            {
                id: 'dwaybank-frontend',
                type: 'financial_specialist',
                domain: 'frontend',
                capabilities: ['ui_development', 'user_experience', 'accessibility', 'responsive_design'],
                expertise_level: 0.92,
                complexity_handling: 0.8,
                specializations: ['financial_dashboards', 'trading_interfaces', 'mobile_banking'],
                preferred_mcp_servers: ['magic', 'playwright', 'context7'],
                resource_requirements: { cpu: 'medium', memory: 'medium', context_window: 'medium' },
                performance_metrics: { avg_response_time: 600, success_rate: 0.96, quality_score: 0.93 }
            },
            {
                id: 'dwaybank-backend',
                type: 'financial_specialist',
                domain: 'backend',
                capabilities: ['api_development', 'database_design', 'performance_optimization', 'security'],
                expertise_level: 0.94,
                complexity_handling: 0.9,
                specializations: ['payment_processing', 'trading_systems', 'financial_apis'],
                preferred_mcp_servers: ['context7', 'sequential'],
                resource_requirements: { cpu: 'high', memory: 'high', context_window: 'large' },
                performance_metrics: { avg_response_time: 700, success_rate: 0.97, quality_score: 0.94 }
            },
            {
                id: 'dwaybank-security',
                type: 'financial_specialist',
                domain: 'security',
                capabilities: ['threat_modeling', 'vulnerability_assessment', 'compliance', 'incident_response'],
                expertise_level: 0.96,
                complexity_handling: 0.95,
                specializations: ['financial_security', 'pci_compliance', 'fraud_detection'],
                preferred_mcp_servers: ['sequential', 'context7'],
                resource_requirements: { cpu: 'high', memory: 'high', context_window: 'large' },
                performance_metrics: { avg_response_time: 900, success_rate: 0.99, quality_score: 0.96 }
            },
            {
                id: 'dwaybank-performance',
                type: 'financial_specialist',
                domain: 'performance',
                capabilities: ['performance_analysis', 'optimization', 'scalability_testing', 'monitoring'],
                expertise_level: 0.91,
                complexity_handling: 0.85,
                specializations: ['trading_performance', 'payment_optimization', 'real_time_systems'],
                preferred_mcp_servers: ['playwright', 'sequential'],
                resource_requirements: { cpu: 'high', memory: 'medium', context_window: 'medium' },
                performance_metrics: { avg_response_time: 500, success_rate: 0.95, quality_score: 0.91 }
            },
            {
                id: 'dwaybank-analyzer',
                type: 'financial_specialist',
                domain: 'analysis',
                capabilities: ['root_cause_analysis', 'data_analysis', 'troubleshooting', 'investigation'],
                expertise_level: 0.93,
                complexity_handling: 0.88,
                specializations: ['financial_analysis', 'risk_analysis', 'compliance_analysis'],
                preferred_mcp_servers: ['sequential', 'context7'],
                resource_requirements: { cpu: 'medium', memory: 'high', context_window: 'large' },
                performance_metrics: { avg_response_time: 750, success_rate: 0.97, quality_score: 0.93 }
            },
            {
                id: 'dwaybank-qa',
                type: 'financial_specialist',
                domain: 'quality_assurance',
                capabilities: ['testing', 'quality_validation', 'automation', 'compliance_testing'],
                expertise_level: 0.89,
                complexity_handling: 0.82,
                specializations: ['financial_testing', 'regulatory_testing', 'security_testing'],
                preferred_mcp_servers: ['playwright', 'context7'],
                resource_requirements: { cpu: 'medium', memory: 'medium', context_window: 'medium' },
                performance_metrics: { avg_response_time: 650, success_rate: 0.94, quality_score: 0.89 }
            },
            {
                id: 'dwaybank-refactorer',
                type: 'financial_specialist',
                domain: 'refactoring',
                capabilities: ['code_quality', 'technical_debt', 'maintainability', 'clean_code'],
                expertise_level: 0.87,
                complexity_handling: 0.85,
                specializations: ['financial_code_quality', 'legacy_modernization', 'compliance_refactoring'],
                preferred_mcp_servers: ['sequential', 'context7'],
                resource_requirements: { cpu: 'medium', memory: 'medium', context_window: 'medium' },
                performance_metrics: { avg_response_time: 600, success_rate: 0.93, quality_score: 0.87 }
            },
            {
                id: 'dwaybank-mentor',
                type: 'financial_specialist',
                domain: 'mentoring',
                capabilities: ['knowledge_transfer', 'training', 'guidance', 'best_practices'],
                expertise_level: 0.85,
                complexity_handling: 0.75,
                specializations: ['financial_domain_training', 'compliance_education', 'security_awareness'],
                preferred_mcp_servers: ['context7', 'sequential'],
                resource_requirements: { cpu: 'low', memory: 'medium', context_window: 'medium' },
                performance_metrics: { avg_response_time: 400, success_rate: 0.92, quality_score: 0.85 }
            },
            {
                id: 'dwaybank-devops',
                type: 'financial_specialist',
                domain: 'devops',
                capabilities: ['deployment', 'infrastructure', 'automation', 'monitoring'],
                expertise_level: 0.88,
                complexity_handling: 0.83,
                specializations: ['financial_infrastructure', 'compliance_deployment', 'security_automation'],
                preferred_mcp_servers: ['sequential', 'context7'],
                resource_requirements: { cpu: 'medium', memory: 'medium', context_window: 'medium' },
                performance_metrics: { avg_response_time: 550, success_rate: 0.94, quality_score: 0.88 }
            },
            {
                id: 'dwaybank-scribe',
                type: 'financial_specialist',
                domain: 'documentation',
                capabilities: ['documentation', 'technical_writing', 'compliance_docs', 'localization'],
                expertise_level: 0.84,
                complexity_handling: 0.75,
                specializations: ['financial_documentation', 'regulatory_documentation', 'api_documentation'],
                preferred_mcp_servers: ['context7', 'sequential'],
                resource_requirements: { cpu: 'low', memory: 'medium', context_window: 'medium' },
                performance_metrics: { avg_response_time: 450, success_rate: 0.91, quality_score: 0.84 }
            },

            // Management Agents (7)
            {
                id: 'taskmaster-project-manager',
                type: 'management',
                domain: 'project_management',
                capabilities: ['project_coordination', 'resource_management', 'stakeholder_communication', 'planning'],
                expertise_level: 0.92,
                complexity_handling: 0.88,
                specializations: ['financial_project_management', 'compliance_coordination', 'multi_agent_orchestration'],
                preferred_mcp_servers: ['taskmaster_ai', 'sequential'],
                resource_requirements: { cpu: 'medium', memory: 'high', context_window: 'large' },
                performance_metrics: { avg_response_time: 700, success_rate: 0.96, quality_score: 0.92 }
            },
            {
                id: 'taskmaster-researcher',
                type: 'management',
                domain: 'research',
                capabilities: ['information_gathering', 'analysis', 'trend_identification', 'intelligence'],
                expertise_level: 0.90,
                complexity_handling: 0.85,
                specializations: ['financial_research', 'regulatory_research', 'technology_research'],
                preferred_mcp_servers: ['taskmaster_ai', 'context7'],
                resource_requirements: { cpu: 'medium', memory: 'high', context_window: 'large' },
                performance_metrics: { avg_response_time: 800, success_rate: 0.95, quality_score: 0.90 }
            },
            {
                id: 'taskmaster-orchestrator',
                type: 'management',
                domain: 'orchestration',
                capabilities: ['workflow_coordination', 'agent_management', 'decision_making', 'optimization'],
                expertise_level: 0.94,
                complexity_handling: 0.92,
                specializations: ['multi_agent_coordination', 'coalition_management', 'workflow_optimization'],
                preferred_mcp_servers: ['sequential', 'taskmaster_ai'],
                resource_requirements: { cpu: 'high', memory: 'high', context_window: 'large' },
                performance_metrics: { avg_response_time: 600, success_rate: 0.98, quality_score: 0.94 }
            },
            {
                id: 'taskmaster-monitor',
                type: 'management',
                domain: 'monitoring',
                capabilities: ['performance_monitoring', 'alerting', 'analytics', 'reporting'],
                expertise_level: 0.89,
                complexity_handling: 0.83,
                specializations: ['agent_performance_monitoring', 'financial_system_monitoring', 'compliance_monitoring'],
                preferred_mcp_servers: ['sequential', 'playwright'],
                resource_requirements: { cpu: 'medium', memory: 'high', context_window: 'medium' },
                performance_metrics: { avg_response_time: 400, success_rate: 0.97, quality_score: 0.89 }
            },
            {
                id: 'taskmaster-resource-manager',
                type: 'management',
                domain: 'resource_management',
                capabilities: ['resource_allocation', 'optimization', 'capacity_planning', 'cost_management'],
                expertise_level: 0.91,
                complexity_handling: 0.86,
                specializations: ['agent_resource_management', 'mcp_server_optimization', 'cost_optimization'],
                preferred_mcp_servers: ['sequential', 'taskmaster_ai'],
                resource_requirements: { cpu: 'medium', memory: 'high', context_window: 'medium' },
                performance_metrics: { avg_response_time: 500, success_rate: 0.96, quality_score: 0.91 }
            },
            {
                id: 'mcp-coordinator',
                type: 'management',
                domain: 'mcp_coordination',
                capabilities: ['server_management', 'optimization', 'failover', 'performance_tuning'],
                expertise_level: 0.93,
                complexity_handling: 0.89,
                specializations: ['mcp_server_optimization', 'load_balancing', 'cost_optimization'],
                preferred_mcp_servers: ['taskmaster_ai', 'context7'],
                resource_requirements: { cpu: 'medium', memory: 'medium', context_window: 'medium' },
                performance_metrics: { avg_response_time: 350, success_rate: 0.98, quality_score: 0.93 }
            },
            {
                id: 'quality-controller',
                type: 'management',
                domain: 'quality_control',
                capabilities: ['quality_validation', 'standards_enforcement', 'compliance_checking', 'audit'],
                expertise_level: 0.95,
                complexity_handling: 0.90,
                specializations: ['financial_quality_control', 'regulatory_compliance', 'multi_agent_validation'],
                preferred_mcp_servers: ['sequential', 'context7'],
                resource_requirements: { cpu: 'medium', memory: 'high', context_window: 'large' },
                performance_metrics: { avg_response_time: 650, success_rate: 0.99, quality_score: 0.95 }
            }
        ];

        // Register all agents
        for (const agentConfig of agents) {
            const agent = new AgentProfile(agentConfig);
            this.agentRegistry.set(agentConfig.id, agent);
        }

        console.log(`Registered ${this.agentRegistry.size} agents in the ecosystem`);
    }

    /**
     * Ultra-intelligent agent selection with multi-dimensional analysis
     */
    async selectOptimalAgents(taskRequirements) {
        const startTime = Date.now();
        
        try {
            // Step 1: Analyze workflow complexity
            const complexityAnalysis = await this.workflowAnalyzer.analyzeComplexity(taskRequirements);
            
            // Step 2: Determine optimal strategy
            const selectionStrategy = this.determineSelectionStrategy(complexityAnalysis);
            
            // Step 3: Execute agent selection based on strategy
            let selectedAgents;
            
            switch (selectionStrategy.type) {
                case 'single_agent':
                    selectedAgents = await this.selectSingleAgent(taskRequirements, complexityAnalysis);
                    break;
                case 'coalition':
                    selectedAgents = await this.formCoalition(taskRequirements, complexityAnalysis);
                    break;
                case 'hierarchical':
                    selectedAgents = await this.formHierarchicalTeam(taskRequirements, complexityAnalysis);
                    break;
                case 'parallel':
                    selectedAgents = await this.formParallelTeam(taskRequirements, complexityAnalysis);
                    break;
                default:
                    throw new Error(`Unknown selection strategy: ${selectionStrategy.type}`);
            }

            // Step 4: Optimize selection based on current system state
            const optimizedSelection = await this.optimizeSelection(selectedAgents, taskRequirements);
            
            // Step 5: Predict performance and validate selection
            const performancePrediction = await this.performancePredictor.predictPerformance(
                optimizedSelection, taskRequirements
            );
            
            const selectionTime = Date.now() - startTime;
            
            this.emit('agents_selected', {
                task_id: taskRequirements.task_id,
                selected_agents: optimizedSelection,
                strategy: selectionStrategy,
                complexity_analysis: complexityAnalysis,
                performance_prediction: performancePrediction,
                selection_time: selectionTime
            });

            return {
                agents: optimizedSelection,
                strategy: selectionStrategy,
                complexity: complexityAnalysis,
                prediction: performancePrediction,
                metadata: {
                    selection_time: selectionTime,
                    timestamp: new Date()
                }
            };

        } catch (error) {
            console.error('Agent selection failed:', error);
            this.emit('selection_error', {
                task_id: taskRequirements.task_id,
                error: error.message,
                requirements: taskRequirements
            });
            throw error;
        }
    }

    /**
     * Determine optimal selection strategy based on complexity analysis
     */
    determineSelectionStrategy(complexityAnalysis) {
        const {
            overall_complexity,
            domain_count,
            capability_requirements,
            resource_intensity,
            time_constraints,
            quality_requirements
        } = complexityAnalysis;

        // Single agent strategy
        if (overall_complexity < 0.3 && domain_count === 1 && capability_requirements.length <= 2) {
            return {
                type: 'single_agent',
                confidence: 0.95,
                reasoning: 'Simple task with single domain and minimal capabilities'
            };
        }

        // Coalition strategy for complex multi-domain tasks
        if (overall_complexity > 0.7 && domain_count >= 3) {
            return {
                type: 'coalition',
                confidence: 0.9,
                reasoning: 'Complex multi-domain task requiring specialized collaboration'
            };
        }

        // Hierarchical strategy for structured workflows
        if (resource_intensity > 0.8 || quality_requirements > 0.9) {
            return {
                type: 'hierarchical',
                confidence: 0.85,
                reasoning: 'High resource/quality requirements need structured coordination'
            };
        }

        // Parallel strategy for time-constrained tasks
        if (time_constraints > 0.8 && domain_count > 1) {
            return {
                type: 'parallel',
                confidence: 0.8,
                reasoning: 'Time constraints require parallel execution'
            };
        }

        // Default to coalition for moderate complexity
        return {
            type: 'coalition',
            confidence: 0.75,
            reasoning: 'Moderate complexity task suitable for coalition approach'
        };
    }

    /**
     * Select single optimal agent
     */
    async selectSingleAgent(taskRequirements, complexityAnalysis) {
        const candidates = await this.capabilityMatcher.findCapableAgents(
            taskRequirements.capabilities,
            taskRequirements.domain
        );

        if (candidates.length === 0) {
            throw new Error('No capable agents found for task requirements');
        }

        // Calculate selection scores for each candidate
        const scoredCandidates = await Promise.all(
            candidates.map(async agent => ({
                agent,
                score: await this.calculateAgentScore(agent, taskRequirements, complexityAnalysis)
            }))
        );

        // Sort by score and select the best
        scoredCandidates.sort((a, b) => b.score - a.score);
        
        return [{
            agent: scoredCandidates[0].agent,
            role: 'primary',
            score: scoredCandidates[0].score,
            allocation: 1.0
        }];
    }

    /**
     * Form intelligent coalition
     */
    async formCoalition(taskRequirements, complexityAnalysis) {
        return await this.coalitionEngine.formOptimalCoalition(
            taskRequirements,
            complexityAnalysis,
            this.agentRegistry
        );
    }

    /**
     * Form hierarchical team structure
     */
    async formHierarchicalTeam(taskRequirements, complexityAnalysis) {
        // Select lead agent
        const leadAgent = await this.selectTeamLead(taskRequirements, complexityAnalysis);
        
        // Select supporting agents
        const supportingAgents = await this.selectSupportingAgents(
            leadAgent, taskRequirements, complexityAnalysis
        );
        
        // Create hierarchical structure
        return [
            { agent: leadAgent, role: 'lead', allocation: 0.4 },
            ...supportingAgents.map((agent, index) => ({
                agent,
                role: `support_${index + 1}`,
                allocation: 0.6 / supportingAgents.length
            }))
        ];
    }

    /**
     * Form parallel execution team
     */
    async formParallelTeam(taskRequirements, complexityAnalysis) {
        // Decompose task into parallel workstreams
        const workstreams = await this.decomposeIntoWorkstreams(taskRequirements);
        
        const parallelTeam = [];
        
        for (const workstream of workstreams) {
            const agents = await this.selectSingleAgent(workstream, complexityAnalysis);
            parallelTeam.push({
                agent: agents[0].agent,
                role: `parallel_${workstream.domain}`,
                allocation: 1.0 / workstreams.length,
                workstream: workstream.id
            });
        }
        
        return parallelTeam;
    }

    /**
     * Calculate comprehensive agent scoring
     */
    async calculateAgentScore(agent, taskRequirements, complexityAnalysis) {
        const weights = {
            capability_match: 0.3,
            expertise_level: 0.25,
            performance_history: 0.2,
            resource_efficiency: 0.15,
            availability: 0.1
        };

        const scores = {
            capability_match: await this.capabilityMatcher.calculateMatch(
                agent, taskRequirements.capabilities
            ),
            expertise_level: agent.getExpertiseLevel(taskRequirements.domain),
            performance_history: await this.performancePredictor.getHistoricalPerformance(agent.id),
            resource_efficiency: await this.resourceOptimizer.calculateEfficiency(agent),
            availability: await this.calculateAgentAvailability(agent)
        };

        // Calculate weighted score
        let totalScore = 0;
        for (const [factor, weight] of Object.entries(weights)) {
            totalScore += scores[factor] * weight;
        }

        // Apply complexity bonus/penalty
        if (complexityAnalysis.overall_complexity > 0.8 && agent.complexity_handling > 0.9) {
            totalScore *= 1.1; // 10% bonus for high complexity handling
        }

        return Math.min(1.0, totalScore);
    }

    /**
     * Optimize agent selection based on current system state
     */
    async optimizeSelection(selectedAgents, taskRequirements) {
        const optimizedAgents = [];
        
        for (const selection of selectedAgents) {
            // Check current load and availability
            const currentLoad = await this.getCurrentAgentLoad(selection.agent.id);
            const availability = await this.calculateAgentAvailability(selection.agent);
            
            // If agent is overloaded, find alternative
            if (currentLoad > 0.8 || availability < 0.7) {
                const alternative = await this.findAlternativeAgent(
                    selection.agent, taskRequirements
                );
                
                if (alternative && alternative.score > selection.score * 0.8) {
                    optimizedAgents.push({
                        ...selection,
                        agent: alternative.agent,
                        score: alternative.score,
                        optimization_reason: 'load_balancing'
                    });
                    continue;
                }
            }
            
            optimizedAgents.push(selection);
        }
        
        return optimizedAgents;
    }

    /**
     * Get current agent load
     */
    async getCurrentAgentLoad(agentId) {
        // This would integrate with actual agent monitoring
        // For now, simulate load calculation
        const agent = this.agentRegistry.get(agentId);
        return agent ? agent.getCurrentLoad() : 0;
    }

    /**
     * Calculate agent availability
     */
    async calculateAgentAvailability(agent) {
        // Simulate availability calculation
        const baseAvailability = 0.95;
        const loadPenalty = agent.getCurrentLoad() * 0.2;
        return Math.max(0, baseAvailability - loadPenalty);
    }

    /**
     * Find alternative agent
     */
    async findAlternativeAgent(originalAgent, taskRequirements) {
        const alternatives = await this.capabilityMatcher.findSimilarAgents(
            originalAgent, taskRequirements
        );
        
        if (alternatives.length === 0) return null;
        
        const scored = await Promise.all(
            alternatives.map(async agent => ({
                agent,
                score: await this.calculateAgentScore(agent, taskRequirements, {})
            }))
        );
        
        scored.sort((a, b) => b.score - a.score);
        return scored[0];
    }

    /**
     * Select team lead
     */
    async selectTeamLead(taskRequirements, complexityAnalysis) {
        // Find agents with leadership capabilities
        const leaders = Array.from(this.agentRegistry.values()).filter(agent =>
            agent.hasCapability('leadership') || 
            agent.type === 'management' ||
            agent.expertise_level > 0.9
        );
        
        if (leaders.length === 0) {
            // Fallback to highest expertise agent
            return this.selectSingleAgent(taskRequirements, complexityAnalysis)[0].agent;
        }
        
        const scored = await Promise.all(
            leaders.map(async agent => ({
                agent,
                score: await this.calculateAgentScore(agent, taskRequirements, complexityAnalysis)
            }))
        );
        
        scored.sort((a, b) => b.score - a.score);
        return scored[0].agent;
    }

    /**
     * Select supporting agents
     */
    async selectSupportingAgents(leadAgent, taskRequirements, complexityAnalysis) {
        const requiredCapabilities = taskRequirements.capabilities.filter(cap =>
            !leadAgent.hasCapability(cap)
        );
        
        const supportingAgents = [];
        
        for (const capability of requiredCapabilities) {
            const candidates = await this.capabilityMatcher.findCapableAgents([capability]);
            if (candidates.length > 0) {
                const best = await this.selectBestCandidate(candidates, taskRequirements);
                if (!supportingAgents.find(agent => agent.id === best.id)) {
                    supportingAgents.push(best);
                }
            }
        }
        
        return supportingAgents;
    }

    /**
     * Select best candidate from list
     */
    async selectBestCandidate(candidates, taskRequirements) {
        const scored = await Promise.all(
            candidates.map(async agent => ({
                agent,
                score: await this.calculateAgentScore(agent, taskRequirements, {})
            }))
        );
        
        scored.sort((a, b) => b.score - a.score);
        return scored[0].agent;
    }

    /**
     * Decompose task into parallel workstreams
     */
    async decomposeIntoWorkstreams(taskRequirements) {
        // Analyze task and identify independent workstreams
        const workstreams = [];
        
        // Group capabilities by domain
        const domainGroups = {};
        for (const capability of taskRequirements.capabilities) {
            const domain = this.getDomainForCapability(capability);
            if (!domainGroups[domain]) {
                domainGroups[domain] = [];
            }
            domainGroups[domain].push(capability);
        }
        
        // Create workstream for each domain
        for (const [domain, capabilities] of Object.entries(domainGroups)) {
            workstreams.push({
                id: `workstream_${domain}_${Date.now()}`,
                domain,
                capabilities,
                estimated_effort: capabilities.length * 0.2
            });
        }
        
        return workstreams;
    }

    /**
     * Get domain for capability
     */
    getDomainForCapability(capability) {
        const domainMapping = {
            'ui_development': 'frontend',
            'api_development': 'backend',
            'security': 'security',
            'testing': 'qa',
            'architecture': 'architecture',
            'performance': 'performance',
            'documentation': 'documentation'
        };
        
        return domainMapping[capability] || 'general';
    }

    /**
     * Get comprehensive agent selection statistics
     */
    getSelectionStatistics() {
        const stats = {
            total_agents: this.agentRegistry.size,
            agent_utilization: {},
            selection_patterns: {},
            performance_metrics: {},
            optimization_effectiveness: {}
        };

        // Calculate agent utilization
        for (const [agentId, agent] of this.agentRegistry.entries()) {
            stats.agent_utilization[agentId] = {
                current_load: agent.getCurrentLoad(),
                average_score: agent.getAverageScore(),
                selection_frequency: agent.getSelectionFrequency()
            };
        }

        return stats;
    }
}

/**
 * Agent Profile class for enhanced agent management
 */
class AgentProfile {
    constructor(config) {
        this.id = config.id;
        this.type = config.type;
        this.domain = config.domain;
        this.capabilities = new Set(config.capabilities);
        this.expertise_level = config.expertise_level;
        this.complexity_handling = config.complexity_handling;
        this.specializations = config.specializations;
        this.preferred_mcp_servers = config.preferred_mcp_servers;
        this.resource_requirements = config.resource_requirements;
        this.performance_metrics = config.performance_metrics;
        
        // Runtime state
        this.current_load = 0;
        this.selection_history = [];
        this.performance_history = [];
        this.last_used = null;
    }

    hasCapability(capability) {
        return this.capabilities.has(capability);
    }

    getExpertiseLevel(domain) {
        if (this.domain === domain) {
            return this.expertise_level;
        }
        
        // Check specializations
        const domainSpecialization = this.specializations.find(spec => 
            spec.includes(domain)
        );
        
        return domainSpecialization ? this.expertise_level * 0.8 : this.expertise_level * 0.6;
    }

    getCurrentLoad() {
        return this.current_load;
    }

    updateLoad(newLoad) {
        this.current_load = Math.max(0, Math.min(1, newLoad));
    }

    addToSelectionHistory(taskId, score, outcome) {
        this.selection_history.push({
            task_id: taskId,
            score: score,
            outcome: outcome,
            timestamp: new Date()
        });
        
        // Keep only last 100 selections
        if (this.selection_history.length > 100) {
            this.selection_history.shift();
        }
    }

    getAverageScore() {
        if (this.selection_history.length === 0) return 0;
        
        const totalScore = this.selection_history.reduce((sum, record) => 
            sum + record.score, 0
        );
        
        return totalScore / this.selection_history.length;
    }

    getSelectionFrequency() {
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        
        const recentSelections = this.selection_history.filter(record =>
            now - record.timestamp.getTime() < oneWeek
        );
        
        return recentSelections.length;
    }
}

module.exports = { UltraIntelligentAgentSelector, AgentProfile };