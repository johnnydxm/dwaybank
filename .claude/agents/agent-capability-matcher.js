/**
 * Agent Capability Matcher
 * Advanced capability matching and agent filtering system
 */

class AgentCapabilityMatcher {
    constructor() {
        this.capabilityIndex = new Map();
        this.domainIndex = new Map();
        this.specializationIndex = new Map();
        this.skillGraph = new Map();
        this.capabilityWeights = new Map();
    }

    async initialize(agentRegistry) {
        this.agentRegistry = agentRegistry;
        await this.buildCapabilityIndices();
        await this.buildSkillGraph();
        await this.setupCapabilityWeights();
        console.log('Agent Capability Matcher initialized');
    }

    /**
     * Build searchable indices for fast capability matching
     */
    async buildCapabilityIndices() {
        // Clear existing indices
        this.capabilityIndex.clear();
        this.domainIndex.clear();
        this.specializationIndex.clear();

        for (const [agentId, agent] of this.agentRegistry.entries()) {
            // Index by capabilities
            for (const capability of agent.capabilities) {
                if (!this.capabilityIndex.has(capability)) {
                    this.capabilityIndex.set(capability, []);
                }
                this.capabilityIndex.get(capability).push(agent);
            }

            // Index by domain
            if (!this.domainIndex.has(agent.domain)) {
                this.domainIndex.set(agent.domain, []);
            }
            this.domainIndex.get(agent.domain).push(agent);

            // Index by specializations
            for (const specialization of agent.specializations) {
                if (!this.specializationIndex.has(specialization)) {
                    this.specializationIndex.set(specialization, []);
                }
                this.specializationIndex.get(specialization).push(agent);
            }
        }
    }

    /**
     * Build skill graph showing relationships between capabilities
     */
    async buildSkillGraph() {
        const skillRelationships = [
            // Architecture relationships
            { from: 'system_design', to: 'api_development', strength: 0.8 },
            { from: 'system_design', to: 'database_design', strength: 0.7 },
            { from: 'architecture_review', to: 'system_design', strength: 0.9 },

            // Security relationships
            { from: 'threat_modeling', to: 'vulnerability_assessment', strength: 0.8 },
            { from: 'security', to: 'compliance', strength: 0.7 },
            { from: 'vulnerability_assessment', to: 'incident_response', strength: 0.6 },

            // Development relationships
            { from: 'api_development', to: 'database_design', strength: 0.7 },
            { from: 'ui_development', to: 'user_experience', strength: 0.9 },
            { from: 'ui_development', to: 'responsive_design', strength: 0.8 },

            // Testing relationships
            { from: 'testing', to: 'quality_validation', strength: 0.8 },
            { from: 'automation', to: 'testing', strength: 0.7 },
            { from: 'performance_testing', to: 'performance_analysis', strength: 0.9 },

            // Analysis relationships
            { from: 'root_cause_analysis', to: 'troubleshooting', strength: 0.8 },
            { from: 'data_analysis', to: 'investigation', strength: 0.7 },
            { from: 'performance_analysis', to: 'optimization', strength: 0.8 },

            // Management relationships
            { from: 'project_coordination', to: 'resource_management', strength: 0.7 },
            { from: 'workflow_coordination', to: 'agent_management', strength: 0.8 },
            { from: 'decision_making', to: 'optimization', strength: 0.6 }
        ];

        for (const relationship of skillRelationships) {
            if (!this.skillGraph.has(relationship.from)) {
                this.skillGraph.set(relationship.from, []);
            }
            this.skillGraph.get(relationship.from).push({
                skill: relationship.to,
                strength: relationship.strength
            });
        }
    }

    /**
     * Setup capability weights for different contexts
     */
    async setupCapabilityWeights() {
        const weights = {
            // Critical capabilities for financial systems
            'security': 1.0,
            'compliance': 1.0,
            'threat_modeling': 0.9,
            'vulnerability_assessment': 0.9,

            // High-value development capabilities
            'system_design': 0.9,
            'api_development': 0.8,
            'performance_optimization': 0.8,
            'database_design': 0.8,

            // Important quality capabilities
            'testing': 0.7,
            'quality_validation': 0.7,
            'automation': 0.6,

            // Management capabilities
            'project_coordination': 0.8,
            'resource_management': 0.7,
            'workflow_coordination': 0.8,

            // Analysis capabilities
            'root_cause_analysis': 0.8,
            'performance_analysis': 0.7,
            'data_analysis': 0.6,

            // Default weight for unlisted capabilities
            'default': 0.5
        };

        for (const [capability, weight] of Object.entries(weights)) {
            this.capabilityWeights.set(capability, weight);
        }
    }

    /**
     * Find agents capable of handling specific capabilities
     */
    async findCapableAgents(requiredCapabilities, domain = null, minExpertise = 0.0) {
        if (!requiredCapabilities || requiredCapabilities.length === 0) {
            return Array.from(this.agentRegistry.values());
        }

        const capableAgents = new Map();

        // Find agents for each capability
        for (const capability of requiredCapabilities) {
            const agents = this.capabilityIndex.get(capability) || [];
            
            for (const agent of agents) {
                // Check minimum expertise requirement
                const expertiseLevel = agent.getExpertiseLevel(domain || agent.domain);
                if (expertiseLevel < minExpertise) continue;

                // Check domain match if specified
                if (domain && agent.domain !== domain && 
                    !this.isDomainCompatible(agent.domain, domain)) {
                    continue;
                }

                if (!capableAgents.has(agent.id)) {
                    capableAgents.set(agent.id, {
                        agent,
                        matchedCapabilities: [],
                        matchScore: 0
                    });
                }

                const agentInfo = capableAgents.get(agent.id);
                agentInfo.matchedCapabilities.push(capability);
            }
        }

        // Calculate match scores
        for (const [agentId, agentInfo] of capableAgents.entries()) {
            agentInfo.matchScore = await this.calculateCapabilityMatchScore(
                agentInfo.agent, 
                requiredCapabilities, 
                agentInfo.matchedCapabilities
            );
        }

        // Return sorted by match score
        return Array.from(capableAgents.values())
            .sort((a, b) => b.matchScore - a.matchScore)
            .map(info => info.agent);
    }

    /**
     * Calculate detailed capability match score
     */
    async calculateMatch(agent, requiredCapabilities) {
        if (!requiredCapabilities || requiredCapabilities.length === 0) {
            return 1.0;
        }

        const directMatches = requiredCapabilities.filter(cap => 
            agent.capabilities.has(cap)
        );

        const indirectMatches = await this.findIndirectMatches(agent, requiredCapabilities);
        const specializationMatches = await this.findSpecializationMatches(agent, requiredCapabilities);

        // Calculate weighted score
        const directScore = directMatches.length / requiredCapabilities.length * 1.0;
        const indirectScore = indirectMatches.length / requiredCapabilities.length * 0.6;
        const specializationScore = specializationMatches.length / requiredCapabilities.length * 0.8;

        return Math.min(1.0, directScore + indirectScore + specializationScore);
    }

    /**
     * Find agents similar to a given agent
     */
    async findSimilarAgents(targetAgent, taskRequirements, similarityThreshold = 0.7) {
        const similarAgents = [];

        for (const [agentId, agent] of this.agentRegistry.entries()) {
            if (agent.id === targetAgent.id) continue;

            const similarity = await this.calculateAgentSimilarity(targetAgent, agent, taskRequirements);
            
            if (similarity >= similarityThreshold) {
                similarAgents.push({
                    agent,
                    similarity
                });
            }
        }

        return similarAgents
            .sort((a, b) => b.similarity - a.similarity)
            .map(item => item.agent);
    }

    /**
     * Calculate capability match score with advanced weighting
     */
    async calculateCapabilityMatchScore(agent, requiredCapabilities, matchedCapabilities) {
        let totalScore = 0;
        let totalWeight = 0;

        // Score direct matches
        for (const capability of matchedCapabilities) {
            const weight = this.capabilityWeights.get(capability) || 
                          this.capabilityWeights.get('default');
            const expertiseBonus = agent.getExpertiseLevel(capability) * 0.2;
            
            totalScore += (1.0 + expertiseBonus) * weight;
            totalWeight += weight;
        }

        // Score indirect matches
        const indirectMatches = await this.findIndirectMatches(agent, requiredCapabilities);
        for (const match of indirectMatches) {
            const weight = (this.capabilityWeights.get(match.capability) || 
                           this.capabilityWeights.get('default')) * 0.6;
            
            totalScore += match.strength * weight;
            totalWeight += weight;
        }

        // Score specialization matches
        const specializationMatches = await this.findSpecializationMatches(agent, requiredCapabilities);
        for (const match of specializationMatches) {
            const weight = (this.capabilityWeights.get(match.capability) || 
                           this.capabilityWeights.get('default')) * 0.8;
            
            totalScore += weight;
            totalWeight += weight;
        }

        // Normalize score
        return totalWeight > 0 ? Math.min(1.0, totalScore / totalWeight) : 0;
    }

    /**
     * Find indirect capability matches through skill graph
     */
    async findIndirectMatches(agent, requiredCapabilities) {
        const indirectMatches = [];

        for (const agentCapability of agent.capabilities) {
            const relatedSkills = this.skillGraph.get(agentCapability) || [];
            
            for (const related of relatedSkills) {
                if (requiredCapabilities.includes(related.skill)) {
                    indirectMatches.push({
                        capability: related.skill,
                        source: agentCapability,
                        strength: related.strength
                    });
                }
            }
        }

        return indirectMatches;
    }

    /**
     * Find matches through agent specializations
     */
    async findSpecializationMatches(agent, requiredCapabilities) {
        const matches = [];

        for (const specialization of agent.specializations) {
            // Check if specialization relates to required capabilities
            for (const capability of requiredCapabilities) {
                if (this.isSpecializationRelevant(specialization, capability)) {
                    matches.push({
                        capability,
                        specialization,
                        relevance: this.calculateSpecializationRelevance(specialization, capability)
                    });
                }
            }
        }

        return matches;
    }

    /**
     * Calculate similarity between two agents
     */
    async calculateAgentSimilarity(agent1, agent2, taskRequirements) {
        const similarities = {
            domain: 0,
            capabilities: 0,
            specializations: 0,
            expertise: 0,
            type: 0
        };

        // Domain similarity
        similarities.domain = agent1.domain === agent2.domain ? 1.0 : 
                             this.isDomainCompatible(agent1.domain, agent2.domain) ? 0.6 : 0.2;

        // Capability similarity (Jaccard index)
        const cap1 = new Set(agent1.capabilities);
        const cap2 = new Set(agent2.capabilities);
        const intersection = new Set([...cap1].filter(x => cap2.has(x)));
        const union = new Set([...cap1, ...cap2]);
        similarities.capabilities = intersection.size / union.size;

        // Specialization similarity
        const spec1 = new Set(agent1.specializations);
        const spec2 = new Set(agent2.specializations);
        const specIntersection = new Set([...spec1].filter(x => spec2.has(x)));
        const specUnion = new Set([...spec1, ...spec2]);
        similarities.specializations = specUnion.size > 0 ? specIntersection.size / specUnion.size : 0;

        // Expertise similarity
        const domain = taskRequirements.domain || 'general';
        const exp1 = agent1.getExpertiseLevel(domain);
        const exp2 = agent2.getExpertiseLevel(domain);
        similarities.expertise = 1.0 - Math.abs(exp1 - exp2);

        // Type similarity
        similarities.type = agent1.type === agent2.type ? 1.0 : 0.5;

        // Calculate weighted similarity
        const weights = {
            domain: 0.25,
            capabilities: 0.35,
            specializations: 0.2,
            expertise: 0.15,
            type: 0.05
        };

        let totalSimilarity = 0;
        for (const [aspect, weight] of Object.entries(weights)) {
            totalSimilarity += similarities[aspect] * weight;
        }

        return totalSimilarity;
    }

    /**
     * Check if two domains are compatible
     */
    isDomainCompatible(domain1, domain2) {
        const compatibilityMatrix = {
            'architecture': ['backend', 'frontend', 'security', 'performance'],
            'backend': ['architecture', 'security', 'performance', 'database'],
            'frontend': ['architecture', 'qa', 'performance', 'ux'],
            'security': ['architecture', 'backend', 'qa', 'compliance'],
            'performance': ['architecture', 'backend', 'frontend', 'monitoring'],
            'qa': ['frontend', 'backend', 'security', 'automation'],
            'analysis': ['security', 'performance', 'qa', 'investigation'],
            'project_management': ['orchestration', 'resource_management', 'coordination'],
            'research': ['analysis', 'documentation', 'intelligence']
        };

        const compatible = compatibilityMatrix[domain1] || [];
        return compatible.includes(domain2);
    }

    /**
     * Check if specialization is relevant to capability
     */
    isSpecializationRelevant(specialization, capability) {
        const relevanceMap = {
            // Financial specializations
            'financial_architecture': ['system_design', 'compliance', 'security'],
            'payment_processing': ['api_development', 'security', 'compliance'],
            'trading_systems': ['performance_optimization', 'real_time_processing'],
            'financial_apis': ['api_development', 'security', 'documentation'],
            
            // Security specializations
            'pci_compliance': ['compliance', 'security', 'audit'],
            'fraud_detection': ['security', 'analysis', 'monitoring'],
            'financial_security': ['threat_modeling', 'vulnerability_assessment'],
            
            // Technical specializations
            'real_time_systems': ['performance_optimization', 'scalability'],
            'legacy_modernization': ['refactoring', 'architecture_review'],
            'mobile_banking': ['ui_development', 'security', 'user_experience']
        };

        const relevantCapabilities = relevanceMap[specialization] || [];
        return relevantCapabilities.includes(capability);
    }

    /**
     * Calculate specialization relevance score
     */
    calculateSpecializationRelevance(specialization, capability) {
        // This would be more sophisticated in a real implementation
        return this.isSpecializationRelevant(specialization, capability) ? 0.8 : 0.2;
    }

    /**
     * Find agents by domain with capability filtering
     */
    async findAgentsByDomain(domain, requiredCapabilities = [], minExpertise = 0.0) {
        const domainAgents = this.domainIndex.get(domain) || [];
        
        if (requiredCapabilities.length === 0) {
            return domainAgents.filter(agent => 
                agent.getExpertiseLevel(domain) >= minExpertise
            );
        }

        return domainAgents.filter(agent => {
            // Check expertise level
            if (agent.getExpertiseLevel(domain) < minExpertise) {
                return false;
            }

            // Check capability requirements
            const hasRequiredCapabilities = requiredCapabilities.some(cap => 
                agent.capabilities.has(cap)
            );

            return hasRequiredCapabilities;
        });
    }

    /**
     * Find complementary agents for a given agent
     */
    async findComplementaryAgents(baseAgent, taskRequirements) {
        const complementaryAgents = [];
        const baseCapabilities = new Set(baseAgent.capabilities);
        const requiredCapabilities = new Set(taskRequirements.capabilities || []);
        
        // Find capabilities that base agent doesn't have
        const missingCapabilities = [...requiredCapabilities].filter(cap => 
            !baseCapabilities.has(cap)
        );

        if (missingCapabilities.length > 0) {
            const candidates = await this.findCapableAgents(missingCapabilities);
            
            for (const candidate of candidates) {
                const complementScore = await this.calculateComplementScore(
                    baseAgent, candidate, missingCapabilities
                );
                
                if (complementScore > 0.5) {
                    complementaryAgents.push({
                        agent: candidate,
                        complementScore,
                        complementaryCapabilities: missingCapabilities.filter(cap =>
                            candidate.capabilities.has(cap)
                        )
                    });
                }
            }
        }

        return complementaryAgents
            .sort((a, b) => b.complementScore - a.complementScore)
            .map(item => item.agent);
    }

    /**
     * Calculate complement score between two agents
     */
    async calculateComplementScore(baseAgent, candidateAgent, missingCapabilities) {
        if (candidateAgent.id === baseAgent.id) return 0;

        const candidateCapabilities = new Set(candidateAgent.capabilities);
        const coveredCapabilities = missingCapabilities.filter(cap => 
            candidateCapabilities.has(cap)
        );

        const coverageScore = coveredCapabilities.length / missingCapabilities.length;
        const synergyScore = await this.calculateBasicSynergy(baseAgent, candidateAgent);
        const expertiseScore = candidateAgent.expertise_level;

        return (coverageScore * 0.5) + (synergyScore * 0.3) + (expertiseScore * 0.2);
    }

    /**
     * Calculate basic synergy between agents
     */
    async calculateBasicSynergy(agent1, agent2) {
        // Domain synergy
        let synergy = 0;
        
        if (agent1.domain === agent2.domain) {
            synergy += 0.3;
        } else if (this.isDomainCompatible(agent1.domain, agent2.domain)) {
            synergy += 0.5;
        }

        // Type synergy
        if ((agent1.type === 'financial_specialist' && agent2.type === 'management') ||
            (agent1.type === 'management' && agent2.type === 'financial_specialist')) {
            synergy += 0.3;
        }

        // Capability synergy
        const sharedCapabilities = [...agent1.capabilities].filter(cap => 
            agent2.capabilities.has(cap)
        );
        synergy += sharedCapabilities.length * 0.1;

        return Math.min(1.0, synergy);
    }

    /**
     * Get capability statistics and insights
     */
    getCapabilityStatistics() {
        const stats = {
            total_capabilities: this.capabilityIndex.size,
            capability_distribution: {},
            domain_distribution: {},
            specialization_distribution: {},
            coverage_analysis: {}
        };

        // Capability distribution
        for (const [capability, agents] of this.capabilityIndex.entries()) {
            stats.capability_distribution[capability] = {
                agent_count: agents.length,
                avg_expertise: agents.reduce((sum, agent) => 
                    sum + agent.expertise_level, 0) / agents.length
            };
        }

        // Domain distribution
        for (const [domain, agents] of this.domainIndex.entries()) {
            stats.domain_distribution[domain] = agents.length;
        }

        // Specialization distribution
        for (const [specialization, agents] of this.specializationIndex.entries()) {
            stats.specialization_distribution[specialization] = agents.length;
        }

        return stats;
    }
}

module.exports = { AgentCapabilityMatcher };