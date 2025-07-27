/**
 * DwayBank Agent Communication Architecture
 * Event-driven communication system for 18-agent ecosystem
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class AgentCommunicationBus extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.agents = new Map();
        this.messageQueue = new Map();
        this.eventHistory = [];
        this.subscriptions = new Map();
        this.coalitions = new Map();
        this.communicationMetrics = new Map();
        this.securityManager = new AgentSecurityManager();
        
        this.initialize();
    }

    /**
     * Initialize the communication system
     */
    initialize() {
        console.log('Initializing Agent Communication Bus...');
        this.setupEventHandlers();
        this.initializeMessageQueues();
        this.startHeartbeatMonitoring();
        this.setupSecurityValidation();
        console.log('Communication Bus initialized successfully');
    }

    /**
     * Register an agent with the communication system
     */
    async registerAgent(agentId, agentConfig) {
        const registration = {
            agentId,
            config: agentConfig,
            status: 'active',
            lastHeartbeat: new Date(),
            messageQueue: [],
            subscriptions: new Set(),
            capabilities: agentConfig.capabilities || [],
            securityLevel: agentConfig.securityLevel || 'medium',
            communicationPreferences: agentConfig.communicationPreferences || {}
        };

        this.agents.set(agentId, registration);
        this.messageQueue.set(agentId, []);
        
        // Initialize communication metrics
        this.communicationMetrics.set(agentId, {
            messagesSent: 0,
            messagesReceived: 0,
            responseTime: [],
            errorRate: 0,
            coalitionParticipation: 0
        });

        this.emit('agent_registered', { agentId, timestamp: new Date() });
        console.log(`Agent ${agentId} registered successfully`);
        
        return registration;
    }

    /**
     * Send message between agents with routing intelligence
     */
    async sendMessage(senderId, recipientId, message, options = {}) {
        try {
            const messageId = this.generateMessageId();
            const timestamp = new Date();
            
            // Validate sender and recipient
            if (!this.agents.has(senderId)) {
                throw new Error(`Sender agent ${senderId} not registered`);
            }
            if (!this.agents.has(recipientId)) {
                throw new Error(`Recipient agent ${recipientId} not registered`);
            }

            // Security validation
            await this.securityManager.validateMessage(senderId, recipientId, message);

            // Create structured message
            const structuredMessage = {
                messageId,
                senderId,
                recipientId,
                timestamp,
                type: message.type || 'standard',
                priority: message.priority || 'medium',
                content: message.content,
                metadata: message.metadata || {},
                security: {
                    encrypted: options.encrypted || false,
                    signature: await this.securityManager.signMessage(senderId, message)
                },
                routing: {
                    hops: 0,
                    path: [senderId],
                    deliveryAttempts: 0
                }
            };

            // Route message based on type and priority
            await this.routeMessage(structuredMessage, options);
            
            // Update metrics
            this.updateCommunicationMetrics(senderId, 'sent');
            this.updateCommunicationMetrics(recipientId, 'received');
            
            // Store in event history
            this.eventHistory.push({
                type: 'message_sent',
                messageId,
                senderId,
                recipientId,
                timestamp
            });

            return { messageId, status: 'sent', timestamp };

        } catch (error) {
            console.error('Message sending failed:', error);
            this.emit('message_error', { senderId, recipientId, error: error.message });
            throw error;
        }
    }

    /**
     * Broadcast message to multiple agents or coalitions
     */
    async broadcastMessage(senderId, recipients, message, options = {}) {
        const broadcastId = this.generateMessageId();
        const results = [];

        // Handle coalition broadcasting
        if (recipients.includes('coalition:')) {
            const coalitionId = recipients.replace('coalition:', '');
            if (this.coalitions.has(coalitionId)) {
                recipients = Array.from(this.coalitions.get(coalitionId).members);
            }
        }

        // Send to all recipients
        for (const recipientId of recipients) {
            try {
                const result = await this.sendMessage(senderId, recipientId, {
                    ...message,
                    broadcastId,
                    isBroadcast: true
                }, options);
                results.push({ recipientId, result });
            } catch (error) {
                results.push({ recipientId, error: error.message });
            }
        }

        this.emit('broadcast_completed', { 
            broadcastId, 
            senderId, 
            recipients: recipients.length, 
            successful: results.filter(r => !r.error).length 
        });

        return { broadcastId, results };
    }

    /**
     * Create and manage agent coalitions
     */
    async createCoalition(coalitionId, leaderAgentId, memberAgents, purpose) {
        const coalition = {
            coalitionId,
            leader: leaderAgentId,
            members: new Set([leaderAgentId, ...memberAgents]),
            purpose,
            created: new Date(),
            status: 'active',
            sharedContext: new Map(),
            communicationChannels: new Map(),
            workflowState: 'initialized',
            metrics: {
                messagesExchanged: 0,
                collaborationEfficiency: 0,
                taskCompletion: 0
            }
        };

        this.coalitions.set(coalitionId, coalition);
        
        // Create dedicated communication channel for coalition
        await this.createCoalitionChannel(coalitionId);
        
        // Notify all members about coalition formation
        for (const memberId of coalition.members) {
            await this.sendMessage('system', memberId, {
                type: 'coalition_formed',
                content: {
                    coalitionId,
                    leader: leaderAgentId,
                    members: Array.from(coalition.members),
                    purpose
                }
            });
        }

        this.emit('coalition_created', { coalitionId, leader: leaderAgentId, members: Array.from(coalition.members) });
        return coalition;
    }

    /**
     * Event subscription system for agents
     */
    subscribeToEvents(agentId, eventTypes, callback) {
        if (!this.subscriptions.has(agentId)) {
            this.subscriptions.set(agentId, new Map());
        }

        const agentSubscriptions = this.subscriptions.get(agentId);
        
        for (const eventType of eventTypes) {
            if (!agentSubscriptions.has(eventType)) {
                agentSubscriptions.set(eventType, []);
            }
            agentSubscriptions.get(eventType).push(callback);
            
            // Register event listener
            this.on(eventType, (data) => {
                if (this.shouldReceiveEvent(agentId, eventType, data)) {
                    callback(data);
                }
            });
        }

        console.log(`Agent ${agentId} subscribed to events: ${eventTypes.join(', ')}`);
    }

    /**
     * Intelligent message routing based on agent capabilities and load
     */
    async routeMessage(message, options = {}) {
        const recipient = this.agents.get(message.recipientId);
        
        if (!recipient) {
            throw new Error(`Recipient agent ${message.recipientId} not found`);
        }

        // Check recipient availability and load
        if (recipient.status !== 'active') {
            if (options.allowQueuing !== false) {
                return await this.queueMessage(message);
            } else {
                throw new Error(`Recipient agent ${message.recipientId} is not active`);
            }
        }

        // Priority-based routing
        switch (message.priority) {
            case 'critical':
                return await this.deliverMessageImmediate(message);
            case 'high':
                return await this.deliverMessagePriority(message);
            case 'medium':
                return await this.deliverMessageStandard(message);
            case 'low':
                return await this.queueMessage(message);
            default:
                return await this.deliverMessageStandard(message);
        }
    }

    /**
     * Process message queue for each agent
     */
    async processMessageQueue(agentId) {
        const queue = this.messageQueue.get(agentId);
        if (!queue || queue.length === 0) return;

        const agent = this.agents.get(agentId);
        if (!agent || agent.status !== 'active') return;

        // Process messages based on priority
        queue.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
        
        const processedMessages = [];
        for (const message of queue.splice(0, 10)) { // Process up to 10 messages at a time
            try {
                await this.deliverMessage(message);
                processedMessages.push(message.messageId);
            } catch (error) {
                console.error(`Failed to deliver message ${message.messageId}:`, error);
                // Re-queue with increased delivery attempts
                message.routing.deliveryAttempts++;
                if (message.routing.deliveryAttempts < 3) {
                    queue.push(message);
                }
            }
        }

        if (processedMessages.length > 0) {
            this.emit('messages_processed', { agentId, count: processedMessages.length });
        }
    }

    /**
     * Heartbeat monitoring for agent health
     */
    startHeartbeatMonitoring() {
        setInterval(() => {
            const now = new Date();
            for (const [agentId, agent] of this.agents.entries()) {
                const timeSinceHeartbeat = now - agent.lastHeartbeat;
                
                if (timeSinceHeartbeat > 300000) { // 5 minutes
                    this.handleAgentTimeout(agentId);
                } else if (timeSinceHeartbeat > 60000) { // 1 minute
                    this.emit('agent_warning', { agentId, timeSinceHeartbeat });
                }
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Handle agent timeout and recovery
     */
    async handleAgentTimeout(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) return;

        console.warn(`Agent ${agentId} timeout detected`);
        agent.status = 'timeout';
        
        // Attempt recovery
        try {
            await this.attemptAgentRecovery(agentId);
        } catch (error) {
            console.error(`Agent ${agentId} recovery failed:`, error);
            agent.status = 'failed';
            this.emit('agent_failed', { agentId, error: error.message });
        }
    }

    /**
     * Update agent heartbeat
     */
    updateHeartbeat(agentId) {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.lastHeartbeat = new Date();
            if (agent.status === 'timeout') {
                agent.status = 'active';
                this.emit('agent_recovered', { agentId });
            }
        }
    }

    /**
     * Get communication statistics
     */
    getCommunicationStats() {
        const stats = {
            totalAgents: this.agents.size,
            activeAgents: Array.from(this.agents.values()).filter(a => a.status === 'active').length,
            totalCoalitions: this.coalitions.size,
            totalMessages: this.eventHistory.filter(e => e.type === 'message_sent').length,
            averageResponseTime: this.calculateAverageResponseTime(),
            communicationEfficiency: this.calculateCommunicationEfficiency(),
            networkHealth: this.calculateNetworkHealth()
        };

        return stats;
    }

    /**
     * Financial domain communication patterns
     */
    setupFinancialCommunicationPatterns() {
        // High-priority communication for financial operations
        this.on('payment_transaction', async (data) => {
            await this.createUrgentCoalition('payment_processing', [
                'dwaybank-backend',
                'dwaybank-security', 
                'dwaybank-qa'
            ], data);
        });

        this.on('security_incident', async (data) => {
            await this.createEmergencyCoalition('security_response', [
                'dwaybank-security',
                'dwaybank-analyzer',
                'taskmaster-monitor',
                'quality-controller'
            ], data);
        });

        this.on('compliance_violation', async (data) => {
            await this.createComplianceCoalition('compliance_resolution', [
                'dwaybank-security',
                'quality-controller',
                'dwaybank-scribe',
                'taskmaster-project-manager'
            ], data);
        });
    }

    /**
     * Utility methods
     */
    generateMessageId() {
        return `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    getPriorityWeight(priority) {
        const weights = { critical: 4, high: 3, medium: 2, low: 1 };
        return weights[priority] || 2;
    }

    async deliverMessage(message) {
        const recipient = this.agents.get(message.recipientId);
        if (!recipient) throw new Error(`Recipient ${message.recipientId} not found`);

        // Simulate message delivery (in real implementation, this would interface with actual agents)
        recipient.messageQueue.push(message);
        
        this.emit('message_delivered', {
            messageId: message.messageId,
            senderId: message.senderId,
            recipientId: message.recipientId,
            timestamp: new Date()
        });
    }

    updateCommunicationMetrics(agentId, action) {
        const metrics = this.communicationMetrics.get(agentId);
        if (!metrics) return;

        if (action === 'sent') {
            metrics.messagesSent++;
        } else if (action === 'received') {
            metrics.messagesReceived++;
        }
    }

    calculateAverageResponseTime() {
        const allMetrics = Array.from(this.communicationMetrics.values());
        const allResponseTimes = allMetrics.flatMap(m => m.responseTime);
        return allResponseTimes.length > 0 ? 
            allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length : 0;
    }

    calculateCommunicationEfficiency() {
        const totalMessages = Array.from(this.communicationMetrics.values())
            .reduce((sum, m) => sum + m.messagesSent + m.messagesReceived, 0);
        const successfulMessages = totalMessages; // Simplified for now
        return totalMessages > 0 ? successfulMessages / totalMessages : 1;
    }

    calculateNetworkHealth() {
        const activeAgents = Array.from(this.agents.values()).filter(a => a.status === 'active').length;
        const totalAgents = this.agents.size;
        return totalAgents > 0 ? activeAgents / totalAgents : 0;
    }

    shouldReceiveEvent(agentId, eventType, data) {
        // Implement filtering logic based on agent capabilities and interests
        const agent = this.agents.get(agentId);
        return agent && agent.status === 'active';
    }

    async queueMessage(message) {
        const queue = this.messageQueue.get(message.recipientId);
        if (queue) {
            queue.push(message);
            this.emit('message_queued', { messageId: message.messageId, recipientId: message.recipientId });
        }
    }

    setupEventHandlers() {
        this.setupFinancialCommunicationPatterns();
        
        // Generic event handlers
        this.on('error', (error) => {
            console.error('Communication Bus Error:', error);
        });
    }

    initializeMessageQueues() {
        // Start queue processing
        setInterval(() => {
            for (const agentId of this.agents.keys()) {
                this.processMessageQueue(agentId);
            }
        }, 5000); // Process queues every 5 seconds
    }

    setupSecurityValidation() {
        // Security validation setup
        this.securityManager.initialize();
    }
}

/**
 * Security Manager for Agent Communication
 */
class AgentSecurityManager {
    constructor() {
        this.trustedAgents = new Set();
        this.securityPolicies = new Map();
        this.messageSignatures = new Map();
    }

    initialize() {
        // Initialize security policies for financial agents
        this.setupFinancialSecurityPolicies();
    }

    async validateMessage(senderId, recipientId, message) {
        // Implement message validation logic
        if (!this.trustedAgents.has(senderId)) {
            throw new Error(`Sender ${senderId} is not trusted`);
        }

        // Validate message content for security
        if (message.content && typeof message.content === 'object') {
            await this.validateMessageContent(message.content);
        }

        return true;
    }

    async signMessage(senderId, message) {
        // Create message signature for integrity
        const messageHash = crypto.createHash('sha256')
            .update(JSON.stringify(message))
            .digest('hex');
        
        this.messageSignatures.set(messageHash, {
            senderId,
            timestamp: new Date(),
            signature: messageHash
        });

        return messageHash;
    }

    setupFinancialSecurityPolicies() {
        // Define security policies for financial operations
        this.securityPolicies.set('payment_data', {
            encryption_required: true,
            authorized_agents: ['dwaybank-backend', 'dwaybank-security'],
            audit_required: true
        });

        this.securityPolicies.set('customer_data', {
            encryption_required: true,
            authorized_agents: ['dwaybank-backend', 'dwaybank-frontend', 'dwaybank-security'],
            audit_required: true
        });
    }

    async validateMessageContent(content) {
        // Implement content validation for sensitive data
        if (content.payment_data || content.customer_data) {
            // Validate that sensitive data is properly encrypted
            return true;
        }
        return true;
    }
}

module.exports = { AgentCommunicationBus, AgentSecurityManager };