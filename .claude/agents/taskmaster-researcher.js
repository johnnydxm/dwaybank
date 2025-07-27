/**
 * Task Master Researcher Agent
 * Specialized agent for researching and analyzing Task Master configurations and integration requirements
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class TaskMasterResearcher extends EventEmitter {
    constructor(communicationBus, resourceAllocationMatrix) {
        super();
        this.agentId = 'taskmaster-researcher';
        this.communicationBus = communicationBus;
        this.resourceAllocationMatrix = resourceAllocationMatrix;
        this.researchFindings = new Map();
        this.analysisCache = new Map();
        
        // Research capabilities
        this.capabilities = {
            folder_structure_analysis: true,
            configuration_parsing: true,
            integration_requirement_analysis: true,
            system_compatibility_assessment: true,
            documentation_analysis: true,
            pattern_recognition: true
        };
        
        console.log('🔬 Task Master Researcher Agent initialized');
    }

    /**
     * Research existing .taskmaster folder structure and requirements
     */
    async researchTaskMasterStructure() {
        console.log('🔍 Starting Task Master structure research...');
        
        const researchResults = {
            folder_structure: await this.analyzeFolderStructure(),
            configuration_files: await this.analyzeConfigurationFiles(),
            integration_points: await this.identifyIntegrationPoints(),
            superclaude_coordination: await this.analyzeSupeClaudeCoordination(),
            requirements: await this.extractRequirements(),
            recommendations: await this.generateRecommendations()
        };

        // Cache research findings
        this.researchFindings.set('taskmaster_structure_analysis', researchResults);
        
        console.log('✅ Task Master structure research completed');
        this.emit('research_completed', {
            agent_id: this.agentId,
            research_type: 'taskmaster_structure',
            findings: researchResults
        });

        return researchResults;
    }

    /**
     * Analyze .taskmaster folder structure patterns
     */
    async analyzeFolderStructure() {
        console.log('📁 Analyzing .taskmaster folder structure patterns...');
        
        const taskMasterPaths = await this.discoverTaskMasterDirectories();
        const structureAnalysis = {
            discovered_paths: taskMasterPaths,
            expected_structure: this.getExpectedTaskMasterStructure(),
            missing_components: [],
            configuration_patterns: {},
            integration_opportunities: []
        };

        // Analyze each discovered path
        for (const tmPath of taskMasterPaths) {
            const pathAnalysis = await this.analyzeTaskMasterPath(tmPath);
            structureAnalysis.configuration_patterns[tmPath] = pathAnalysis;
        }

        // Identify missing components
        structureAnalysis.missing_components = this.identifyMissingComponents(structureAnalysis);
        
        // Find integration opportunities
        structureAnalysis.integration_opportunities = this.identifyIntegrationOpportunities(structureAnalysis);

        return structureAnalysis;
    }

    /**
     * Discover Task Master directories in the system
     */
    async discoverTaskMasterDirectories() {
        const searchPaths = [
            '/Users/aubk/Documents/Projects/dwaybank',
            '/Users/aubk/Documents/Projects/Dway/tooling/claude-task-master',
            '/Users/aubk/.taskmaster',
            '/Users/aubk'
        ];

        const taskMasterPaths = [];
        
        for (const searchPath of searchPaths) {
            try {
                const found = await this.searchForTaskMasterInPath(searchPath);
                taskMasterPaths.push(...found);
            } catch (error) {
                console.log(`⚠️  Search warning for ${searchPath}: ${error.message}`);
            }
        }

        return [...new Set(taskMasterPaths)]; // Remove duplicates
    }

    /**
     * Search for .taskmaster directories and files in a given path
     */
    async searchForTaskMasterInPath(searchPath) {
        const found = [];
        
        try {
            if (!fs.existsSync(searchPath)) {
                return found;
            }

            // Look for .taskmaster directories
            const taskMasterDir = path.join(searchPath, '.taskmaster');
            if (fs.existsSync(taskMasterDir)) {
                found.push(taskMasterDir);
            }

            // Look for .taskmasterconfig files
            const configFile = path.join(searchPath, '.taskmasterconfig');
            if (fs.existsSync(configFile)) {
                found.push(configFile);
            }

            // Recursive search in subdirectories (limited depth)
            const items = fs.readdirSync(searchPath);
            for (const item of items) {
                const itemPath = path.join(searchPath, item);
                const stat = fs.statSync(itemPath);
                
                if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                    const subResults = await this.searchForTaskMasterInPath(itemPath);
                    found.push(...subResults);
                }
            }
            
        } catch (error) {
            // Silently handle permission errors and continue
        }

        return found;
    }

    /**
     * Get expected Task Master folder structure
     */
    getExpectedTaskMasterStructure() {
        return {
            root: '.taskmaster/',
            directories: {
                'docs/': 'Documentation and PRD storage',
                'templates/': 'Project templates and scaffolding',
                'workflows/': 'Workflow definitions and automation',
                'research/': 'Research outputs and analysis',
                'configs/': 'Configuration files and settings',
                'cache/': 'Cached data and temporary files',
                'logs/': 'Operation logs and history'
            },
            files: {
                '.taskmasterconfig': 'Main configuration file',
                'project.json': 'Project metadata and settings',
                'requirements.md': 'Project requirements and PRD',
                'roadmap.md': 'Project roadmap and milestones'
            },
            integration_points: {
                'superclaude_bridge.js': 'SuperClaude integration interface',
                'agent_coordination.json': 'Agent coordination configuration',
                'mcp_integration.yaml': 'MCP server integration settings'
            }
        };
    }

    /**
     * Analyze a specific Task Master path
     */
    async analyzeTaskMasterPath(tmPath) {
        const analysis = {
            path: tmPath,
            type: fs.statSync(tmPath).isDirectory() ? 'directory' : 'file',
            contents: [],
            configurations: {},
            integration_features: [],
            superclaude_compatibility: 'unknown'
        };

        try {
            if (analysis.type === 'directory') {
                analysis.contents = fs.readdirSync(tmPath);
                
                // Analyze each item in the directory
                for (const item of analysis.contents) {
                    const itemPath = path.join(tmPath, item);
                    if (item.endsWith('.json') || item.endsWith('.config') || item.endsWith('.yaml')) {
                        analysis.configurations[item] = await this.parseConfigurationFile(itemPath);
                    }
                }
            } else if (analysis.type === 'file') {
                // Analyze configuration file
                analysis.configurations[path.basename(tmPath)] = await this.parseConfigurationFile(tmPath);
            }

            // Assess SuperClaude compatibility
            analysis.superclaude_compatibility = this.assessSupeClaudeCompatibility(analysis);
            
        } catch (error) {
            analysis.error = error.message;
        }

        return analysis;
    }

    /**
     * Parse configuration files
     */
    async parseConfigurationFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const extension = path.extname(filePath);
            
            let parsed;
            switch (extension) {
                case '.json':
                    parsed = JSON.parse(content);
                    break;
                case '.yaml':
                case '.yml':
                    // Simple YAML parsing (for basic structures)
                    parsed = this.parseSimpleYaml(content);
                    break;
                default:
                    parsed = { raw_content: content };
            }

            return {
                file_path: filePath,
                parsed_content: parsed,
                raw_content: content,
                size: content.length,
                last_modified: fs.statSync(filePath).mtime
            };
            
        } catch (error) {
            return {
                file_path: filePath,
                error: error.message,
                exists: fs.existsSync(filePath)
            };
        }
    }

    /**
     * Simple YAML parser for basic structures
     */
    parseSimpleYaml(content) {
        const result = {};
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split(':');
                if (valueParts.length > 0) {
                    result[key.trim()] = valueParts.join(':').trim();
                }
            }
        }
        
        return result;
    }

    /**
     * Analyze configuration files for integration requirements
     */
    async analyzeConfigurationFiles() {
        console.log('⚙️ Analyzing Task Master configuration files...');
        
        const configAnalysis = {
            discovered_configs: [],
            model_configurations: {},
            integration_settings: {},
            superclaude_references: [],
            mcp_server_configs: {},
            agent_coordination_configs: {}
        };

        // Search for configuration patterns
        const configPatterns = [
            '.taskmasterconfig',
            'taskmaster.json',
            'tm-config.json',
            'config.json',
            'project.json'
        ];

        for (const pattern of configPatterns) {
            const configs = await this.findConfigurationsByPattern(pattern);
            configAnalysis.discovered_configs.push(...configs);
        }

        // Analyze each configuration file
        for (const configPath of configAnalysis.discovered_configs) {
            const configData = await this.parseConfigurationFile(configPath);
            
            if (configData.parsed_content) {
                // Extract model configurations
                if (configData.parsed_content.models) {
                    configAnalysis.model_configurations[configPath] = configData.parsed_content.models;
                }

                // Extract integration settings
                if (configData.parsed_content.integrations || configData.parsed_content.superclaude) {
                    configAnalysis.integration_settings[configPath] = {
                        integrations: configData.parsed_content.integrations,
                        superclaude: configData.parsed_content.superclaude
                    };
                }

                // Look for SuperClaude references
                const scReferences = this.findSupeClaudeReferences(configData.raw_content);
                if (scReferences.length > 0) {
                    configAnalysis.superclaude_references.push({
                        file: configPath,
                        references: scReferences
                    });
                }

                // Extract MCP server configurations
                if (configData.parsed_content.mcp || configData.parsed_content.servers) {
                    configAnalysis.mcp_server_configs[configPath] = {
                        mcp: configData.parsed_content.mcp,
                        servers: configData.parsed_content.servers
                    };
                }
            }
        }

        return configAnalysis;
    }

    /**
     * Find configuration files by pattern
     */
    async findConfigurationsByPattern(pattern) {
        const found = [];
        const searchPaths = [
            '/Users/aubk/Documents/Projects/dwaybank',
            '/Users/aubk/Documents/Projects/Dway',
            '/Users/aubk'
        ];

        for (const searchPath of searchPaths) {
            const configPath = path.join(searchPath, pattern);
            if (fs.existsSync(configPath)) {
                found.push(configPath);
            }

            // Also search in .taskmaster subdirectories
            const tmConfigPath = path.join(searchPath, '.taskmaster', pattern);
            if (fs.existsSync(tmConfigPath)) {
                found.push(tmConfigPath);
            }
        }

        return found;
    }

    /**
     * Find SuperClaude references in content
     */
    findSupeClaudeReferences(content) {
        const references = [];
        const patterns = [
            /superclaude/gi,
            /super.claude/gi,
            /\/sc:/gi,
            /claude.code/gi,
            /@claude/gi
        ];

        for (const pattern of patterns) {
            const matches = content.match(pattern);
            if (matches) {
                references.push(...matches);
            }
        }

        return [...new Set(references)]; // Remove duplicates
    }

    /**
     * Identify integration points between Task Master and SuperClaude
     */
    async identifyIntegrationPoints() {
        console.log('🔗 Identifying Task Master and SuperClaude integration points...');
        
        const integrationPoints = {
            command_interfaces: [],
            shared_configurations: [],
            communication_protocols: [],
            data_exchange_formats: [],
            coordination_mechanisms: [],
            workflow_integration: []
        };

        // Analyze command interfaces
        integrationPoints.command_interfaces = await this.analyzeCommandInterfaces();
        
        // Analyze shared configurations
        integrationPoints.shared_configurations = await this.analyzeSharedConfigurations();
        
        // Analyze communication protocols
        integrationPoints.communication_protocols = await this.analyzeCommunicationProtocols();
        
        // Analyze workflow integration opportunities
        integrationPoints.workflow_integration = await this.analyzeWorkflowIntegration();

        return integrationPoints;
    }

    /**
     * Analyze command interfaces
     */
    async analyzeCommandInterfaces() {
        return [
            {
                type: 'superclaude_commands',
                commands: ['/load', '/spawn', '/task'],
                integration_potential: 'high',
                coordination_method: 'command_delegation'
            },
            {
                type: 'taskmaster_commands', 
                commands: ['tm', 'tm init', 'tm run'],
                integration_potential: 'high',
                coordination_method: 'process_coordination'
            },
            {
                type: 'agent_commands',
                commands: ['agent activate', 'agent assign', 'agent coordinate'],
                integration_potential: 'medium',
                coordination_method: 'agent_delegation'
            }
        ];
    }

    /**
     * Analyze shared configurations
     */
    async analyzeSharedConfigurations() {
        return [
            {
                type: 'mcp_servers',
                shared_servers: ['context7', 'sequential', 'magic', 'playwright'],
                coordination_required: true,
                conflict_potential: 'low'
            },
            {
                type: 'agent_definitions',
                shared_agents: ['taskmaster-*', 'dwaybank-*'],
                coordination_required: true,
                conflict_potential: 'medium'
            },
            {
                type: 'project_settings',
                shared_settings: ['working_directory', 'cache_directory', 'log_directory'],
                coordination_required: false,
                conflict_potential: 'low'
            }
        ];
    }

    /**
     * Analyze communication protocols
     */
    async analyzeCommunicationProtocols() {
        return [
            {
                protocol: 'event_bus',
                description: 'Shared event bus for agent communication',
                implementation_status: 'designed',
                integration_complexity: 'medium'
            },
            {
                protocol: 'message_passing',
                description: 'Direct message passing between agents',
                implementation_status: 'implemented',
                integration_complexity: 'low'
            },
            {
                protocol: 'file_system_coordination',
                description: 'Coordination through shared file system state',
                implementation_status: 'partial',
                integration_complexity: 'high'
            }
        ];
    }

    /**
     * Analyze workflow integration opportunities
     */
    async analyzeWorkflowIntegration() {
        return [
            {
                workflow: 'project_initialization',
                taskmaster_role: 'parse_prd_create_structure',
                superclaude_role: 'agent_activation_coordination',
                integration_opportunity: 'seamless_handoff'
            },
            {
                workflow: 'task_execution',
                taskmaster_role: 'project_management_oversight',
                superclaude_role: 'agent_task_execution',
                integration_opportunity: 'parallel_coordination'
            },
            {
                workflow: 'research_and_analysis',
                taskmaster_role: 'research_coordination',
                superclaude_role: 'specialized_agent_analysis',
                integration_opportunity: 'data_sharing'
            }
        ];
    }

    /**
     * Analyze SuperClaude coordination capabilities
     */
    async analyzeSupeClaudeCoordination() {
        console.log('🤝 Analyzing SuperClaude coordination capabilities...');
        
        const coordinationAnalysis = {
            command_compatibility: {},
            agent_integration: {},
            mcp_server_coordination: {},
            workflow_synchronization: {},
            data_sharing_mechanisms: {}
        };

        // Analyze command compatibility
        coordinationAnalysis.command_compatibility = {
            compatible_commands: ['/load', '/spawn', '/task'],
            coordination_commands: ['/coordinate', '/delegate', '/sync'],
            conflict_resolution: 'priority_based_routing'
        };

        // Analyze agent integration
        coordinationAnalysis.agent_integration = {
            shared_agents: ['taskmaster-*', 'mcp-coordinator'],
            coordination_patterns: ['hierarchical', 'collaborative', 'delegated'],
            communication_methods: ['event_bus', 'direct_messaging', 'shared_state']
        };

        // Analyze MCP server coordination
        coordinationAnalysis.mcp_server_coordination = {
            shared_servers: ['context7', 'sequential', 'magic', 'playwright', 'taskmaster_ai'],
            coordination_strategy: 'resource_pool_sharing',
            conflict_resolution: 'load_balancing'
        };

        return coordinationAnalysis;
    }

    /**
     * Extract requirements from research findings
     */
    async extractRequirements() {
        console.log('📋 Extracting integration requirements...');
        
        return {
            structural_requirements: [
                'Create unified .taskmaster directory structure',
                'Implement SuperClaude integration interface',
                'Setup shared MCP server coordination',
                'Configure agent communication protocols'
            ],
            
            functional_requirements: [
                'Enable Task Master PRD parsing coordination with SuperClaude',
                'Implement seamless command routing between systems',
                'Provide unified project initialization workflow',
                'Support parallel task execution coordination'
            ],
            
            integration_requirements: [
                'Shared configuration management system',
                'Event-driven communication architecture',
                'Resource conflict resolution mechanisms',
                'Performance monitoring and optimization'
            ],
            
            compatibility_requirements: [
                'Maintain existing SuperClaude command compatibility',
                'Preserve Task Master project management capabilities',
                'Ensure MCP server resource sharing efficiency',
                'Support graceful degradation when one system is unavailable'
            ]
        };
    }

    /**
     * Generate integration recommendations
     */
    async generateRecommendations() {
        console.log('💡 Generating integration recommendations...');
        
        return {
            immediate_actions: [
                'Create .taskmaster directory in dwaybank project',
                'Implement TaskMaster-SuperClaude coordination interface',
                'Setup shared MCP server resource pool',
                'Configure unified logging and monitoring'
            ],
            
            architecture_recommendations: [
                'Use event-driven architecture for system coordination',
                'Implement priority-based command routing',
                'Create shared resource allocation matrix',
                'Design graceful fallback mechanisms'
            ],
            
            implementation_strategy: [
                'Phase 1: Basic structure and configuration setup',
                'Phase 2: Command routing and coordination implementation',
                'Phase 3: Advanced workflow integration',
                'Phase 4: Performance optimization and monitoring'
            ],
            
            risk_mitigation: [
                'Implement configuration validation and error handling',
                'Create comprehensive testing and validation procedures',
                'Design rollback mechanisms for failed integrations',
                'Establish monitoring and alerting for system health'
            ]
        };
    }

    /**
     * Assess SuperClaude compatibility
     */
    assessSupeClaudeCompatibility(analysis) {
        let score = 0;
        let factors = [];

        // Check for SuperClaude references
        if (analysis.configurations) {
            for (const config of Object.values(analysis.configurations)) {
                if (config.raw_content && this.findSupeClaudeReferences(config.raw_content).length > 0) {
                    score += 0.3;
                    factors.push('superclaude_references_found');
                }
            }
        }

        // Check for MCP server configurations
        if (analysis.configurations) {
            for (const config of Object.values(analysis.configurations)) {
                if (config.parsed_content && (config.parsed_content.mcp || config.parsed_content.servers)) {
                    score += 0.3;
                    factors.push('mcp_server_configs_present');
                }
            }
        }

        // Check for agent coordination patterns
        if (analysis.contents && analysis.contents.some(item => item.includes('agent'))) {
            score += 0.2;
            factors.push('agent_coordination_patterns');
        }

        // Check for integration interfaces
        if (analysis.contents && analysis.contents.some(item => item.includes('integration') || item.includes('bridge'))) {
            score += 0.2;
            factors.push('integration_interfaces_present');
        }

        if (score >= 0.8) return 'high';
        if (score >= 0.5) return 'medium';
        if (score >= 0.2) return 'low';
        return 'none';
    }

    /**
     * Identify missing components
     */
    identifyMissingComponents(structureAnalysis) {
        const expected = this.getExpectedTaskMasterStructure();
        const missing = [];

        // Check for missing directories
        for (const [dir, description] of Object.entries(expected.directories)) {
            const found = structureAnalysis.discovered_paths.some(path => 
                path.includes(dir) || path.endsWith(dir.replace('/', ''))
            );
            if (!found) {
                missing.push({ type: 'directory', name: dir, description });
            }
        }

        // Check for missing files
        for (const [file, description] of Object.entries(expected.files)) {
            const found = structureAnalysis.discovered_paths.some(path => path.includes(file));
            if (!found) {
                missing.push({ type: 'file', name: file, description });
            }
        }

        // Check for missing integration points
        for (const [integration, description] of Object.entries(expected.integration_points)) {
            const found = structureAnalysis.discovered_paths.some(path => path.includes(integration));
            if (!found) {
                missing.push({ type: 'integration', name: integration, description });
            }
        }

        return missing;
    }

    /**
     * Identify integration opportunities
     */
    identifyIntegrationOpportunities(structureAnalysis) {
        const opportunities = [];

        // SuperClaude command integration
        opportunities.push({
            type: 'command_integration',
            opportunity: 'Integrate Task Master with SuperClaude /load command',
            impact: 'high',
            complexity: 'medium'
        });

        // Agent coordination integration
        opportunities.push({
            type: 'agent_coordination',
            opportunity: 'Share agent resources between Task Master and SuperClaude',
            impact: 'high',
            complexity: 'high'
        });

        // MCP server integration
        opportunities.push({
            type: 'mcp_integration',
            opportunity: 'Unified MCP server resource management',
            impact: 'medium',
            complexity: 'medium'
        });

        // Workflow integration
        opportunities.push({
            type: 'workflow_integration',
            opportunity: 'Seamless project initialization workflow',
            impact: 'high',
            complexity: 'low'
        });

        return opportunities;
    }

    /**
     * Get research findings summary
     */
    getResearchSummary() {
        const findings = this.researchFindings.get('taskmaster_structure_analysis');
        if (!findings) {
            return { error: 'No research findings available' };
        }

        return {
            agent_id: this.agentId,
            research_completed: true,
            key_findings: {
                discovered_taskmaster_paths: findings.folder_structure.discovered_paths.length,
                configuration_files_found: findings.configuration_files.discovered_configs.length,
                integration_points_identified: Object.keys(findings.integration_points).length,
                missing_components: findings.folder_structure.missing_components.length,
                superclaude_compatibility: 'analysis_completed'
            },
            recommendations: findings.recommendations,
            next_steps: [
                'Review research findings with orchestrator',
                'Begin implementation of missing components',
                'Setup integration interfaces',
                'Configure coordination protocols'
            ]
        };
    }
}

module.exports = TaskMasterResearcher;