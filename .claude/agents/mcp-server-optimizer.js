/**
 * DwayBank MCP Server Optimizer
 * Advanced load balancing, failover, and performance optimization for MCP servers
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class MCPServerOptimizer extends EventEmitter {
    constructor(serverConfig, communicationBus) {
        super();
        this.serverConfig = serverConfig;
        this.communicationBus = communicationBus;
        this.serverPool = new Map();
        this.loadBalancer = new MCPLoadBalancer();
        this.failoverManager = new MCPFailoverManager();
        this.performanceMonitor = new MCPPerformanceMonitor();
        this.cacheManager = new MCPCacheManager();
        this.costOptimizer = new MCPCostOptimizer();
        
        this.initialize();
    }

    /**
     * Initialize MCP server optimization system
     */
    async initialize() {
        console.log('Initializing MCP Server Optimizer...');
        
        // Initialize server pool
        await this.initializeServerPool();
        
        // Setup load balancing
        await this.loadBalancer.initialize(this.serverPool);
        
        // Setup failover management
        await this.failoverManager.initialize(this.serverPool);
        
        // Start performance monitoring
        await this.performanceMonitor.startMonitoring(this.serverPool);
        
        // Initialize caching
        await this.cacheManager.initialize();
        
        // Setup cost optimization
        await this.costOptimizer.initialize(this.serverPool);
        
        console.log('MCP Server Optimizer initialized successfully');
        this.emit('optimizer_ready');
    }

    /**
     * Initialize server pool with health checks and performance metrics
     */
    async initializeServerPool() {
        for (const [serverId, config] of Object.entries(this.serverConfig)) {
            const serverInstance = {
                id: serverId,
                config: config,
                status: 'initializing',
                connections: new Set(),
                metrics: {
                    response_times: [],
                    error_count: 0,
                    success_count: 0,
                    current_load: 0,
                    queue_depth: 0,
                    cost_per_hour: 0
                },
                health: {
                    last_check: null,
                    consecutive_failures: 0,
                    availability_score: 1.0
                },
                capabilities: config.capabilities || [],
                rate_limits: {
                    current_rpm: 0,
                    current_rph: 0,
                    last_reset: Date.now()
                }
            };

            // Perform initial health check
            await this.performHealthCheck(serverInstance);
            
            this.serverPool.set(serverId, serverInstance);
            console.log(`Server ${serverId} initialized with status: ${serverInstance.status}`);
        }
    }

    /**
     * Intelligent server selection for agent requests
     */
    async selectOptimalServer(agentId, requestType, requirements = {}) {
        const eligibleServers = this.getEligibleServers(requestType, requirements);
        
        if (eligibleServers.length === 0) {
            throw new Error(`No servers available for request type: ${requestType}`);
        }

        // Calculate selection scores
        const scoredServers = eligibleServers.map(server => ({
            server,
            score: this.calculateSelectionScore(server, agentId, requestType, requirements)
        }));

        // Sort by score (highest first)
        scoredServers.sort((a, b) => b.score - a.score);

        const selectedServer = scoredServers[0].server;
        
        // Update load balancing metrics
        await this.loadBalancer.recordSelection(selectedServer.id, agentId);
        
        return selectedServer;
    }

    /**
     * Calculate server selection score based on multiple factors
     */
    calculateSelectionScore(server, agentId, requestType, requirements) {
        const weights = {
            capability_match: 0.35,
            current_load: 0.25,
            response_time: 0.20,
            cost_efficiency: 0.15,
            reliability_score: 0.05
        };

        const scores = {
            capability_match: this.calculateCapabilityScore(server, requestType, requirements),
            current_load: this.calculateLoadScore(server),
            response_time: this.calculateResponseTimeScore(server),
            cost_efficiency: this.calculateCostScore(server),
            reliability_score: server.health.availability_score
        };

        let totalScore = 0;
        for (const [factor, weight] of Object.entries(weights)) {
            totalScore += scores[factor] * weight;
        }

        return totalScore;
    }

    /**
     * Execute request with optimization and failover
     */
    async executeRequest(agentId, requestType, requestData, options = {}) {
        let attempts = 0;
        const maxAttempts = 3;
        let lastError = null;

        while (attempts < maxAttempts) {
            attempts++;
            
            try {
                // Check cache first
                const cacheKey = this.cacheManager.generateCacheKey(requestType, requestData);
                const cachedResult = await this.cacheManager.get(cacheKey);
                
                if (cachedResult && !options.bypassCache) {
                    this.emit('cache_hit', { agentId, requestType, cacheKey });
                    return cachedResult;
                }

                // Select optimal server
                const server = await this.selectOptimalServer(agentId, requestType, options.requirements);
                
                // Execute request
                const startTime = Date.now();
                const result = await this.executeServerRequest(server, requestType, requestData, options);
                const responseTime = Date.now() - startTime;

                // Update metrics
                await this.updateServerMetrics(server, responseTime, true);
                
                // Cache result if applicable
                if (this.cacheManager.shouldCache(requestType, result)) {
                    await this.cacheManager.set(cacheKey, result, requestType);
                }

                // Update cost tracking
                await this.costOptimizer.recordUsage(server.id, requestType, responseTime);

                this.emit('request_completed', {
                    agentId,
                    serverId: server.id,
                    requestType,
                    responseTime,
                    attempts
                });

                return result;

            } catch (error) {
                lastError = error;
                console.warn(`Request attempt ${attempts} failed:`, error.message);
                
                if (attempts < maxAttempts) {
                    // Try failover
                    await this.failoverManager.handleFailure(requestType, error);
                    await this.delay(Math.pow(2, attempts) * 1000); // Exponential backoff
                }
            }
        }

        // All attempts failed
        this.emit('request_failed', {
            agentId,
            requestType,
            error: lastError.message,
            attempts
        });

        throw new Error(`Request failed after ${maxAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Get eligible servers for request type
     */
    getEligibleServers(requestType, requirements = {}) {
        return Array.from(this.serverPool.values()).filter(server => {
            // Check server status
            if (server.status !== 'active') return false;
            
            // Check capabilities
            if (requirements.capabilities) {
                const hasCapabilities = requirements.capabilities.every(cap => 
                    server.capabilities.includes(cap)
                );
                if (!hasCapabilities) return false;
            }
            
            // Check rate limits
            if (this.isRateLimited(server)) return false;
            
            // Check load capacity
            if (server.metrics.current_load > 0.9) return false;
            
            return true;
        });
    }

    /**
     * Perform health check on server
     */
    async performHealthCheck(server) {
        try {
            const startTime = Date.now();
            
            // Simulate health check (in real implementation, this would ping the server)
            await this.delay(Math.random() * 100); // Simulate response time
            
            const responseTime = Date.now() - startTime;
            
            // Update health metrics
            server.health.last_check = new Date();
            server.health.consecutive_failures = 0;
            server.health.availability_score = Math.min(1.0, server.health.availability_score + 0.1);
            server.status = 'active';
            
            // Update response time metrics
            server.metrics.response_times.push(responseTime);
            if (server.metrics.response_times.length > 100) {
                server.metrics.response_times.shift();
            }
            
            this.emit('health_check_passed', { serverId: server.id, responseTime });
            
        } catch (error) {
            server.health.consecutive_failures++;
            server.health.availability_score = Math.max(0.0, server.health.availability_score - 0.2);
            
            if (server.health.consecutive_failures >= 3) {
                server.status = 'unhealthy';
                this.emit('server_unhealthy', { serverId: server.id, error: error.message });
            }
            
            throw error;
        }
    }

    /**
     * Update server metrics after request
     */
    async updateServerMetrics(server, responseTime, success) {
        if (success) {
            server.metrics.success_count++;
        } else {
            server.metrics.error_count++;
        }

        server.metrics.response_times.push(responseTime);
        if (server.metrics.response_times.length > 100) {
            server.metrics.response_times.shift();
        }

        // Update current load
        server.metrics.current_load = this.calculateCurrentLoad(server);
        
        // Update rate limiting counters
        this.updateRateLimitCounters(server);
    }

    /**
     * Calculate current server load
     */
    calculateCurrentLoad(server) {
        const activeConnections = server.connections.size;
        const maxConnections = server.config.rate_limits?.concurrent_connections || 5;
        const queueDepth = server.metrics.queue_depth;
        const maxQueue = 10;
        
        const connectionLoad = activeConnections / maxConnections;
        const queueLoad = queueDepth / maxQueue;
        
        return Math.min(1.0, Math.max(connectionLoad, queueLoad));
    }

    /**
     * Check if server is rate limited
     */
    isRateLimited(server) {
        const now = Date.now();
        const limits = server.config.rate_limits;
        
        if (!limits) return false;
        
        // Reset counters if needed
        if (now - server.rate_limits.last_reset > 60000) { // 1 minute
            server.rate_limits.current_rpm = 0;
            server.rate_limits.last_reset = now;
        }
        
        if (now - server.rate_limits.last_reset > 3600000) { // 1 hour
            server.rate_limits.current_rph = 0;
        }
        
        return (
            server.rate_limits.current_rpm >= limits.requests_per_minute ||
            server.rate_limits.current_rph >= limits.requests_per_hour ||
            server.connections.size >= limits.concurrent_connections
        );
    }

    /**
     * Update rate limiting counters
     */
    updateRateLimitCounters(server) {
        server.rate_limits.current_rpm++;
        server.rate_limits.current_rph++;
    }

    /**
     * Calculate capability matching score
     */
    calculateCapabilityScore(server, requestType, requirements) {
        if (!requirements.capabilities) return 1.0;
        
        const matchedCapabilities = requirements.capabilities.filter(cap => 
            server.capabilities.includes(cap)
        ).length;
        
        return matchedCapabilities / requirements.capabilities.length;
    }

    /**
     * Calculate load score (lower load = higher score)
     */
    calculateLoadScore(server) {
        return 1.0 - server.metrics.current_load;
    }

    /**
     * Calculate response time score
     */
    calculateResponseTimeScore(server) {
        if (server.metrics.response_times.length === 0) return 1.0;
        
        const avgResponseTime = server.metrics.response_times.reduce((a, b) => a + b, 0) / 
                               server.metrics.response_times.length;
        
        // Normalize to 0-1 scale (lower is better)
        const maxAcceptableTime = 5000; // 5 seconds
        return Math.max(0, 1.0 - (avgResponseTime / maxAcceptableTime));
    }

    /**
     * Calculate cost efficiency score
     */
    calculateCostScore(server) {
        const costPerRequest = server.config.cost_per_request || 0.001;
        const maxCost = 0.1; // Maximum acceptable cost per request
        
        return Math.max(0, 1.0 - (costPerRequest / maxCost));
    }

    /**
     * Execute actual server request (placeholder)
     */
    async executeServerRequest(server, requestType, requestData, options) {
        // This would implement actual MCP server communication
        // For now, simulate request execution
        
        const responseTime = server.config.avg_response_time || 500;
        await this.delay(responseTime + (Math.random() * 200));
        
        // Simulate request
        return {
            success: true,
            data: `Response from ${server.id} for ${requestType}`,
            timestamp: new Date(),
            serverId: server.id,
            requestType
        };
    }

    /**
     * Get comprehensive server statistics
     */
    getServerStatistics() {
        const stats = {
            total_servers: this.serverPool.size,
            active_servers: 0,
            unhealthy_servers: 0,
            total_requests: 0,
            total_errors: 0,
            average_response_time: 0,
            cache_hit_rate: this.cacheManager.getHitRate(),
            cost_efficiency: this.costOptimizer.getEfficiencyMetrics()
        };

        let totalResponseTime = 0;
        let responseTimeCount = 0;

        for (const server of this.serverPool.values()) {
            if (server.status === 'active') stats.active_servers++;
            if (server.status === 'unhealthy') stats.unhealthy_servers++;
            
            stats.total_requests += server.metrics.success_count + server.metrics.error_count;
            stats.total_errors += server.metrics.error_count;
            
            if (server.metrics.response_times.length > 0) {
                totalResponseTime += server.metrics.response_times.reduce((a, b) => a + b, 0);
                responseTimeCount += server.metrics.response_times.length;
            }
        }

        if (responseTimeCount > 0) {
            stats.average_response_time = totalResponseTime / responseTimeCount;
        }

        return stats;
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Load Balancer for MCP Servers
 */
class MCPLoadBalancer {
    constructor() {
        this.selectionHistory = new Map();
        this.loadDistribution = new Map();
    }

    async initialize(serverPool) {
        this.serverPool = serverPool;
        console.log('Load Balancer initialized');
    }

    async recordSelection(serverId, agentId) {
        if (!this.selectionHistory.has(agentId)) {
            this.selectionHistory.set(agentId, []);
        }
        
        this.selectionHistory.get(agentId).push({
            serverId,
            timestamp: Date.now()
        });

        // Update load distribution
        if (!this.loadDistribution.has(serverId)) {
            this.loadDistribution.set(serverId, 0);
        }
        this.loadDistribution.set(serverId, this.loadDistribution.get(serverId) + 1);
    }

    getLoadDistribution() {
        return Object.fromEntries(this.loadDistribution);
    }
}

/**
 * Failover Manager for MCP Servers
 */
class MCPFailoverManager {
    constructor() {
        this.failoverChains = new Map();
        this.failureHistory = new Map();
    }

    async initialize(serverPool) {
        this.serverPool = serverPool;
        this.setupFailoverChains();
        console.log('Failover Manager initialized');
    }

    setupFailoverChains() {
        const chains = {
            "context7": ["taskmaster_ai", "web_search"],
            "sequential": ["context7", "native_analysis"],
            "magic": ["context7", "manual_implementation"],
            "playwright": ["manual_testing", "context7"],
            "taskmaster_ai": ["context7", "sequential"]
        };

        for (const [primary, fallbacks] of Object.entries(chains)) {
            this.failoverChains.set(primary, fallbacks);
        }
    }

    async handleFailure(requestType, error) {
        console.warn(`Handling failover for request type: ${requestType}`, error.message);
        
        // Record failure
        if (!this.failureHistory.has(requestType)) {
            this.failureHistory.set(requestType, []);
        }
        
        this.failureHistory.get(requestType).push({
            timestamp: Date.now(),
            error: error.message
        });

        // Implement failover logic
        return true;
    }
}

/**
 * Performance Monitor for MCP Servers
 */
class MCPPerformanceMonitor {
    constructor() {
        this.monitoringInterval = null;
        this.metrics = new Map();
    }

    async startMonitoring(serverPool) {
        this.serverPool = serverPool;
        
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, 30000); // Every 30 seconds
        
        console.log('Performance Monitor started');
    }

    collectMetrics() {
        for (const [serverId, server] of this.serverPool.entries()) {
            const metrics = {
                timestamp: Date.now(),
                response_time: this.calculateAverageResponseTime(server),
                error_rate: this.calculateErrorRate(server),
                availability: server.health.availability_score,
                current_load: server.metrics.current_load
            };

            if (!this.metrics.has(serverId)) {
                this.metrics.set(serverId, []);
            }
            
            this.metrics.get(serverId).push(metrics);
            
            // Keep only last 100 metrics
            if (this.metrics.get(serverId).length > 100) {
                this.metrics.get(serverId).shift();
            }
        }
    }

    calculateAverageResponseTime(server) {
        if (server.metrics.response_times.length === 0) return 0;
        return server.metrics.response_times.reduce((a, b) => a + b, 0) / 
               server.metrics.response_times.length;
    }

    calculateErrorRate(server) {
        const total = server.metrics.success_count + server.metrics.error_count;
        return total > 0 ? server.metrics.error_count / total : 0;
    }
}

/**
 * Cache Manager for MCP Requests
 */
class MCPCacheManager {
    constructor() {
        this.cache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.cachePolicies = new Map();
    }

    async initialize() {
        this.setupCachePolicies();
        console.log('Cache Manager initialized');
    }

    setupCachePolicies() {
        this.cachePolicies.set('documentation_lookup', { ttl: 3600000, enabled: true }); // 1 hour
        this.cachePolicies.set('code_examples', { ttl: 1800000, enabled: true }); // 30 minutes
        this.cachePolicies.set('ui_generation', { ttl: 900000, enabled: true }); // 15 minutes
        this.cachePolicies.set('test_results', { ttl: 600000, enabled: true }); // 10 minutes
        this.cachePolicies.set('real_time_data', { ttl: 0, enabled: false }); // No cache
    }

    generateCacheKey(requestType, requestData) {
        const dataString = JSON.stringify(requestData);
        return crypto.createHash('md5').update(`${requestType}:${dataString}`).digest('hex');
    }

    async get(cacheKey) {
        const cached = this.cache.get(cacheKey);
        
        if (!cached) {
            this.cacheMisses++;
            return null;
        }

        if (Date.now() > cached.expiry) {
            this.cache.delete(cacheKey);
            this.cacheMisses++;
            return null;
        }

        this.cacheHits++;
        return cached.data;
    }

    async set(cacheKey, data, requestType) {
        const policy = this.cachePolicies.get(requestType);
        
        if (!policy || !policy.enabled || policy.ttl === 0) {
            return false;
        }

        this.cache.set(cacheKey, {
            data,
            expiry: Date.now() + policy.ttl,
            requestType
        });

        return true;
    }

    shouldCache(requestType, result) {
        const policy = this.cachePolicies.get(requestType);
        return policy && policy.enabled && result && !result.error;
    }

    getHitRate() {
        const total = this.cacheHits + this.cacheMisses;
        return total > 0 ? this.cacheHits / total : 0;
    }
}

/**
 * Cost Optimizer for MCP Server Usage
 */
class MCPCostOptimizer {
    constructor() {
        this.usageHistory = new Map();
        this.costBudgets = new Map();
        this.costAlerts = new Map();
    }

    async initialize(serverPool) {
        this.serverPool = serverPool;
        this.setupCostBudgets();
        console.log('Cost Optimizer initialized');
    }

    setupCostBudgets() {
        // Set monthly budgets for each server
        this.costBudgets.set('context7', { monthly: 100, daily: 5 });
        this.costBudgets.set('sequential', { monthly: 200, daily: 10 });
        this.costBudgets.set('magic', { monthly: 500, daily: 25 });
        this.costBudgets.set('playwright', { monthly: 150, daily: 7 });
        this.costBudgets.set('taskmaster_ai', { monthly: 300, daily: 15 });
    }

    async recordUsage(serverId, requestType, responseTime) {
        const server = this.serverPool.get(serverId);
        if (!server) return;

        const cost = this.calculateRequestCost(server, requestType, responseTime);
        
        if (!this.usageHistory.has(serverId)) {
            this.usageHistory.set(serverId, []);
        }

        this.usageHistory.get(serverId).push({
            timestamp: Date.now(),
            requestType,
            cost,
            responseTime
        });

        // Check budget alerts
        await this.checkBudgetAlerts(serverId);
    }

    calculateRequestCost(server, requestType, responseTime) {
        const baseCost = server.config.cost_per_request || 0.001;
        const timeFactor = responseTime / 1000; // Convert to seconds
        return baseCost * (1 + timeFactor * 0.1); // Add 10% for each second
    }

    async checkBudgetAlerts(serverId) {
        const usage = this.getDailyCost(serverId);
        const budget = this.costBudgets.get(serverId);
        
        if (!budget) return;

        if (usage > budget.daily * 0.8) { // 80% of daily budget
            console.warn(`Server ${serverId} approaching daily budget: $${usage.toFixed(2)}/$${budget.daily}`);
        }

        if (usage > budget.daily) {
            console.error(`Server ${serverId} exceeded daily budget: $${usage.toFixed(2)}/$${budget.daily}`);
        }
    }

    getDailyCost(serverId) {
        const now = Date.now();
        const oneDayAgo = now - 86400000; // 24 hours
        
        const history = this.usageHistory.get(serverId) || [];
        return history
            .filter(entry => entry.timestamp > oneDayAgo)
            .reduce((total, entry) => total + entry.cost, 0);
    }

    getEfficiencyMetrics() {
        let totalCost = 0;
        let totalRequests = 0;

        for (const [serverId, history] of this.usageHistory.entries()) {
            totalCost += history.reduce((sum, entry) => sum + entry.cost, 0);
            totalRequests += history.length;
        }

        return {
            average_cost_per_request: totalRequests > 0 ? totalCost / totalRequests : 0,
            total_cost: totalCost,
            total_requests: totalRequests
        };
    }
}

module.exports = { 
    MCPServerOptimizer, 
    MCPLoadBalancer, 
    MCPFailoverManager, 
    MCPPerformanceMonitor, 
    MCPCacheManager, 
    MCPCostOptimizer 
};