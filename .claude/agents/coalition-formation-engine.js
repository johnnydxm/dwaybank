/**
 * Coalition Formation Engine
 * Advanced algorithms for optimal agent coalition formation
 */

const EventEmitter = require('events');

class CoalitionFormationEngine extends EventEmitter {
    constructor() {
        super();
        this.coalitionHistory = new Map();
        this.coalitionTemplates = new Map();
        this.performanceMetrics = new Map();
        this.synergyCatalog = new Map();
    }

    async initialize() {
        this.setupCoalitionTemplates();
        this.setupSynergyCatalog();
        console.log('Coalition Formation Engine initialized');
    }

    /**
     * Form optimal coalition using multi-algorithm approach
     */
    async formOptimalCoalition(taskRequirements, complexityAnalysis, agentRegistry) {
        const coalitionCandidates = await this.generateCoalitionCandidates(
            taskRequirements, complexityAnalysis, agentRegistry
        );

        // Evaluate each coalition candidate
        const evaluatedCoalitions = await Promise.all(
            coalitionCandidates.map(async coalition => ({
                coalition,
                evaluation: await this.evaluateCoalition(coalition, taskRequirements, complexityAnalysis)
            }))
        );

        // Select best coalition
        evaluatedCoalitions.sort((a, b) => b.evaluation.total_score - a.evaluation.total_score);
        
        const bestCoalition = evaluatedCoalitions[0];
        
        // Record coalition formation
        await this.recordCoalitionFormation(bestCoalition, taskRequirements);
        
        return bestCoalition.coalition;
    }

    /**
     * Generate coalition candidates using multiple strategies
     */
    async generateCoalitionCandidates(taskRequirements, complexityAnalysis, agentRegistry) {
        const candidates = [];

        // Strategy 1: Template-based coalition formation
        const templateBasedCandidates = await this.generateTemplateBasedCoalitions(
            taskRequirements, agentRegistry
        );
        candidates.push(...templateBasedCandidates);

        // Strategy 2: Capability-driven coalition formation
        const capabilityDrivenCandidates = await this.generateCapabilityDrivenCoalitions(
            taskRequirements, agentRegistry
        );
        candidates.push(...capabilityDrivenCandidates);

        // Strategy 3: Synergy-optimized coalition formation
        const synergyOptimizedCandidates = await this.generateSynergyOptimizedCoalitions(
            taskRequirements, agentRegistry
        );
        candidates.push(...synergyOptimizedCandidates);

        // Strategy 4: Evolutionary coalition formation
        const evolutionaryCandidates = await this.generateEvolutionaryCoalitions(
            taskRequirements, complexityAnalysis, agentRegistry
        );
        candidates.push(...evolutionaryCandidates);

        // Remove duplicates and limit candidates
        return this.deduplicate(candidates).slice(0, 10);
    }

    /**
     * Generate template-based coalitions for common patterns
     */
    async generateTemplateBasedCoalitions(taskRequirements, agentRegistry) {
        const candidates = [];
        const domain = taskRequirements.domain || 'general';
        
        // Check for matching templates
        for (const [templateId, template] of this.coalitionTemplates.entries()) {
            if (this.templateMatches(template, taskRequirements)) {
                const coalition = await this.instantiateTemplate(template, agentRegistry, taskRequirements);
                if (coalition) {
                    candidates.push(coalition);
                }
            }
        }

        return candidates;
    }

    /**
     * Generate capability-driven coalitions
     */
    async generateCapabilityDrivenCoalitions(taskRequirements, agentRegistry) {
        const candidates = [];
        const requiredCapabilities = taskRequirements.capabilities || [];
        
        if (requiredCapabilities.length === 0) return candidates;

        // Create coalition by selecting best agent for each capability
        const coalition = [];
        const usedAgents = new Set();

        for (const capability of requiredCapabilities) {
            const capableAgents = Array.from(agentRegistry.values())
                .filter(agent => agent.hasCapability(capability) && !usedAgents.has(agent.id))
                .sort((a, b) => b.getExpertiseLevel(capability) - a.getExpertiseLevel(capability));

            if (capableAgents.length > 0) {
                const selectedAgent = capableAgents[0];
                coalition.push({
                    agent: selectedAgent,
                    role: `${capability}_specialist`,
                    allocation: 1.0 / requiredCapabilities.length,
                    primary_capability: capability
                });
                usedAgents.add(selectedAgent.id);
            }
        }

        if (coalition.length > 0) {
            candidates.push(coalition);
        }

        return candidates;
    }

    /**
     * Generate synergy-optimized coalitions
     */
    async generateSynergyOptimizedCoalitions(taskRequirements, agentRegistry) {
        const candidates = [];
        const agentList = Array.from(agentRegistry.values());
        
        // Use greedy algorithm to build coalitions with maximum synergy
        for (let size = 2; size <= Math.min(5, agentList.length); size++) {
            const coalition = await this.buildSynergyOptimizedCoalition(
                agentList, taskRequirements, size
            );
            if (coalition) {
                candidates.push(coalition);
            }
        }

        return candidates;
    }

    /**
     * Generate evolutionary coalitions using genetic algorithm
     */
    async generateEvolutionaryCoalitions(taskRequirements, complexityAnalysis, agentRegistry) {
        const candidates = [];
        const agentList = Array.from(agentRegistry.values());
        const populationSize = 20;
        const generations = 10;

        // Initialize population
        let population = [];
        for (let i = 0; i < populationSize; i++) {
            population.push(await this.generateRandomCoalition(agentList, taskRequirements));
        }

        // Evolve population
        for (let gen = 0; gen < generations; gen++) {
            // Evaluate fitness
            const evaluated = await Promise.all(
                population.map(async coalition => ({
                    coalition,
                    fitness: await this.calculateCoalitionFitness(coalition, taskRequirements)
                }))
            );

            // Selection and reproduction
            evaluated.sort((a, b) => b.fitness - a.fitness);
            const selected = evaluated.slice(0, Math.floor(populationSize / 2));

            // Create next generation
            const nextGeneration = selected.map(item => item.coalition);
            
            // Crossover and mutation
            while (nextGeneration.length < populationSize) {
                const parent1 = selected[Math.floor(Math.random() * selected.length)].coalition;
                const parent2 = selected[Math.floor(Math.random() * selected.length)].coalition;
                const offspring = await this.crossoverCoalitions(parent1, parent2);
                const mutated = await this.mutateCoalition(offspring, agentList);
                nextGeneration.push(mutated);
            }

            population = nextGeneration;
        }

        // Return best coalitions
        const finalEvaluated = await Promise.all(
            population.map(async coalition => ({
                coalition,
                fitness: await this.calculateCoalitionFitness(coalition, taskRequirements)
            }))
        );

        finalEvaluated.sort((a, b) => b.fitness - a.fitness);
        return finalEvaluated.slice(0, 3).map(item => item.coalition);
    }

    /**
     * Evaluate coalition effectiveness
     */
    async evaluateCoalition(coalition, taskRequirements, complexityAnalysis) {
        const evaluation = {
            capability_coverage: 0,
            expertise_score: 0,
            synergy_score: 0,
            resource_efficiency: 0,
            communication_overhead: 0,
            total_score: 0
        };

        // Calculate capability coverage
        evaluation.capability_coverage = await this.calculateCapabilityCoverage(
            coalition, taskRequirements
        );

        // Calculate expertise score
        evaluation.expertise_score = await this.calculateExpertiseScore(
            coalition, taskRequirements
        );

        // Calculate synergy score
        evaluation.synergy_score = await this.calculateSynergyScore(coalition);

        // Calculate resource efficiency
        evaluation.resource_efficiency = await this.calculateResourceEfficiency(coalition);

        // Calculate communication overhead
        evaluation.communication_overhead = await this.calculateCommunicationOverhead(coalition);

        // Calculate total score with weights
        const weights = {
            capability_coverage: 0.3,
            expertise_score: 0.25,
            synergy_score: 0.2,
            resource_efficiency: 0.15,
            communication_overhead: -0.1 // Negative weight (overhead is bad)
        };

        evaluation.total_score = Object.entries(weights).reduce((total, [metric, weight]) => {
            return total + (evaluation[metric] * weight);
        }, 0);

        return evaluation;
    }

    /**
     * Setup predefined coalition templates
     */
    setupCoalitionTemplates() {
        // Financial Development Coalition
        this.coalitionTemplates.set('financial_development', {
            id: 'financial_development',
            name: 'Financial Development Coalition',
            description: 'Standard coalition for financial software development',
            required_roles: ['architect', 'backend', 'frontend', 'security', 'qa'],
            optimal_size: 5,
            max_size: 7,
            domain_match: ['financial', 'backend', 'frontend'],
            capability_requirements: ['system_design', 'api_development', 'ui_development', 'security', 'testing'],
            synergy_patterns: [
                { agents: ['architect', 'backend'], synergy: 0.8 },
                { agents: ['backend', 'security'], synergy: 0.9 },
                { agents: ['frontend', 'qa'], synergy: 0.7 }
            ]
        });

        // Security Audit Coalition
        this.coalitionTemplates.set('security_audit', {
            id: 'security_audit',
            name: 'Security Audit Coalition',
            description: 'Specialized coalition for security audits and compliance',
            required_roles: ['security', 'analyzer', 'quality_controller'],
            optimal_size: 3,
            max_size: 5,
            domain_match: ['security', 'compliance'],
            capability_requirements: ['threat_modeling', 'vulnerability_assessment', 'compliance'],
            synergy_patterns: [
                { agents: ['security', 'analyzer'], synergy: 0.9 },
                { agents: ['security', 'quality_controller'], synergy: 0.8 }
            ]
        });

        // Performance Optimization Coalition
        this.coalitionTemplates.set('performance_optimization', {
            id: 'performance_optimization',
            name: 'Performance Optimization Coalition',
            description: 'Coalition for performance analysis and optimization',
            required_roles: ['performance', 'backend', 'analyzer'],
            optimal_size: 3,
            max_size: 4,
            domain_match: ['performance', 'optimization'],
            capability_requirements: ['performance_analysis', 'optimization', 'monitoring'],
            synergy_patterns: [
                { agents: ['performance', 'backend'], synergy: 0.8 },
                { agents: ['performance', 'analyzer'], synergy: 0.7 }
            ]
        });

        // Research Coalition
        this.coalitionTemplates.set('research_coalition', {
            id: 'research_coalition',
            name: 'Research Coalition',
            description: 'Coalition for research and analysis tasks',
            required_roles: ['researcher', 'analyzer', 'scribe'],
            optimal_size: 3,
            max_size: 4,
            domain_match: ['research', 'analysis'],
            capability_requirements: ['information_gathering', 'analysis', 'documentation'],
            synergy_patterns: [
                { agents: ['researcher', 'analyzer'], synergy: 0.9 },
                { agents: ['analyzer', 'scribe'], synergy: 0.8 }
            ]
        });
    }

    /**
     * Setup synergy catalog for agent combinations
     */
    setupSynergyCatalog() {
        // Define known synergies between agent types
        const synergies = [
            // Architecture synergies
            { agents: ['dwaybank-architect', 'dwaybank-backend'], synergy: 0.9, reason: 'Architecture-implementation alignment' },
            { agents: ['dwaybank-architect', 'dwaybank-security'], synergy: 0.8, reason: 'Security architecture integration' },
            
            // Security synergies
            { agents: ['dwaybank-security', 'dwaybank-backend'], synergy: 0.9, reason: 'Secure backend development' },
            { agents: ['dwaybank-security', 'dwaybank-qa'], synergy: 0.8, reason: 'Security testing integration' },
            
            // Frontend-QA synergies
            { agents: ['dwaybank-frontend', 'dwaybank-qa'], synergy: 0.8, reason: 'UI testing and validation' },
            { agents: ['dwaybank-frontend', 'dwaybank-performance'], synergy: 0.7, reason: 'Frontend performance optimization' },
            
            // Analysis synergies
            { agents: ['dwaybank-analyzer', 'dwaybank-performance'], synergy: 0.8, reason: 'Performance analysis expertise' },
            { agents: ['dwaybank-analyzer', 'dwaybank-security'], synergy: 0.9, reason: 'Security analysis and investigation' },
            
            // Management synergies
            { agents: ['taskmaster-project-manager', 'taskmaster-orchestrator'], synergy: 0.9, reason: 'Project coordination' },
            { agents: ['taskmaster-monitor', 'taskmaster-resource-manager'], synergy: 0.8, reason: 'Resource monitoring and optimization' },
            
            // Cross-domain synergies
            { agents: ['quality-controller', 'dwaybank-security'], synergy: 0.9, reason: 'Quality and security alignment' },
            { agents: ['mcp-coordinator', 'taskmaster-resource-manager'], synergy: 0.8, reason: 'Resource coordination' }
        ];

        for (const synergy of synergies) {
            const key = this.createSynergyKey(synergy.agents);
            this.synergyCatalog.set(key, synergy);
        }
    }

    /**
     * Calculate synergy between agents
     */
    async calculateSynergyScore(coalition) {
        if (coalition.length < 2) return 0;

        let totalSynergy = 0;
        let synergyCount = 0;

        // Calculate pairwise synergies
        for (let i = 0; i < coalition.length; i++) {
            for (let j = i + 1; j < coalition.length; j++) {
                const agent1 = coalition[i].agent;
                const agent2 = coalition[j].agent;
                const synergy = await this.calculatePairwiseSynergy(agent1, agent2);
                totalSynergy += synergy;
                synergyCount++;
            }
        }

        return synergyCount > 0 ? totalSynergy / synergyCount : 0;
    }

    /**
     * Calculate pairwise synergy between two agents
     */
    async calculatePairwiseSynergy(agent1, agent2) {
        const key = this.createSynergyKey([agent1.id, agent2.id]);
        const catalogSynergy = this.synergyCatalog.get(key);
        
        if (catalogSynergy) {
            return catalogSynergy.synergy;
        }

        // Calculate implicit synergy based on domain and capabilities
        let implicitSynergy = 0;

        // Domain synergy
        if (agent1.domain === agent2.domain) {
            implicitSynergy += 0.3;
        } else if (this.areComplementaryDomains(agent1.domain, agent2.domain)) {
            implicitSynergy += 0.5;
        }

        // Capability synergy
        const sharedCapabilities = this.getSharedCapabilities(agent1, agent2);
        const complementaryCapabilities = this.getComplementaryCapabilities(agent1, agent2);
        
        implicitSynergy += sharedCapabilities.length * 0.1;
        implicitSynergy += complementaryCapabilities.length * 0.2;

        // Type synergy (specialist + management)
        if ((agent1.type === 'financial_specialist' && agent2.type === 'management') ||
            (agent1.type === 'management' && agent2.type === 'financial_specialist')) {
            implicitSynergy += 0.2;
        }

        return Math.min(1.0, implicitSynergy);
    }

    /**
     * Helper methods
     */
    createSynergyKey(agents) {
        return agents.sort().join('|');
    }

    areComplementaryDomains(domain1, domain2) {
        const complementaryPairs = [
            ['frontend', 'backend'],
            ['security', 'backend'],
            ['performance', 'backend'],
            ['qa', 'frontend'],
            ['architecture', 'backend']
        ];

        return complementaryPairs.some(pair => 
            (pair[0] === domain1 && pair[1] === domain2) ||
            (pair[1] === domain1 && pair[0] === domain2)
        );
    }

    getSharedCapabilities(agent1, agent2) {
        return [...agent1.capabilities].filter(cap => agent2.capabilities.has(cap));
    }

    getComplementaryCapabilities(agent1, agent2) {
        const complementaryMap = {
            'system_design': ['api_development', 'ui_development'],
            'security': ['vulnerability_assessment', 'compliance'],
            'performance_analysis': ['optimization', 'monitoring']
        };

        const complementary = [];
        for (const cap1 of agent1.capabilities) {
            const complements = complementaryMap[cap1] || [];
            for (const cap2 of agent2.capabilities) {
                if (complements.includes(cap2)) {
                    complementary.push([cap1, cap2]);
                }
            }
        }

        return complementary;
    }

    templateMatches(template, taskRequirements) {
        // Check domain match
        if (template.domain_match && taskRequirements.domain) {
            if (!template.domain_match.includes(taskRequirements.domain)) {
                return false;
            }
        }

        // Check capability requirements
        if (template.capability_requirements && taskRequirements.capabilities) {
            const hasRequiredCapabilities = template.capability_requirements.some(cap =>
                taskRequirements.capabilities.includes(cap)
            );
            if (!hasRequiredCapabilities) {
                return false;
            }
        }

        return true;
    }

    async instantiateTemplate(template, agentRegistry, taskRequirements) {
        const coalition = [];
        const usedAgents = new Set();

        for (const role of template.required_roles) {
            // Find best agent for this role
            const candidates = Array.from(agentRegistry.values()).filter(agent =>
                !usedAgents.has(agent.id) && this.agentFitsRole(agent, role)
            );

            if (candidates.length === 0) {
                return null; // Cannot fulfill template
            }

            // Select best candidate
            const bestCandidate = candidates.reduce((best, current) =>
                current.expertise_level > best.expertise_level ? current : best
            );

            coalition.push({
                agent: bestCandidate,
                role: role,
                allocation: 1.0 / template.required_roles.length
            });

            usedAgents.add(bestCandidate.id);
        }

        return coalition;
    }

    agentFitsRole(agent, role) {
        // Role mapping logic
        const roleMap = {
            'architect': ['dwaybank-architect'],
            'backend': ['dwaybank-backend'],
            'frontend': ['dwaybank-frontend'],
            'security': ['dwaybank-security'],
            'qa': ['dwaybank-qa'],
            'performance': ['dwaybank-performance'],
            'analyzer': ['dwaybank-analyzer'],
            'researcher': ['taskmaster-researcher'],
            'quality_controller': ['quality-controller']
        };

        const validAgents = roleMap[role] || [];
        return validAgents.includes(agent.id) || agent.domain === role;
    }

    async buildSynergyOptimizedCoalition(agentList, taskRequirements, targetSize) {
        // Greedy algorithm to build coalition with maximum synergy
        const coalition = [];
        const availableAgents = [...agentList];

        // Start with highest expertise agent
        const startAgent = availableAgents.reduce((best, current) =>
            current.expertise_level > best.expertise_level ? current : best
        );

        coalition.push({
            agent: startAgent,
            role: 'lead',
            allocation: 1.0 / targetSize
        });

        availableAgents.splice(availableAgents.indexOf(startAgent), 1);

        // Add agents that maximize synergy
        while (coalition.length < targetSize && availableAgents.length > 0) {
            let bestAgent = null;
            let bestSynergy = -1;

            for (const agent of availableAgents) {
                const testCoalition = [...coalition, { agent, role: 'member', allocation: 0 }];
                const synergy = await this.calculateSynergyScore(testCoalition);
                
                if (synergy > bestSynergy) {
                    bestSynergy = synergy;
                    bestAgent = agent;
                }
            }

            if (bestAgent) {
                coalition.push({
                    agent: bestAgent,
                    role: 'member',
                    allocation: 1.0 / targetSize
                });
                availableAgents.splice(availableAgents.indexOf(bestAgent), 1);
            } else {
                break;
            }
        }

        return coalition.length > 1 ? coalition : null;
    }

    async generateRandomCoalition(agentList, taskRequirements) {
        const size = Math.floor(Math.random() * 4) + 2; // 2-5 agents
        const coalition = [];
        const shuffled = [...agentList].sort(() => Math.random() - 0.5);

        for (let i = 0; i < Math.min(size, shuffled.length); i++) {
            coalition.push({
                agent: shuffled[i],
                role: i === 0 ? 'lead' : 'member',
                allocation: 1.0 / size
            });
        }

        return coalition;
    }

    async calculateCoalitionFitness(coalition, taskRequirements) {
        const evaluation = await this.evaluateCoalition(coalition, taskRequirements, {});
        return evaluation.total_score;
    }

    async crossoverCoalitions(parent1, parent2) {
        const offspring = [];
        const maxSize = Math.max(parent1.length, parent2.length);
        const crossoverPoint = Math.floor(maxSize / 2);

        // Take first half from parent1
        offspring.push(...parent1.slice(0, crossoverPoint));

        // Take second half from parent2, avoiding duplicates
        const usedAgents = new Set(offspring.map(member => member.agent.id));
        for (const member of parent2.slice(crossoverPoint)) {
            if (!usedAgents.has(member.agent.id)) {
                offspring.push(member);
            }
        }

        return offspring;
    }

    async mutateCoalition(coalition, agentList) {
        if (Math.random() < 0.1) { // 10% mutation rate
            const mutationIndex = Math.floor(Math.random() * coalition.length);
            const availableAgents = agentList.filter(agent =>
                !coalition.some(member => member.agent.id === agent.id)
            );

            if (availableAgents.length > 0) {
                const newAgent = availableAgents[Math.floor(Math.random() * availableAgents.length)];
                coalition[mutationIndex] = {
                    ...coalition[mutationIndex],
                    agent: newAgent
                };
            }
        }

        return coalition;
    }

    deduplicate(coalitions) {
        const unique = [];
        const seen = new Set();

        for (const coalition of coalitions) {
            const signature = coalition
                .map(member => member.agent.id)
                .sort()
                .join('|');

            if (!seen.has(signature)) {
                seen.add(signature);
                unique.push(coalition);
            }
        }

        return unique;
    }

    async calculateCapabilityCoverage(coalition, taskRequirements) {
        if (!taskRequirements.capabilities || taskRequirements.capabilities.length === 0) {
            return 1.0;
        }

        const coalitionCapabilities = new Set();
        for (const member of coalition) {
            for (const capability of member.agent.capabilities) {
                coalitionCapabilities.add(capability);
            }
        }

        const coveredCapabilities = taskRequirements.capabilities.filter(cap =>
            coalitionCapabilities.has(cap)
        );

        return coveredCapabilities.length / taskRequirements.capabilities.length;
    }

    async calculateExpertiseScore(coalition, taskRequirements) {
        if (coalition.length === 0) return 0;

        const totalExpertise = coalition.reduce((sum, member) => {
            const domainExpertise = member.agent.getExpertiseLevel(taskRequirements.domain || 'general');
            return sum + domainExpertise;
        }, 0);

        return totalExpertise / coalition.length;
    }

    async calculateResourceEfficiency(coalition) {
        // Simplified resource efficiency calculation
        const totalResourceScore = coalition.reduce((sum, member) => {
            const requirements = member.agent.resource_requirements;
            const efficiency = 1.0 - (
                (requirements.cpu === 'high' ? 0.3 : requirements.cpu === 'medium' ? 0.2 : 0.1) +
                (requirements.memory === 'high' ? 0.3 : requirements.memory === 'medium' ? 0.2 : 0.1)
            );
            return sum + efficiency;
        }, 0);

        return coalition.length > 0 ? totalResourceScore / coalition.length : 0;
    }

    async calculateCommunicationOverhead(coalition) {
        // Communication overhead increases quadratically with team size
        const teamSize = coalition.length;
        const connections = (teamSize * (teamSize - 1)) / 2;
        return Math.min(1.0, connections / 10); // Normalize to 0-1 scale
    }

    async recordCoalitionFormation(coalition, taskRequirements) {
        const record = {
            timestamp: new Date(),
            coalition_id: this.generateCoalitionId(),
            agents: coalition.coalition.map(member => member.agent.id),
            task_requirements: taskRequirements,
            evaluation: coalition.evaluation
        };

        this.coalitionHistory.set(record.coalition_id, record);
        this.emit('coalition_formed', record);
    }

    generateCoalitionId() {
        return `coalition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = { CoalitionFormationEngine };