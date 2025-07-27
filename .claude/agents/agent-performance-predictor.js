/**
 * Agent Performance Predictor
 * Machine learning-based performance prediction for agent selection
 */

class AgentPerformancePredictor {
    constructor() {
        this.performanceHistory = new Map();
        this.predictionModels = new Map();
        this.performanceMetrics = new Map();
        this.contextFactors = new Map();
        this.learningData = [];
    }

    async initialize(agentRegistry) {
        this.agentRegistry = agentRegistry;
        await this.initializePerformanceHistory();
        await this.buildPredictionModels();
        await this.setupContextFactors();
        console.log('Agent Performance Predictor initialized');
    }

    /**
     * Initialize performance history for all agents
     */
    async initializePerformanceHistory() {
        for (const [agentId, agent] of this.agentRegistry.entries()) {
            this.performanceHistory.set(agentId, {
                task_completions: [],
                success_rates: [],
                response_times: [],
                quality_scores: [],
                collaboration_scores: [],
                learning_curve: [],
                context_performance: new Map(),
                trend_analysis: {
                    improving: true,
                    consistency: 0.8,
                    reliability: 0.9
                }
            });

            // Initialize with baseline metrics from agent config
            const history = this.performanceHistory.get(agentId);
            const metrics = agent.performance_metrics;
            
            // Simulate historical data based on agent characteristics
            await this.generateBaselineHistory(history, agent, metrics);
        }
    }

    /**
     * Generate baseline performance history
     */
    async generateBaselineHistory(history, agent, metrics) {
        const baselineEntries = 20; // Generate 20 baseline entries
        
        for (let i = 0; i < baselineEntries; i++) {
            const variance = 0.1; // 10% variance
            const timeVariance = 0.2; // 20% time variance
            
            history.task_completions.push({
                timestamp: new Date(Date.now() - (baselineEntries - i) * 24 * 60 * 60 * 1000),
                success: Math.random() < metrics.success_rate,
                complexity: Math.random(),
                domain_match: Math.random() < 0.8
            });

            history.success_rates.push(
                Math.max(0, Math.min(1, metrics.success_rate + (Math.random() - 0.5) * variance))
            );

            history.response_times.push(
                Math.max(100, metrics.avg_response_time + (Math.random() - 0.5) * timeVariance * metrics.avg_response_time)
            );

            history.quality_scores.push(
                Math.max(0, Math.min(1, metrics.quality_score + (Math.random() - 0.5) * variance))
            );

            history.collaboration_scores.push(
                Math.max(0, Math.min(1, 0.8 + (Math.random() - 0.5) * variance))
            );
        }
    }

    /**
     * Build prediction models for different performance aspects
     */
    async buildPredictionModels() {
        // Success Rate Prediction Model
        this.predictionModels.set('success_rate', new PerformancePredictionModel({
            type: 'success_rate',
            factors: ['expertise_level', 'domain_match', 'complexity_handling', 'current_load', 'collaboration_context'],
            weights: { expertise_level: 0.3, domain_match: 0.25, complexity_handling: 0.2, current_load: -0.15, collaboration_context: 0.1 }
        }));

        // Response Time Prediction Model
        this.predictionModels.set('response_time', new PerformancePredictionModel({
            type: 'response_time',
            factors: ['base_response_time', 'current_load', 'task_complexity', 'mcp_server_performance', 'resource_availability'],
            weights: { base_response_time: 0.4, current_load: 0.25, task_complexity: 0.2, mcp_server_performance: 0.1, resource_availability: 0.05 }
        }));

        // Quality Score Prediction Model
        this.predictionModels.set('quality_score', new PerformancePredictionModel({
            type: 'quality_score',
            factors: ['expertise_level', 'specialization_match', 'collaboration_quality', 'resource_adequacy', 'time_pressure'],
            weights: { expertise_level: 0.35, specialization_match: 0.25, collaboration_quality: 0.2, resource_adequacy: 0.15, time_pressure: -0.05 }
        }));

        // Collaboration Score Prediction Model
        this.predictionModels.set('collaboration_score', new PerformancePredictionModel({
            type: 'collaboration_score',
            factors: ['agent_synergy', 'communication_efficiency', 'role_clarity', 'team_size', 'coordination_overhead'],
            weights: { agent_synergy: 0.3, communication_efficiency: 0.25, role_clarity: 0.2, team_size: -0.15, coordination_overhead: -0.1 }
        }));
    }

    /**
     * Setup context factors that influence performance
     */
    async setupContextFactors() {
        const factors = {
            task_complexity: {
                low: { multiplier: 1.1, confidence: 0.9 },
                medium: { multiplier: 1.0, confidence: 0.8 },
                high: { multiplier: 0.9, confidence: 0.7 },
                critical: { multiplier: 0.8, confidence: 0.6 }
            },
            
            domain_alignment: {
                perfect: { multiplier: 1.2, confidence: 0.95 },
                good: { multiplier: 1.1, confidence: 0.9 },
                moderate: { multiplier: 1.0, confidence: 0.8 },
                poor: { multiplier: 0.8, confidence: 0.6 }
            },

            collaboration_context: {
                solo: { multiplier: 1.1, confidence: 0.9 },
                pair: { multiplier: 1.05, confidence: 0.85 },
                small_team: { multiplier: 1.0, confidence: 0.8 },
                large_team: { multiplier: 0.9, confidence: 0.7 }
            },

            time_pressure: {
                relaxed: { multiplier: 1.1, confidence: 0.9 },
                normal: { multiplier: 1.0, confidence: 0.85 },
                tight: { multiplier: 0.9, confidence: 0.75 },
                critical: { multiplier: 0.8, confidence: 0.6 }
            },

            resource_availability: {
                abundant: { multiplier: 1.1, confidence: 0.9 },
                adequate: { multiplier: 1.0, confidence: 0.85 },
                limited: { multiplier: 0.9, confidence: 0.75 },
                scarce: { multiplier: 0.8, confidence: 0.6 }
            }
        };

        for (const [factorName, levels] of Object.entries(factors)) {
            this.contextFactors.set(factorName, levels);
        }
    }

    /**
     * Predict performance for an agent or coalition
     */
    async predictPerformance(agentSelection, taskRequirements) {
        const predictions = {
            overall_success_probability: 0,
            estimated_completion_time: 0,
            expected_quality_score: 0,
            collaboration_effectiveness: 0,
            risk_factors: [],
            confidence_intervals: {},
            performance_breakdown: new Map()
        };

        if (Array.isArray(agentSelection)) {
            // Coalition performance prediction
            return await this.predictCoalitionPerformance(agentSelection, taskRequirements);
        } else {
            // Single agent performance prediction
            return await this.predictSingleAgentPerformance(agentSelection, taskRequirements);
        }
    }

    /**
     * Predict single agent performance
     */
    async predictSingleAgentPerformance(agentSelection, taskRequirements) {
        const agent = agentSelection.agent || agentSelection;
        const agentHistory = this.performanceHistory.get(agent.id);
        
        const context = await this.buildPerformanceContext(agent, taskRequirements, 'single');
        
        const predictions = {
            agent_id: agent.id,
            success_probability: await this.predictSuccessRate(agent, context),
            estimated_response_time: await this.predictResponseTime(agent, context),
            expected_quality_score: await this.predictQualityScore(agent, context),
            confidence_level: await this.calculatePredictionConfidence(agent, context),
            risk_factors: await this.identifyRiskFactors(agent, context),
            historical_performance: await this.getHistoricalSummary(agent),
            context_adjustments: context.adjustments
        };

        // Apply context adjustments
        predictions.success_probability *= context.adjustments.success_multiplier;
        predictions.estimated_response_time *= context.adjustments.time_multiplier;
        predictions.expected_quality_score *= context.adjustments.quality_multiplier;

        return predictions;
    }

    /**
     * Predict coalition performance
     */
    async predictCoalitionPerformance(coalition, taskRequirements) {
        const coalitionPredictions = {
            coalition_size: coalition.length,
            overall_success_probability: 0,
            estimated_completion_time: 0,
            expected_quality_score: 0,
            collaboration_effectiveness: 0,
            individual_predictions: new Map(),
            synergy_effects: {},
            coordination_overhead: 0,
            risk_assessment: {},
            confidence_level: 0
        };

        // Predict individual agent performance
        for (const member of coalition) {
            const agentPrediction = await this.predictSingleAgentPerformance(member, taskRequirements);
            coalitionPredictions.individual_predictions.set(member.agent.id, agentPrediction);
        }

        // Calculate coalition-level metrics
        coalitionPredictions.overall_success_probability = await this.calculateCoalitionSuccessRate(coalition, taskRequirements);
        coalitionPredictions.estimated_completion_time = await this.calculateCoalitionCompletionTime(coalition, taskRequirements);
        coalitionPredictions.expected_quality_score = await this.calculateCoalitionQualityScore(coalition, taskRequirements);
        coalitionPredictions.collaboration_effectiveness = await this.calculateCollaborationEffectiveness(coalition);
        coalitionPredictions.coordination_overhead = await this.calculateCoordinationOverhead(coalition);
        coalitionPredictions.synergy_effects = await this.calculateSynergyEffects(coalition);
        coalitionPredictions.risk_assessment = await this.assessCoalitionRisks(coalition, taskRequirements);
        coalitionPredictions.confidence_level = await this.calculateCoalitionConfidence(coalition, taskRequirements);

        return coalitionPredictions;
    }

    /**
     * Build performance context for predictions
     */
    async buildPerformanceContext(agent, taskRequirements, mode = 'single') {
        const context = {
            task_complexity: this.assessTaskComplexity(taskRequirements),
            domain_alignment: this.assessDomainAlignment(agent, taskRequirements),
            collaboration_context: mode === 'single' ? 'solo' : this.assessCollaborationContext(taskRequirements),
            time_pressure: this.assessTimePressure(taskRequirements),
            resource_availability: await this.assessResourceAvailability(agent),
            adjustments: {
                success_multiplier: 1.0,
                time_multiplier: 1.0,
                quality_multiplier: 1.0
            }
        };

        // Calculate context adjustments
        for (const [factorName, level] of Object.entries(context)) {
            if (factorName === 'adjustments') continue;
            
            const factorData = this.contextFactors.get(factorName);
            if (factorData && factorData[level]) {
                context.adjustments.success_multiplier *= factorData[level].multiplier;
                context.adjustments.time_multiplier *= level === 'high' || level === 'critical' ? 1.2 : 1.0;
                context.adjustments.quality_multiplier *= factorData[level].multiplier;
            }
        }

        return context;
    }

    /**
     * Predict success rate using machine learning model
     */
    async predictSuccessRate(agent, context) {
        const model = this.predictionModels.get('success_rate');
        const history = this.performanceHistory.get(agent.id);
        
        const features = {
            expertise_level: agent.expertise_level,
            domain_match: context.domain_alignment === 'perfect' ? 1.0 : context.domain_alignment === 'good' ? 0.8 : 0.6,
            complexity_handling: agent.complexity_handling,
            current_load: agent.getCurrentLoad(),
            collaboration_context: context.collaboration_context === 'solo' ? 1.0 : 0.8,
            historical_success_rate: this.calculateAverageSuccessRate(history)
        };

        return model.predict(features);
    }

    /**
     * Predict response time
     */
    async predictResponseTime(agent, context) {
        const model = this.predictionModels.get('response_time');
        const history = this.performanceHistory.get(agent.id);
        
        const features = {
            base_response_time: agent.performance_metrics.avg_response_time,
            current_load: agent.getCurrentLoad(),
            task_complexity: context.task_complexity === 'high' ? 1.5 : context.task_complexity === 'medium' ? 1.2 : 1.0,
            mcp_server_performance: 1.0, // Would get from MCP coordinator
            resource_availability: context.resource_availability === 'abundant' ? 1.0 : 0.8,
            historical_avg: this.calculateAverageResponseTime(history)
        };

        return model.predict(features);
    }

    /**
     * Predict quality score
     */
    async predictQualityScore(agent, context) {
        const model = this.predictionModels.get('quality_score');
        const history = this.performanceHistory.get(agent.id);
        
        const features = {
            expertise_level: agent.expertise_level,
            specialization_match: this.calculateSpecializationMatch(agent, context),
            collaboration_quality: context.collaboration_context === 'solo' ? 1.0 : 0.9,
            resource_adequacy: context.resource_availability === 'abundant' ? 1.0 : 0.8,
            time_pressure: context.time_pressure === 'relaxed' ? 1.0 : 0.9,
            historical_quality: this.calculateAverageQuality(history)
        };

        return model.predict(features);
    }

    /**
     * Calculate coalition success rate
     */
    async calculateCoalitionSuccessRate(coalition, taskRequirements) {
        let coalitionSuccessRate = 1.0;
        
        // Calculate independent failure probability
        for (const member of coalition) {
            const agentContext = await this.buildPerformanceContext(member.agent, taskRequirements, 'coalition');
            const agentSuccessRate = await this.predictSuccessRate(member.agent, agentContext);
            
            // Assuming partial independence (agents can compensate for each other)
            coalitionSuccessRate *= (1 - (1 - agentSuccessRate) * 0.7);
        }

        // Apply collaboration bonus
        const collaborationBonus = Math.min(0.1, coalition.length * 0.02);
        coalitionSuccessRate = Math.min(1.0, coalitionSuccessRate + collaborationBonus);

        return coalitionSuccessRate;
    }

    /**
     * Calculate coalition completion time
     */
    async calculateCoalitionCompletionTime(coalition, taskRequirements) {
        const individualTimes = [];
        
        for (const member of coalition) {
            const agentContext = await this.buildPerformanceContext(member.agent, taskRequirements, 'coalition');
            const agentTime = await this.predictResponseTime(member.agent, agentContext);
            individualTimes.push(agentTime * (member.allocation || 1.0 / coalition.length));
        }

        // For parallel work, use maximum time; for sequential, sum times
        const isParallelizable = this.isTaskParallelizable(taskRequirements);
        
        if (isParallelizable) {
            const coordinationOverhead = coalition.length * 0.1; // 10% overhead per additional agent
            return Math.max(...individualTimes) * (1 + coordinationOverhead);
        } else {
            return individualTimes.reduce((sum, time) => sum + time, 0);
        }
    }

    /**
     * Calculate coalition quality score
     */
    async calculateCoalitionQualityScore(coalition, taskRequirements) {
        let totalQuality = 0;
        let totalWeight = 0;

        for (const member of coalition) {
            const agentContext = await this.buildPerformanceContext(member.agent, taskRequirements, 'coalition');
            const agentQuality = await this.predictQualityScore(member.agent, agentContext);
            const weight = member.allocation || 1.0 / coalition.length;
            
            totalQuality += agentQuality * weight;
            totalWeight += weight;
        }

        const baseQuality = totalWeight > 0 ? totalQuality / totalWeight : 0;
        
        // Apply collaboration quality bonus
        const collaborationBonus = await this.calculateCollaborationQualityBonus(coalition);
        
        return Math.min(1.0, baseQuality + collaborationBonus);
    }

    /**
     * Get historical performance summary
     */
    async getHistoricalPerformance(agentId) {
        const history = this.performanceHistory.get(agentId);
        if (!history) return null;

        return {
            average_success_rate: this.calculateAverageSuccessRate(history),
            average_response_time: this.calculateAverageResponseTime(history),
            average_quality_score: this.calculateAverageQuality(history),
            task_completion_count: history.task_completions.length,
            trend_analysis: history.trend_analysis,
            recent_performance: this.getRecentPerformanceTrend(history)
        };
    }

    /**
     * Helper methods for calculations
     */
    assessTaskComplexity(taskRequirements) {
        const complexity = taskRequirements.complexity || 0.5;
        if (complexity < 0.3) return 'low';
        if (complexity < 0.7) return 'medium';
        if (complexity < 0.9) return 'high';
        return 'critical';
    }

    assessDomainAlignment(agent, taskRequirements) {
        if (!taskRequirements.domain) return 'moderate';
        if (agent.domain === taskRequirements.domain) return 'perfect';
        if (agent.specializations.some(spec => spec.includes(taskRequirements.domain))) return 'good';
        return 'moderate';
    }

    assessCollaborationContext(taskRequirements) {
        const teamSize = taskRequirements.team_size || 1;
        if (teamSize === 1) return 'solo';
        if (teamSize === 2) return 'pair';
        if (teamSize <= 4) return 'small_team';
        return 'large_team';
    }

    assessTimePressure(taskRequirements) {
        const urgency = taskRequirements.urgency || 'normal';
        return urgency;
    }

    async assessResourceAvailability(agent) {
        const currentLoad = agent.getCurrentLoad();
        if (currentLoad < 0.3) return 'abundant';
        if (currentLoad < 0.6) return 'adequate';
        if (currentLoad < 0.8) return 'limited';
        return 'scarce';
    }

    calculateAverageSuccessRate(history) {
        if (history.success_rates.length === 0) return 0.8; // Default
        return history.success_rates.reduce((sum, rate) => sum + rate, 0) / history.success_rates.length;
    }

    calculateAverageResponseTime(history) {
        if (history.response_times.length === 0) return 1000; // Default
        return history.response_times.reduce((sum, time) => sum + time, 0) / history.response_times.length;
    }

    calculateAverageQuality(history) {
        if (history.quality_scores.length === 0) return 0.8; // Default
        return history.quality_scores.reduce((sum, score) => sum + score, 0) / history.quality_scores.length;
    }

    calculateSpecializationMatch(agent, context) {
        // Simple specialization matching logic
        return agent.specializations.length > 0 ? 0.8 : 0.6;
    }

    isTaskParallelizable(taskRequirements) {
        const parallelizable = taskRequirements.parallelizable !== false;
        return parallelizable && (taskRequirements.capabilities?.length || 0) > 1;
    }

    async calculateCollaborationEffectiveness(coalition) {
        // Simplified collaboration effectiveness calculation
        const teamSize = coalition.length;
        if (teamSize === 1) return 1.0;
        if (teamSize <= 3) return 0.9;
        if (teamSize <= 5) return 0.8;
        return 0.7;
    }

    async calculateCoordinationOverhead(coalition) {
        const connections = (coalition.length * (coalition.length - 1)) / 2;
        return Math.min(0.5, connections * 0.05); // 5% overhead per connection
    }

    async calculateSynergyEffects(coalition) {
        // Simplified synergy calculation
        return {
            knowledge_sharing: 0.1,
            skill_complementarity: 0.15,
            cross_validation: 0.05
        };
    }

    async assessCoalitionRisks(coalition, taskRequirements) {
        return {
            coordination_risk: coalition.length > 3 ? 'medium' : 'low',
            skill_gap_risk: 'low', // Would calculate based on capability coverage
            communication_risk: coalition.length > 4 ? 'high' : 'low'
        };
    }

    async calculateCoalitionConfidence(coalition, taskRequirements) {
        // Simplified confidence calculation
        const baseConfidence = 0.8;
        const sizeAdjustment = Math.max(0, 0.9 - (coalition.length - 2) * 0.1);
        return baseConfidence * sizeAdjustment;
    }

    async calculateCollaborationQualityBonus(coalition) {
        // Simplified collaboration quality bonus
        return Math.min(0.1, coalition.length * 0.02);
    }

    async calculatePredictionConfidence(agent, context) {
        const history = this.performanceHistory.get(agent.id);
        const dataPoints = history.task_completions.length;
        
        let confidence = Math.min(0.95, 0.5 + (dataPoints / 50) * 0.45);
        
        // Adjust for context factors
        if (context.domain_alignment === 'perfect') confidence *= 1.1;
        if (context.task_complexity === 'critical') confidence *= 0.9;
        
        return Math.max(0.3, Math.min(0.95, confidence));
    }

    async identifyRiskFactors(agent, context) {
        const risks = [];
        
        if (agent.getCurrentLoad() > 0.8) {
            risks.push({ factor: 'high_load', severity: 'medium', impact: 'response_time' });
        }
        
        if (context.task_complexity === 'critical' && agent.complexity_handling < 0.8) {
            risks.push({ factor: 'complexity_mismatch', severity: 'high', impact: 'success_rate' });
        }
        
        if (context.domain_alignment === 'poor') {
            risks.push({ factor: 'domain_mismatch', severity: 'medium', impact: 'quality' });
        }
        
        return risks;
    }

    async getHistoricalSummary(agent) {
        const history = this.performanceHistory.get(agent.id);
        return {
            total_tasks: history.task_completions.length,
            avg_success_rate: this.calculateAverageSuccessRate(history),
            avg_response_time: this.calculateAverageResponseTime(history),
            avg_quality: this.calculateAverageQuality(history)
        };
    }

    getRecentPerformanceTrend(history) {
        const recent = history.success_rates.slice(-5); // Last 5 entries
        if (recent.length < 2) return 'stable';
        
        const trend = recent[recent.length - 1] - recent[0];
        if (trend > 0.1) return 'improving';
        if (trend < -0.1) return 'declining';
        return 'stable';
    }
}

/**
 * Performance Prediction Model
 */
class PerformancePredictionModel {
    constructor(config) {
        this.type = config.type;
        this.factors = config.factors;
        this.weights = config.weights;
    }

    predict(features) {
        let prediction = 0;
        let totalWeight = 0;

        for (const [factor, weight] of Object.entries(this.weights)) {
            if (features[factor] !== undefined) {
                prediction += features[factor] * weight;
                totalWeight += Math.abs(weight);
            }
        }

        // Normalize and apply bounds
        if (totalWeight > 0) {
            prediction = prediction / totalWeight;
        }

        // Apply type-specific bounds
        switch (this.type) {
            case 'success_rate':
            case 'quality_score':
                return Math.max(0, Math.min(1, prediction));
            case 'response_time':
                return Math.max(100, prediction);
            default:
                return Math.max(0, Math.min(1, prediction));
        }
    }
}

module.exports = { AgentPerformancePredictor, PerformancePredictionModel };