/**
 * DwayBank MCP Server Monitoring Dashboard
 * Real-time monitoring and analytics for MCP server ecosystem
 */

const EventEmitter = require('events');

class MCPMonitoringDashboard extends EventEmitter {
    constructor(serverOptimizer, communicationBus) {
        super();
        this.serverOptimizer = serverOptimizer;
        this.communicationBus = communicationBus;
        this.dashboardData = new Map();
        this.alertManager = new MCPAlertManager();
        this.metricsCollector = new MCPMetricsCollector();
        this.performanceAnalyzer = new MCPPerformanceAnalyzer();
        
        this.initialize();
    }

    /**
     * Initialize monitoring dashboard
     */
    async initialize() {
        console.log('Initializing MCP Monitoring Dashboard...');
        
        // Setup metrics collection
        await this.metricsCollector.initialize();
        
        // Setup alert management
        await this.alertManager.initialize();
        
        // Setup performance analysis
        await this.performanceAnalyzer.initialize();
        
        // Start real-time monitoring
        this.startRealTimeMonitoring();
        
        // Setup dashboard data structure
        this.initializeDashboardData();
        
        console.log('MCP Monitoring Dashboard initialized successfully');
        this.emit('dashboard_ready');
    }

    /**
     * Initialize dashboard data structure
     */
    initializeDashboardData() {
        this.dashboardData.set('overview', {
            total_servers: 0,
            active_servers: 0,
            total_requests_today: 0,
            avg_response_time: 0,
            error_rate: 0,
            cost_today: 0,
            cache_hit_rate: 0,
            last_updated: new Date()
        });

        this.dashboardData.set('server_status', new Map());
        this.dashboardData.set('performance_metrics', new Map());
        this.dashboardData.set('cost_analysis', new Map());
        this.dashboardData.set('alerts', []);
        this.dashboardData.set('trends', new Map());
    }

    /**
     * Start real-time monitoring with live updates
     */
    startRealTimeMonitoring() {
        // Update dashboard every 10 seconds
        setInterval(() => {
            this.updateDashboardData();
        }, 10000);

        // Collect detailed metrics every 30 seconds
        setInterval(() => {
            this.collectDetailedMetrics();
        }, 30000);

        // Analyze trends every 5 minutes
        setInterval(() => {
            this.analyzeTrends();
        }, 300000);

        // Generate reports every hour
        setInterval(() => {
            this.generateHourlyReport();
        }, 3600000);
    }

    /**
     * Update real-time dashboard data
     */
    async updateDashboardData() {
        try {
            const serverStats = this.serverOptimizer.getServerStatistics();
            const overview = this.dashboardData.get('overview');
            
            // Update overview metrics
            overview.total_servers = serverStats.total_servers;
            overview.active_servers = serverStats.active_servers;
            overview.avg_response_time = serverStats.average_response_time;
            overview.error_rate = serverStats.total_errors / Math.max(1, serverStats.total_requests);
            overview.cache_hit_rate = serverStats.cache_hit_rate;
            overview.last_updated = new Date();

            // Update server status
            await this.updateServerStatus();
            
            // Update performance metrics
            await this.updatePerformanceMetrics();
            
            // Update cost analysis
            await this.updateCostAnalysis();
            
            // Check for alerts
            await this.checkAlerts();
            
            this.emit('dashboard_updated', {
                timestamp: new Date(),
                overview: overview
            });

        } catch (error) {
            console.error('Error updating dashboard data:', error);
            this.emit('dashboard_error', error);
        }
    }

    /**
     * Update individual server status
     */
    async updateServerStatus() {
        const serverStatus = this.dashboardData.get('server_status');
        
        for (const [serverId, server] of this.serverOptimizer.serverPool.entries()) {
            const status = {
                id: serverId,
                status: server.status,
                health_score: server.health.availability_score,
                current_load: server.metrics.current_load,
                connections: server.connections.size,
                queue_depth: server.metrics.queue_depth,
                response_time: this.calculateAverageResponseTime(server),
                error_rate: this.calculateErrorRate(server),
                uptime: this.calculateUptime(server),
                last_health_check: server.health.last_check,
                capabilities: server.capabilities,
                rate_limit_status: this.getRateLimitStatus(server)
            };

            serverStatus.set(serverId, status);
        }
    }

    /**
     * Update performance metrics
     */
    async updatePerformanceMetrics() {
        const performanceMetrics = this.dashboardData.get('performance_metrics');
        
        const metrics = {
            timestamp: new Date(),
            overall_performance: {
                avg_response_time: this.calculateOverallResponseTime(),
                throughput: this.calculateThroughput(),
                availability: this.calculateOverallAvailability(),
                error_rate: this.calculateOverallErrorRate()
            },
            server_performance: await this.getServerPerformanceMetrics(),
            bottlenecks: await this.identifyBottlenecks(),
            optimization_suggestions: await this.generateOptimizationSuggestions()
        };

        performanceMetrics.set(Date.now(), metrics);
        
        // Keep only last 100 performance snapshots
        if (performanceMetrics.size > 100) {
            const oldestKey = Math.min(...performanceMetrics.keys());
            performanceMetrics.delete(oldestKey);
        }
    }

    /**
     * Update cost analysis
     */
    async updateCostAnalysis() {
        const costAnalysis = this.dashboardData.get('cost_analysis');
        
        const analysis = {
            timestamp: new Date(),
            daily_costs: await this.calculateDailyCosts(),
            monthly_projections: await this.calculateMonthlyProjections(),
            cost_efficiency: await this.calculateCostEfficiency(),
            budget_utilization: await this.calculateBudgetUtilization(),
            cost_optimization_opportunities: await this.identifyCostOptimizations(),
            cost_breakdown_by_server: await this.getCostBreakdownByServer(),
            cost_breakdown_by_agent: await this.getCostBreakdownByAgent()
        };

        costAnalysis.set(Date.now(), analysis);
        
        // Keep only last 48 cost analysis snapshots (for 2 days of hourly data)
        if (costAnalysis.size > 48) {
            const oldestKey = Math.min(...costAnalysis.keys());
            costAnalysis.delete(oldestKey);
        }
    }

    /**
     * Check for alerts and trigger notifications
     */
    async checkAlerts() {
        const alerts = this.dashboardData.get('alerts');
        const newAlerts = [];

        // Check server health alerts
        for (const [serverId, server] of this.serverOptimizer.serverPool.entries()) {
            // Availability alert
            if (server.health.availability_score < 0.9) {
                newAlerts.push({
                    id: `availability_${serverId}_${Date.now()}`,
                    type: 'server_availability',
                    severity: server.health.availability_score < 0.8 ? 'critical' : 'warning',
                    server: serverId,
                    message: `Server ${serverId} availability dropped to ${(server.health.availability_score * 100).toFixed(1)}%`,
                    timestamp: new Date(),
                    metrics: {
                        availability_score: server.health.availability_score,
                        consecutive_failures: server.health.consecutive_failures
                    }
                });
            }

            // Response time alert
            const avgResponseTime = this.calculateAverageResponseTime(server);
            if (avgResponseTime > 5000) {
                newAlerts.push({
                    id: `response_time_${serverId}_${Date.now()}`,
                    type: 'high_response_time',
                    severity: avgResponseTime > 10000 ? 'critical' : 'warning',
                    server: serverId,
                    message: `Server ${serverId} response time is ${avgResponseTime.toFixed(0)}ms`,
                    timestamp: new Date(),
                    metrics: {
                        response_time: avgResponseTime,
                        threshold: 5000
                    }
                });
            }

            // Error rate alert
            const errorRate = this.calculateErrorRate(server);
            if (errorRate > 0.05) {
                newAlerts.push({
                    id: `error_rate_${serverId}_${Date.now()}`,
                    type: 'high_error_rate',
                    severity: errorRate > 0.15 ? 'critical' : 'warning',
                    server: serverId,
                    message: `Server ${serverId} error rate is ${(errorRate * 100).toFixed(1)}%`,
                    timestamp: new Date(),
                    metrics: {
                        error_rate: errorRate,
                        threshold: 0.05
                    }
                });
            }
        }

        // Check cost alerts
        const costAlerts = await this.checkCostAlerts();
        newAlerts.push(...costAlerts);

        // Add new alerts and limit to last 100
        alerts.push(...newAlerts);
        if (alerts.length > 100) {
            alerts.splice(0, alerts.length - 100);
        }

        // Send alerts to communication bus
        for (const alert of newAlerts) {
            await this.sendAlert(alert);
        }
    }

    /**
     * Send alert through communication bus
     */
    async sendAlert(alert) {
        try {
            await this.communicationBus.broadcastMessage('mcp_coordinator', [
                'taskmaster_monitor',
                'taskmaster_project_manager',
                'quality_controller'
            ], {
                type: 'mcp_server_alert',
                priority: alert.severity === 'critical' ? 'critical' : 'high',
                content: {
                    alert_id: alert.id,
                    alert_type: alert.type,
                    severity: alert.severity,
                    server: alert.server,
                    message: alert.message,
                    metrics: alert.metrics,
                    timestamp: alert.timestamp,
                    recommended_actions: this.getRecommendedActions(alert)
                }
            });

            this.emit('alert_sent', alert);

        } catch (error) {
            console.error('Failed to send alert:', error);
        }
    }

    /**
     * Get recommended actions for alert
     */
    getRecommendedActions(alert) {
        const actions = {
            server_availability: [
                'Check server health endpoint',
                'Restart server if necessary',
                'Switch to backup server',
                'Investigate underlying cause'
            ],
            high_response_time: [
                'Check server load',
                'Optimize server configuration',
                'Scale resources if needed',
                'Route traffic to faster servers'
            ],
            high_error_rate: [
                'Check server logs',
                'Investigate error patterns',
                'Restart server if necessary',
                'Route traffic to healthy servers'
            ],
            cost_budget_exceeded: [
                'Review usage patterns',
                'Implement cost controls',
                'Optimize expensive operations',
                'Consider server alternatives'
            ]
        };

        return actions[alert.type] || ['Investigate issue', 'Contact support if needed'];
    }

    /**
     * Generate dashboard view for specific timeframe
     */
    generateDashboardView(timeframe = '1h') {
        const now = Date.now();
        const timeframes = {
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000
        };

        const cutoff = now - (timeframes[timeframe] || timeframes['1h']);

        return {
            metadata: {
                generated: new Date(),
                timeframe: timeframe,
                data_points: this.countDataPoints(cutoff)
            },
            overview: this.dashboardData.get('overview'),
            server_status: Object.fromEntries(this.dashboardData.get('server_status')),
            performance_trends: this.getPerformanceTrends(cutoff),
            cost_analysis: this.getCostAnalysis(cutoff),
            recent_alerts: this.getRecentAlerts(cutoff),
            optimization_recommendations: this.getOptimizationRecommendations()
        };
    }

    /**
     * Calculate various metrics and helper functions
     */
    calculateAverageResponseTime(server) {
        if (server.metrics.response_times.length === 0) return 0;
        return server.metrics.response_times.reduce((a, b) => a + b, 0) / 
               server.metrics.response_times.length;
    }

    calculateErrorRate(server) {
        const total = server.metrics.success_count + server.metrics.error_count;
        return total > 0 ? server.metrics.error_count / total : 0;
    }

    calculateUptime(server) {
        // Simplified uptime calculation
        return server.health.availability_score * 100;
    }

    getRateLimitStatus(server) {
        const limits = server.config.rate_limits;
        if (!limits) return 'no_limits';

        const rpmUtilization = server.rate_limits.current_rpm / limits.requests_per_minute;
        const rphUtilization = server.rate_limits.current_rph / limits.requests_per_hour;

        if (rpmUtilization > 0.9 || rphUtilization > 0.9) return 'critical';
        if (rpmUtilization > 0.7 || rphUtilization > 0.7) return 'warning';
        return 'normal';
    }

    async checkCostAlerts() {
        const alerts = [];
        const costAnalysis = this.serverOptimizer.costOptimizer;
        
        for (const [serverId, budget] of costAnalysis.costBudgets.entries()) {
            const dailyCost = costAnalysis.getDailyCost(serverId);
            
            if (dailyCost > budget.daily) {
                alerts.push({
                    id: `cost_budget_${serverId}_${Date.now()}`,
                    type: 'cost_budget_exceeded',
                    severity: 'critical',
                    server: serverId,
                    message: `Server ${serverId} exceeded daily budget: $${dailyCost.toFixed(2)}/$${budget.daily}`,
                    timestamp: new Date(),
                    metrics: {
                        daily_cost: dailyCost,
                        budget: budget.daily,
                        utilization: dailyCost / budget.daily
                    }
                });
            } else if (dailyCost > budget.daily * 0.8) {
                alerts.push({
                    id: `cost_warning_${serverId}_${Date.now()}`,
                    type: 'cost_budget_warning',
                    severity: 'warning',
                    server: serverId,
                    message: `Server ${serverId} approaching daily budget: $${dailyCost.toFixed(2)}/$${budget.daily}`,
                    timestamp: new Date(),
                    metrics: {
                        daily_cost: dailyCost,
                        budget: budget.daily,
                        utilization: dailyCost / budget.daily
                    }
                });
            }
        }

        return alerts;
    }

    calculateOverallResponseTime() {
        let totalTime = 0;
        let totalRequests = 0;

        for (const server of this.serverOptimizer.serverPool.values()) {
            if (server.metrics.response_times.length > 0) {
                totalTime += server.metrics.response_times.reduce((a, b) => a + b, 0);
                totalRequests += server.metrics.response_times.length;
            }
        }

        return totalRequests > 0 ? totalTime / totalRequests : 0;
    }

    calculateThroughput() {
        let totalRequests = 0;
        
        for (const server of this.serverOptimizer.serverPool.values()) {
            totalRequests += server.metrics.success_count + server.metrics.error_count;
        }

        // Return requests per minute (simplified)
        return totalRequests / 60;
    }

    calculateOverallAvailability() {
        let totalAvailability = 0;
        let serverCount = 0;

        for (const server of this.serverOptimizer.serverPool.values()) {
            totalAvailability += server.health.availability_score;
            serverCount++;
        }

        return serverCount > 0 ? totalAvailability / serverCount : 0;
    }

    calculateOverallErrorRate() {
        let totalErrors = 0;
        let totalRequests = 0;

        for (const server of this.serverOptimizer.serverPool.values()) {
            totalErrors += server.metrics.error_count;
            totalRequests += server.metrics.success_count + server.metrics.error_count;
        }

        return totalRequests > 0 ? totalErrors / totalRequests : 0;
    }

    async getServerPerformanceMetrics() {
        const metrics = {};
        
        for (const [serverId, server] of this.serverOptimizer.serverPool.entries()) {
            metrics[serverId] = {
                response_time: this.calculateAverageResponseTime(server),
                error_rate: this.calculateErrorRate(server),
                availability: server.health.availability_score,
                load: server.metrics.current_load,
                throughput: (server.metrics.success_count + server.metrics.error_count) / 60
            };
        }

        return metrics;
    }

    async identifyBottlenecks() {
        const bottlenecks = [];
        
        for (const [serverId, server] of this.serverOptimizer.serverPool.entries()) {
            if (server.metrics.current_load > 0.8) {
                bottlenecks.push({
                    server: serverId,
                    type: 'high_load',
                    severity: server.metrics.current_load > 0.9 ? 'critical' : 'warning',
                    value: server.metrics.current_load
                });
            }

            const avgResponseTime = this.calculateAverageResponseTime(server);
            if (avgResponseTime > 3000) {
                bottlenecks.push({
                    server: serverId,
                    type: 'slow_response',
                    severity: avgResponseTime > 5000 ? 'critical' : 'warning',
                    value: avgResponseTime
                });
            }
        }

        return bottlenecks;
    }

    async generateOptimizationSuggestions() {
        const suggestions = [];
        
        // Analyze server performance and suggest optimizations
        for (const [serverId, server] of this.serverOptimizer.serverPool.entries()) {
            if (server.metrics.current_load > 0.7) {
                suggestions.push({
                    type: 'load_balancing',
                    server: serverId,
                    suggestion: 'Consider redistributing load to other servers',
                    impact: 'medium',
                    effort: 'low'
                });
            }

            const errorRate = this.calculateErrorRate(server);
            if (errorRate > 0.05) {
                suggestions.push({
                    type: 'error_reduction',
                    server: serverId,
                    suggestion: 'Investigate and fix error patterns',
                    impact: 'high',
                    effort: 'medium'
                });
            }
        }

        return suggestions;
    }

    async calculateDailyCosts() {
        const costs = {};
        
        for (const serverId of this.serverOptimizer.serverPool.keys()) {
            costs[serverId] = this.serverOptimizer.costOptimizer.getDailyCost(serverId);
        }

        return costs;
    }

    async calculateMonthlyProjections() {
        const projections = {};
        
        for (const [serverId, cost] of Object.entries(await this.calculateDailyCosts())) {
            projections[serverId] = cost * 30; // Simple projection
        }

        return projections;
    }

    async calculateCostEfficiency() {
        return this.serverOptimizer.costOptimizer.getEfficiencyMetrics();
    }

    async calculateBudgetUtilization() {
        const utilization = {};
        
        for (const [serverId, budget] of this.serverOptimizer.costOptimizer.costBudgets.entries()) {
            const dailyCost = this.serverOptimizer.costOptimizer.getDailyCost(serverId);
            utilization[serverId] = {
                daily: dailyCost / budget.daily,
                monthly: (dailyCost * 30) / budget.monthly
            };
        }

        return utilization;
    }

    async identifyCostOptimizations() {
        const optimizations = [];
        
        // Add cost optimization suggestions based on usage patterns
        return optimizations;
    }

    async getCostBreakdownByServer() {
        const breakdown = {};
        
        for (const serverId of this.serverOptimizer.serverPool.keys()) {
            const history = this.serverOptimizer.costOptimizer.usageHistory.get(serverId) || [];
            breakdown[serverId] = {
                total_requests: history.length,
                total_cost: history.reduce((sum, entry) => sum + entry.cost, 0),
                avg_cost_per_request: history.length > 0 ? 
                    history.reduce((sum, entry) => sum + entry.cost, 0) / history.length : 0
            };
        }

        return breakdown;
    }

    async getCostBreakdownByAgent() {
        // This would require tracking which agent made which requests
        // For now, return placeholder
        return {};
    }

    getPerformanceTrends(cutoff) {
        const performanceMetrics = this.dashboardData.get('performance_metrics');
        const trends = {};

        for (const [timestamp, metrics] of performanceMetrics.entries()) {
            if (timestamp > cutoff) {
                trends[timestamp] = metrics.overall_performance;
            }
        }

        return trends;
    }

    getCostAnalysis(cutoff) {
        const costAnalysis = this.dashboardData.get('cost_analysis');
        const analysis = {};

        for (const [timestamp, data] of costAnalysis.entries()) {
            if (timestamp > cutoff) {
                analysis[timestamp] = data;
            }
        }

        return analysis;
    }

    getRecentAlerts(cutoff) {
        const alerts = this.dashboardData.get('alerts');
        return alerts.filter(alert => alert.timestamp.getTime() > cutoff);
    }

    getOptimizationRecommendations() {
        // Return latest optimization recommendations
        return [];
    }

    countDataPoints(cutoff) {
        let count = 0;
        
        for (const [timestamp] of this.dashboardData.get('performance_metrics').entries()) {
            if (timestamp > cutoff) count++;
        }

        return count;
    }

    async collectDetailedMetrics() {
        // Collect detailed metrics for analysis
        this.emit('metrics_collected');
    }

    async analyzeTrends() {
        // Analyze trends and patterns
        this.emit('trends_analyzed');
    }

    async generateHourlyReport() {
        // Generate comprehensive hourly report
        this.emit('hourly_report_generated');
    }
}

/**
 * Alert Manager for MCP Monitoring
 */
class MCPAlertManager {
    constructor() {
        this.alertRules = new Map();
        this.alertHistory = [];
        this.suppressionRules = new Map();
    }

    async initialize() {
        this.setupDefaultAlertRules();
        console.log('Alert Manager initialized');
    }

    setupDefaultAlertRules() {
        // Default alert rules would be set up here
    }
}

/**
 * Metrics Collector for MCP Monitoring
 */
class MCPMetricsCollector {
    constructor() {
        this.metricsBuffer = new Map();
        this.aggregationRules = new Map();
    }

    async initialize() {
        console.log('Metrics Collector initialized');
    }
}

/**
 * Performance Analyzer for MCP Monitoring
 */
class MCPPerformanceAnalyzer {
    constructor() {
        this.analysisRules = new Map();
        this.performanceBaselines = new Map();
    }

    async initialize() {
        console.log('Performance Analyzer initialized');
    }
}

module.exports = { 
    MCPMonitoringDashboard, 
    MCPAlertManager, 
    MCPMetricsCollector, 
    MCPPerformanceAnalyzer 
};