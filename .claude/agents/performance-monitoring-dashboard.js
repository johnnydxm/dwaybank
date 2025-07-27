/**
 * Performance Monitoring Dashboard
 * Real-time performance monitoring and analytics for 18-agent ecosystem
 */

const EventEmitter = require('events');

class PerformanceMonitoringDashboard extends EventEmitter {
    constructor(communicationBus, resourceAllocationMatrix, eventProcessor) {
        super();
        this.communicationBus = communicationBus;
        this.resourceAllocationMatrix = resourceAllocationMatrix;
        this.eventProcessor = eventProcessor;
        this.metricsCollector = new MetricsCollector();
        this.dashboardEngine = new DashboardEngine();
        this.alertManager = new PerformanceAlertManager();
        this.analyticsEngine = new RealTimeAnalyticsEngine();
        this.visualizationEngine = new VisualizationEngine();
        this.reportGenerator = new PerformanceReportGenerator();
        
        // Dashboard configuration
        this.config = {
            update_interval: 1000, // 1 second
            data_retention: 86400000, // 24 hours
            alert_thresholds: {
                cpu_utilization: 80,
                memory_utilization: 85,
                response_time: 5000,
                error_rate: 0.05,
                queue_depth: 100
            },
            dashboard_refresh: 5000, // 5 seconds
            real_time_updates: true,
            historical_analysis: true
        };

        // Dashboard data structures
        this.dashboards = new Map();
        this.metrics = new Map();
        this.alerts = new Map();
        this.historicalData = new Map();
        this.subscribers = new Map();
        
        // Performance tracking
        this.performanceMetrics = {
            system_health: {
                overall_score: 0,
                agent_availability: 0,
                resource_utilization: 0,
                response_times: 0,
                error_rates: 0
            },
            agent_performance: new Map(),
            coalition_performance: new Map(),
            workflow_performance: new Map(),
            mcp_server_performance: new Map(),
            compliance_metrics: {
                violation_rate: 0,
                audit_score: 0,
                remediation_time: 0
            }
        };
    }

    async initialize() {
        console.log('Initializing Performance Monitoring Dashboard...');
        
        // Initialize components
        await this.metricsCollector.initialize();
        await this.dashboardEngine.initialize();
        await this.alertManager.initialize();
        await this.analyticsEngine.initialize();
        await this.visualizationEngine.initialize();
        await this.reportGenerator.initialize();
        
        // Setup dashboards
        await this.setupDashboards();
        
        // Setup metrics collection
        await this.setupMetricsCollection();
        
        // Start real-time monitoring
        this.startRealTimeMonitoring();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('Performance Monitoring Dashboard initialized successfully');
        this.emit('dashboard_ready');
    }

    /**
     * Setup performance dashboards
     */
    async setupDashboards() {
        // System Overview Dashboard
        this.dashboards.set('system_overview', {
            id: 'system_overview',
            name: 'System Overview Dashboard',
            description: 'High-level system health and performance metrics',
            widgets: [
                {
                    id: 'system_health_score',
                    type: 'gauge',
                    title: 'Overall System Health',
                    data_source: 'system_health.overall_score',
                    thresholds: { good: 80, warning: 60, critical: 40 },
                    update_frequency: 5000
                },
                {
                    id: 'agent_availability',
                    type: 'donut_chart',
                    title: 'Agent Availability',
                    data_source: 'agent_status',
                    categories: ['available', 'busy', 'offline'],
                    update_frequency: 10000
                },
                {
                    id: 'resource_utilization',
                    type: 'line_chart',
                    title: 'Resource Utilization',
                    data_sources: ['cpu_utilization', 'memory_utilization', 'network_utilization'],
                    time_window: 3600000, // 1 hour
                    update_frequency: 5000
                },
                {
                    id: 'response_times',
                    type: 'histogram',
                    title: 'Response Time Distribution',
                    data_source: 'response_times',
                    buckets: [0, 100, 500, 1000, 5000, 10000],
                    update_frequency: 10000
                },
                {
                    id: 'active_workflows',
                    type: 'counter',
                    title: 'Active Workflows',
                    data_source: 'workflow_count',
                    update_frequency: 5000
                },
                {
                    id: 'error_rate',
                    type: 'sparkline',
                    title: 'Error Rate Trend',
                    data_source: 'error_rate',
                    time_window: 1800000, // 30 minutes
                    update_frequency: 10000
                }
            ],
            layout: 'grid_2x3',
            auto_refresh: true
        });

        // Agent Performance Dashboard
        this.dashboards.set('agent_performance', {
            id: 'agent_performance',
            name: 'Agent Performance Dashboard',
            description: 'Individual agent performance metrics and health',
            widgets: [
                {
                    id: 'agent_performance_matrix',
                    type: 'heatmap',
                    title: 'Agent Performance Matrix',
                    data_source: 'agent_performance_scores',
                    agents: ['dwaybank-architect', 'dwaybank-security', 'dwaybank-backend', 'dwaybank-frontend',
                            'taskmaster-orchestrator', 'quality-controller', 'taskmaster-monitor', 'mcp-coordinator'],
                    metrics: ['response_time', 'success_rate', 'resource_usage', 'error_rate'],
                    update_frequency: 15000
                },
                {
                    id: 'agent_workload',
                    type: 'bar_chart',
                    title: 'Agent Workload Distribution',
                    data_source: 'agent_workload',
                    orientation: 'horizontal',
                    update_frequency: 10000
                },
                {
                    id: 'coalition_efficiency',
                    type: 'radar_chart',
                    title: 'Coalition Efficiency',
                    data_source: 'coalition_metrics',
                    dimensions: ['communication', 'coordination', 'completion_rate', 'resource_efficiency'],
                    update_frequency: 20000
                },
                {
                    id: 'agent_health_status',
                    type: 'status_grid',
                    title: 'Agent Health Status',
                    data_source: 'agent_health',
                    status_indicators: ['healthy', 'degraded', 'critical', 'offline'],
                    update_frequency: 5000
                }
            ],
            layout: 'grid_2x2',
            auto_refresh: true
        });

        // Financial Operations Dashboard
        this.dashboards.set('financial_operations', {
            id: 'financial_operations',
            name: 'Financial Operations Dashboard',
            description: 'Financial workflow and compliance monitoring',
            widgets: [
                {
                    id: 'payment_processing_metrics',
                    type: 'kpi_panel',
                    title: 'Payment Processing KPIs',
                    metrics: [
                        { name: 'Transactions/sec', data_source: 'payment_throughput', format: 'number' },
                        { name: 'Success Rate', data_source: 'payment_success_rate', format: 'percentage' },
                        { name: 'Avg Processing Time', data_source: 'payment_avg_time', format: 'milliseconds' },
                        { name: 'Fraud Detection Rate', data_source: 'fraud_detection_rate', format: 'percentage' }
                    ],
                    update_frequency: 5000
                },
                {
                    id: 'trading_performance',
                    type: 'line_chart',
                    title: 'Trading Performance',
                    data_sources: ['order_execution_time', 'trade_volume', 'slippage'],
                    time_window: 1800000, // 30 minutes
                    update_frequency: 1000 // Real-time for trading
                },
                {
                    id: 'compliance_score',
                    type: 'gauge',
                    title: 'Compliance Score',
                    data_source: 'compliance_score',
                    thresholds: { good: 95, warning: 90, critical: 85 },
                    update_frequency: 30000
                },
                {
                    id: 'risk_metrics',
                    type: 'multi_gauge',
                    title: 'Risk Metrics',
                    gauges: [
                        { name: 'Market Risk', data_source: 'market_risk_score' },
                        { name: 'Credit Risk', data_source: 'credit_risk_score' },
                        { name: 'Operational Risk', data_source: 'operational_risk_score' }
                    ],
                    update_frequency: 60000
                },
                {
                    id: 'regulatory_alerts',
                    type: 'alert_feed',
                    title: 'Regulatory Alerts',
                    data_source: 'compliance_alerts',
                    severity_levels: ['critical', 'high', 'medium', 'low'],
                    max_items: 10,
                    update_frequency: 10000
                }
            ],
            layout: 'financial_layout',
            auto_refresh: true
        });

        // MCP Server Performance Dashboard
        this.dashboards.set('mcp_performance', {
            id: 'mcp_performance',
            name: 'MCP Server Performance',
            description: 'Model Context Protocol server monitoring',
            widgets: [
                {
                    id: 'mcp_server_status',
                    type: 'status_table',
                    title: 'MCP Server Status',
                    columns: ['Server', 'Status', 'Response Time', 'Success Rate', 'Active Connections'],
                    data_source: 'mcp_server_metrics',
                    update_frequency: 10000
                },
                {
                    id: 'mcp_usage_distribution',
                    type: 'pie_chart',
                    title: 'MCP Usage Distribution',
                    data_source: 'mcp_usage_stats',
                    servers: ['context7', 'sequential', 'magic', 'playwright', 'taskmaster_ai'],
                    update_frequency: 15000
                },
                {
                    id: 'mcp_response_times',
                    type: 'line_chart',
                    title: 'MCP Response Times',
                    data_sources: ['context7_response', 'sequential_response', 'magic_response', 'playwright_response'],
                    time_window: 1800000,
                    update_frequency: 5000
                },
                {
                    id: 'mcp_cost_analysis',
                    type: 'stacked_bar',
                    title: 'MCP Cost Analysis',
                    data_source: 'mcp_costs',
                    categories: ['API calls', 'Processing time', 'Data transfer'],
                    update_frequency: 30000
                }
            ],
            layout: 'grid_2x2',
            auto_refresh: true
        });

        // Resource Utilization Dashboard
        this.dashboards.set('resource_utilization', {
            id: 'resource_utilization',
            name: 'Resource Utilization Dashboard',
            description: 'System resource monitoring and optimization',
            widgets: [
                {
                    id: 'cpu_utilization_heatmap',
                    type: 'heatmap',
                    title: 'CPU Utilization by Agent',
                    data_source: 'agent_cpu_usage',
                    time_buckets: 24, // 24 hours
                    update_frequency: 10000
                },
                {
                    id: 'memory_usage_trend',
                    type: 'area_chart',
                    title: 'Memory Usage Trend',
                    data_sources: ['total_memory', 'allocated_memory', 'available_memory'],
                    time_window: 3600000, // 1 hour
                    update_frequency: 10000
                },
                {
                    id: 'network_bandwidth',
                    type: 'dual_axis_chart',
                    title: 'Network Bandwidth',
                    primary_data: 'network_in',
                    secondary_data: 'network_out',
                    time_window: 1800000,
                    update_frequency: 5000
                },
                {
                    id: 'resource_allocation_matrix',
                    type: 'sankey_diagram',
                    title: 'Resource Allocation Flow',
                    data_source: 'resource_allocation_flow',
                    update_frequency: 30000
                }
            ],
            layout: 'grid_2x2',
            auto_refresh: true
        });

        console.log(`Initialized ${this.dashboards.size} performance dashboards`);
    }

    /**
     * Setup metrics collection from all system components
     */
    async setupMetricsCollection() {
        // Agent metrics collection
        this.setupAgentMetricsCollection();
        
        // MCP server metrics collection
        this.setupMCPMetricsCollection();
        
        // Workflow metrics collection
        this.setupWorkflowMetricsCollection();
        
        // Resource metrics collection
        this.setupResourceMetricsCollection();
        
        // Compliance metrics collection
        this.setupComplianceMetricsCollection();
        
        // Financial metrics collection
        this.setupFinancialMetricsCollection();
    }

    /**
     * Setup agent metrics collection
     */
    setupAgentMetricsCollection() {
        const agents = [
            'dwaybank-architect', 'dwaybank-security', 'dwaybank-backend', 'dwaybank-frontend',
            'taskmaster-orchestrator', 'taskmaster-project-manager', 'taskmaster-researcher',
            'taskmaster-monitor', 'taskmaster-resource-manager', 'mcp-coordinator',
            'quality-controller'
        ];

        for (const agentId of agents) {
            this.metrics.set(`agent_${agentId}`, {
                id: agentId,
                status: 'unknown',
                response_time: 0,
                success_rate: 0,
                error_rate: 0,
                cpu_usage: 0,
                memory_usage: 0,
                active_tasks: 0,
                total_tasks: 0,
                last_activity: null,
                health_score: 0
            });
        }

        // Setup periodic collection
        setInterval(() => {
            this.collectAgentMetrics();
        }, this.config.update_interval);
    }

    /**
     * Setup MCP server metrics collection
     */
    setupMCPMetricsCollection() {
        const mcpServers = ['context7', 'sequential', 'magic', 'playwright', 'taskmaster_ai'];

        for (const serverId of mcpServers) {
            this.metrics.set(`mcp_${serverId}`, {
                id: serverId,
                status: 'unknown',
                response_time: 0,
                success_rate: 0,
                active_connections: 0,
                requests_per_second: 0,
                error_rate: 0,
                cost_per_request: 0,
                total_cost: 0,
                health_score: 0
            });
        }

        setInterval(() => {
            this.collectMCPMetrics();
        }, this.config.update_interval);
    }

    /**
     * Setup workflow metrics collection
     */
    setupWorkflowMetricsCollection() {
        this.metrics.set('workflows', {
            active_count: 0,
            completed_count: 0,
            failed_count: 0,
            average_execution_time: 0,
            success_rate: 0,
            compliance_violations: 0,
            resource_efficiency: 0
        });

        setInterval(() => {
            this.collectWorkflowMetrics();
        }, this.config.update_interval);
    }

    /**
     * Setup resource metrics collection
     */
    setupResourceMetricsCollection() {
        this.metrics.set('resources', {
            cpu_utilization: 0,
            memory_utilization: 0,
            network_utilization: 0,
            storage_utilization: 0,
            allocation_efficiency: 0,
            scaling_events: 0
        });

        setInterval(() => {
            this.collectResourceMetrics();
        }, this.config.update_interval);
    }

    /**
     * Start real-time monitoring
     */
    startRealTimeMonitoring() {
        // Update dashboard data
        setInterval(() => {
            this.updateDashboardData();
        }, this.config.dashboard_refresh);

        // Check performance thresholds
        setInterval(() => {
            this.checkPerformanceThresholds();
        }, 5000);

        // Generate performance reports
        setInterval(() => {
            this.generatePerformanceReport();
        }, 300000); // Every 5 minutes

        // Cleanup old data
        setInterval(() => {
            this.cleanupHistoricalData();
        }, 3600000); // Every hour

        console.log('Real-time monitoring started');
    }

    /**
     * Setup event listeners for system events
     */
    setupEventListeners() {
        // Listen to communication bus events
        this.communicationBus.on('message_sent', (event) => {
            this.recordMessageMetric(event);
        });

        this.communicationBus.on('message_delivered', (event) => {
            this.recordDeliveryMetric(event);
        });

        // Listen to resource allocation events
        this.resourceAllocationMatrix.on('resources_allocated', (event) => {
            this.recordResourceAllocation(event);
        });

        // Listen to workflow events
        this.eventProcessor.on('workflow_completed', (event) => {
            this.recordWorkflowCompletion(event);
        });

        this.eventProcessor.on('compliance_violation', (event) => {
            this.recordComplianceViolation(event);
        });
    }

    /**
     * Collect agent performance metrics
     */
    async collectAgentMetrics() {
        for (const [metricKey, metric] of this.metrics.entries()) {
            if (metricKey.startsWith('agent_')) {
                try {
                    // Simulate collecting metrics from agent
                    const agentMetrics = await this.getAgentMetrics(metric.id);
                    
                    // Update metrics
                    Object.assign(metric, {
                        ...agentMetrics,
                        last_updated: new Date(),
                        health_score: this.calculateAgentHealthScore(agentMetrics)
                    });

                    // Store historical data
                    this.storeHistoricalData(`agent_${metric.id}`, agentMetrics);

                } catch (error) {
                    console.error(`Failed to collect metrics for agent ${metric.id}:`, error.message);
                    metric.status = 'error';
                    metric.health_score = 0;
                }
            }
        }

        // Update agent performance map
        this.updateAgentPerformanceMap();
    }

    /**
     * Collect MCP server metrics
     */
    async collectMCPMetrics() {
        for (const [metricKey, metric] of this.metrics.entries()) {
            if (metricKey.startsWith('mcp_')) {
                try {
                    const mcpMetrics = await this.getMCPServerMetrics(metric.id);
                    
                    Object.assign(metric, {
                        ...mcpMetrics,
                        last_updated: new Date(),
                        health_score: this.calculateMCPHealthScore(mcpMetrics)
                    });

                    this.storeHistoricalData(`mcp_${metric.id}`, mcpMetrics);

                } catch (error) {
                    console.error(`Failed to collect MCP metrics for ${metric.id}:`, error.message);
                    metric.status = 'error';
                    metric.health_score = 0;
                }
            }
        }

        this.updateMCPPerformanceMap();
    }

    /**
     * Update dashboard data for real-time display
     */
    async updateDashboardData() {
        for (const [dashboardId, dashboard] of this.dashboards.entries()) {
            const dashboardData = await this.generateDashboardData(dashboard);
            
            // Emit updated data to subscribers
            this.emit('dashboard_update', {
                dashboard_id: dashboardId,
                data: dashboardData,
                timestamp: new Date()
            });

            // Store for web interface
            this.storeDataForWebInterface(dashboardId, dashboardData);
        }
    }

    /**
     * Generate dashboard data
     */
    async generateDashboardData(dashboard) {
        const data = {
            dashboard_id: dashboard.id,
            widgets: {},
            last_updated: new Date()
        };

        for (const widget of dashboard.widgets) {
            try {
                const widgetData = await this.generateWidgetData(widget);
                data.widgets[widget.id] = widgetData;
            } catch (error) {
                console.error(`Failed to generate data for widget ${widget.id}:`, error.message);
                data.widgets[widget.id] = { error: error.message };
            }
        }

        return data;
    }

    /**
     * Generate data for individual widget
     */
    async generateWidgetData(widget) {
        const currentTime = new Date();
        
        switch (widget.type) {
            case 'gauge':
                return await this.generateGaugeData(widget);
            case 'line_chart':
                return await this.generateLineChartData(widget);
            case 'bar_chart':
                return await this.generateBarChartData(widget);
            case 'heatmap':
                return await this.generateHeatmapData(widget);
            case 'status_table':
                return await this.generateStatusTableData(widget);
            case 'kpi_panel':
                return await this.generateKPIData(widget);
            default:
                return { type: widget.type, data: [], timestamp: currentTime };
        }
    }

    /**
     * Generate gauge widget data
     */
    async generateGaugeData(widget) {
        const value = await this.getMetricValue(widget.data_source);
        
        return {
            type: 'gauge',
            value: value,
            thresholds: widget.thresholds,
            status: this.getThresholdStatus(value, widget.thresholds),
            timestamp: new Date()
        };
    }

    /**
     * Generate line chart widget data
     */
    async generateLineChartData(widget) {
        const timeWindow = widget.time_window || 3600000; // 1 hour default
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - timeWindow);
        
        const series = [];
        
        for (const dataSource of widget.data_sources) {
            const data = await this.getTimeSeriesData(dataSource, startTime, endTime);
            series.push({
                name: dataSource,
                data: data
            });
        }

        return {
            type: 'line_chart',
            series: series,
            time_range: { start: startTime, end: endTime },
            timestamp: new Date()
        };
    }

    /**
     * Generate KPI panel data
     */
    async generateKPIData(widget) {
        const kpis = [];
        
        for (const metric of widget.metrics) {
            const value = await this.getMetricValue(metric.data_source);
            kpis.push({
                name: metric.name,
                value: value,
                format: metric.format,
                trend: await this.getTrend(metric.data_source),
                status: this.getKPIStatus(value, metric)
            });
        }

        return {
            type: 'kpi_panel',
            kpis: kpis,
            timestamp: new Date()
        };
    }

    /**
     * Check performance thresholds and trigger alerts
     */
    checkPerformanceThresholds() {
        const currentMetrics = this.getCurrentMetrics();
        
        // Check CPU utilization
        if (currentMetrics.cpu_utilization > this.config.alert_thresholds.cpu_utilization) {
            this.triggerAlert('cpu_high', {
                current_value: currentMetrics.cpu_utilization,
                threshold: this.config.alert_thresholds.cpu_utilization,
                severity: 'warning'
            });
        }

        // Check memory utilization
        if (currentMetrics.memory_utilization > this.config.alert_thresholds.memory_utilization) {
            this.triggerAlert('memory_high', {
                current_value: currentMetrics.memory_utilization,
                threshold: this.config.alert_thresholds.memory_utilization,
                severity: 'warning'
            });
        }

        // Check response times
        const avgResponseTime = this.calculateAverageResponseTime();
        if (avgResponseTime > this.config.alert_thresholds.response_time) {
            this.triggerAlert('response_time_high', {
                current_value: avgResponseTime,
                threshold: this.config.alert_thresholds.response_time,
                severity: 'critical'
            });
        }

        // Check error rates
        const errorRate = this.calculateErrorRate();
        if (errorRate > this.config.alert_thresholds.error_rate) {
            this.triggerAlert('error_rate_high', {
                current_value: errorRate,
                threshold: this.config.alert_thresholds.error_rate,
                severity: 'critical'
            });
        }
    }

    /**
     * Trigger performance alert
     */
    triggerAlert(alertType, data) {
        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            type: alertType,
            severity: data.severity,
            message: this.generateAlertMessage(alertType, data),
            data: data,
            timestamp: new Date(),
            acknowledged: false,
            resolved: false
        };

        this.alerts.set(alert.id, alert);
        
        this.emit('performance_alert', alert);
        
        // Send to alert manager
        this.alertManager.processAlert(alert);
        
        console.warn(`Performance alert triggered: ${alert.message}`);
    }

    /**
     * Helper methods for data collection and processing
     */
    async getAgentMetrics(agentId) {
        // Simulate agent metrics collection
        return {
            status: 'active',
            response_time: Math.random() * 1000 + 100,
            success_rate: 0.95 + Math.random() * 0.05,
            error_rate: Math.random() * 0.02,
            cpu_usage: Math.random() * 80,
            memory_usage: Math.random() * 70,
            active_tasks: Math.floor(Math.random() * 10),
            total_tasks: Math.floor(Math.random() * 100) + 50
        };
    }

    async getMCPServerMetrics(serverId) {
        // Simulate MCP server metrics collection
        return {
            status: 'running',
            response_time: Math.random() * 500 + 50,
            success_rate: 0.98 + Math.random() * 0.02,
            active_connections: Math.floor(Math.random() * 20),
            requests_per_second: Math.random() * 100,
            error_rate: Math.random() * 0.01,
            cost_per_request: Math.random() * 0.01,
            total_cost: Math.random() * 100
        };
    }

    calculateAgentHealthScore(metrics) {
        const weights = {
            success_rate: 0.3,
            response_time: 0.25,
            error_rate: 0.25,
            resource_usage: 0.2
        };

        const responseTimeScore = Math.max(0, 1 - (metrics.response_time / 5000));
        const errorRateScore = Math.max(0, 1 - (metrics.error_rate / 0.1));
        const resourceScore = Math.max(0, 1 - ((metrics.cpu_usage + metrics.memory_usage) / 200));

        return Math.round((
            metrics.success_rate * weights.success_rate +
            responseTimeScore * weights.response_time +
            errorRateScore * weights.error_rate +
            resourceScore * weights.resource_usage
        ) * 100);
    }

    calculateMCPHealthScore(metrics) {
        const weights = {
            success_rate: 0.4,
            response_time: 0.3,
            error_rate: 0.3
        };

        const responseTimeScore = Math.max(0, 1 - (metrics.response_time / 2000));
        const errorRateScore = Math.max(0, 1 - (metrics.error_rate / 0.05));

        return Math.round((
            metrics.success_rate * weights.success_rate +
            responseTimeScore * weights.response_time +
            errorRateScore * weights.error_rate
        ) * 100);
    }

    async getMetricValue(dataSource) {
        // Simulate getting current metric value
        const baseValue = Math.random() * 100;
        
        switch (dataSource) {
            case 'system_health.overall_score':
                return Math.round(baseValue);
            case 'cpu_utilization':
                return Math.round(baseValue * 0.8);
            case 'memory_utilization':
                return Math.round(baseValue * 0.7);
            case 'compliance_score':
                return Math.round(90 + baseValue * 0.1);
            default:
                return Math.round(baseValue);
        }
    }

    async getTimeSeriesData(dataSource, startTime, endTime) {
        // Simulate time series data generation
        const data = [];
        const interval = 60000; // 1 minute intervals
        
        for (let time = startTime.getTime(); time <= endTime.getTime(); time += interval) {
            data.push({
                timestamp: new Date(time),
                value: Math.random() * 100
            });
        }
        
        return data;
    }

    storeHistoricalData(key, data) {
        if (!this.historicalData.has(key)) {
            this.historicalData.set(key, []);
        }
        
        const history = this.historicalData.get(key);
        history.push({
            ...data,
            timestamp: new Date()
        });
        
        // Keep only last 24 hours
        const cutoff = Date.now() - this.config.data_retention;
        this.historicalData.set(key, history.filter(item => item.timestamp.getTime() > cutoff));
    }

    getCurrentMetrics() {
        const resourceMetrics = this.metrics.get('resources') || {};
        return {
            cpu_utilization: resourceMetrics.cpu_utilization || 0,
            memory_utilization: resourceMetrics.memory_utilization || 0,
            network_utilization: resourceMetrics.network_utilization || 0
        };
    }

    calculateAverageResponseTime() {
        let totalTime = 0;
        let count = 0;
        
        for (const [key, metric] of this.metrics.entries()) {
            if (key.startsWith('agent_') && metric.response_time) {
                totalTime += metric.response_time;
                count++;
            }
        }
        
        return count > 0 ? totalTime / count : 0;
    }

    calculateErrorRate() {
        let totalErrors = 0;
        let totalRequests = 0;
        
        for (const [key, metric] of this.metrics.entries()) {
            if (key.startsWith('agent_') && metric.error_rate !== undefined) {
                totalErrors += metric.error_rate * metric.total_tasks;
                totalRequests += metric.total_tasks;
            }
        }
        
        return totalRequests > 0 ? totalErrors / totalRequests : 0;
    }

    generateAlertMessage(alertType, data) {
        const messages = {
            cpu_high: `CPU utilization is ${data.current_value}%, exceeding threshold of ${data.threshold}%`,
            memory_high: `Memory utilization is ${data.current_value}%, exceeding threshold of ${data.threshold}%`,
            response_time_high: `Average response time is ${data.current_value}ms, exceeding threshold of ${data.threshold}ms`,
            error_rate_high: `Error rate is ${(data.current_value * 100).toFixed(2)}%, exceeding threshold of ${(data.threshold * 100).toFixed(2)}%`
        };
        
        return messages[alertType] || `Performance alert: ${alertType}`;
    }

    /**
     * Get dashboard data for web interface
     */
    getDashboardData(dashboardId) {
        if (!this.dashboards.has(dashboardId)) {
            throw new Error(`Dashboard ${dashboardId} not found`);
        }
        
        return this.generateDashboardData(this.dashboards.get(dashboardId));
    }

    /**
     * Get available dashboards
     */
    getAvailableDashboards() {
        return Array.from(this.dashboards.values()).map(dashboard => ({
            id: dashboard.id,
            name: dashboard.name,
            description: dashboard.description
        }));
    }

    /**
     * Subscribe to dashboard updates
     */
    subscribeToDashboard(dashboardId, callback) {
        if (!this.subscribers.has(dashboardId)) {
            this.subscribers.set(dashboardId, new Set());
        }
        
        this.subscribers.get(dashboardId).add(callback);
        
        // Send initial data
        this.getDashboardData(dashboardId).then(data => {
            callback(data);
        });
    }

    /**
     * Get performance summary
     */
    getPerformanceSummary() {
        return {
            system_health: this.performanceMetrics.system_health,
            active_alerts: this.alerts.size,
            agent_count: Array.from(this.metrics.keys()).filter(k => k.startsWith('agent_')).length,
            mcp_servers: Array.from(this.metrics.keys()).filter(k => k.startsWith('mcp_')).length,
            last_updated: new Date()
        };
    }

    // Placeholder methods for missing functionality
    async collectWorkflowMetrics() {
        // Implementation for workflow metrics collection
    }

    async collectResourceMetrics() {
        // Implementation for resource metrics collection
    }

    setupComplianceMetricsCollection() {
        // Implementation for compliance metrics setup
    }

    setupFinancialMetricsCollection() {
        // Implementation for financial metrics setup
    }

    updateAgentPerformanceMap() {
        // Implementation for updating agent performance
    }

    updateMCPPerformanceMap() {
        // Implementation for updating MCP performance
    }

    recordMessageMetric(event) {
        // Implementation for recording message metrics
    }

    recordDeliveryMetric(event) {
        // Implementation for recording delivery metrics
    }

    recordResourceAllocation(event) {
        // Implementation for recording resource allocation
    }

    recordWorkflowCompletion(event) {
        // Implementation for recording workflow completion
    }

    recordComplianceViolation(event) {
        // Implementation for recording compliance violations
    }

    generatePerformanceReport() {
        // Implementation for generating performance reports
    }

    cleanupHistoricalData() {
        // Implementation for cleaning up old historical data
    }

    storeDataForWebInterface(dashboardId, data) {
        // Implementation for storing data for web interface
    }

    async generateBarChartData(widget) {
        // Implementation for bar chart data generation
        return { type: 'bar_chart', data: [], timestamp: new Date() };
    }

    async generateHeatmapData(widget) {
        // Implementation for heatmap data generation
        return { type: 'heatmap', data: [], timestamp: new Date() };
    }

    async generateStatusTableData(widget) {
        // Implementation for status table data generation
        return { type: 'status_table', data: [], timestamp: new Date() };
    }

    getThresholdStatus(value, thresholds) {
        if (value >= thresholds.good) return 'good';
        if (value >= thresholds.warning) return 'warning';
        return 'critical';
    }

    async getTrend(dataSource) {
        // Implementation for trend calculation
        return 'stable';
    }

    getKPIStatus(value, metric) {
        // Implementation for KPI status determination
        return 'normal';
    }
}

/**
 * Metrics Collector - Centralized metrics collection
 */
class MetricsCollector {
    async initialize() {
        console.log('Metrics Collector initialized');
    }
}

/**
 * Dashboard Engine - Core dashboard rendering
 */
class DashboardEngine {
    async initialize() {
        console.log('Dashboard Engine initialized');
    }
}

/**
 * Performance Alert Manager - Alert processing and routing
 */
class PerformanceAlertManager {
    async initialize() {
        console.log('Performance Alert Manager initialized');
    }
    
    processAlert(alert) {
        console.log(`Processing alert: ${alert.message}`);
    }
}

/**
 * Real-Time Analytics Engine - Advanced analytics
 */
class RealTimeAnalyticsEngine {
    async initialize() {
        console.log('Real-Time Analytics Engine initialized');
    }
}

/**
 * Visualization Engine - Chart and graph generation
 */
class VisualizationEngine {
    async initialize() {
        console.log('Visualization Engine initialized');
    }
}

/**
 * Performance Report Generator - Automated reporting
 */
class PerformanceReportGenerator {
    async initialize() {
        console.log('Performance Report Generator initialized');
    }
}

module.exports = {
    PerformanceMonitoringDashboard,
    MetricsCollector,
    DashboardEngine,
    PerformanceAlertManager,
    RealTimeAnalyticsEngine,
    VisualizationEngine,
    PerformanceReportGenerator
};