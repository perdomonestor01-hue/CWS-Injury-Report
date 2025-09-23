const Database = require('../models/database');

class AgentManager {
    constructor() {
        this.db = new Database();
        this.activeAgents = new Map();
        this.agentTypes = {
            'rent_collector': {
                name: 'Rent Collection Agent',
                description: 'Manages rent collection, follows up on overdue payments, and escalates issues',
                priority: 'high',
                interval: 24 * 60 * 60 * 1000, // Daily
                capabilities: ['rent_tracking', 'payment_follow_up', 'escalation_management']
            },
            'maintenance_coordinator': {
                name: 'Maintenance Coordination Agent',
                description: 'Schedules preventive maintenance, coordinates repairs, and manages vendor relationships',
                priority: 'medium',
                interval: 12 * 60 * 60 * 1000, // Every 12 hours
                capabilities: ['maintenance_scheduling', 'vendor_coordination', 'emergency_response']
            },
            'tenant_relationship': {
                name: 'Tenant Relationship Agent',
                description: 'Handles tenant inquiries, lease renewals, and satisfaction monitoring',
                priority: 'medium',
                interval: 8 * 60 * 60 * 1000, // Every 8 hours
                capabilities: ['inquiry_handling', 'lease_management', 'satisfaction_tracking']
            },
            'financial_analyst': {
                name: 'Financial Analysis Agent',
                description: 'Monitors property performance, generates insights, and recommends optimizations',
                priority: 'low',
                interval: 7 * 24 * 60 * 60 * 1000, // Weekly
                capabilities: ['performance_analysis', 'roi_optimization', 'market_analysis']
            },
            'compliance_monitor': {
                name: 'Compliance Monitoring Agent',
                description: 'Ensures regulatory compliance, tracks certifications, and manages legal requirements',
                priority: 'high',
                interval: 24 * 60 * 60 * 1000, // Daily
                capabilities: ['regulatory_monitoring', 'certification_tracking', 'legal_compliance']
            },
            'emergency_responder': {
                name: 'Emergency Response Agent',
                description: 'Handles urgent situations, coordinates emergency repairs, and manages crisis situations',
                priority: 'critical',
                interval: 60 * 60 * 1000, // Hourly
                capabilities: ['emergency_detection', 'crisis_management', 'emergency_coordination']
            }
        };
        this.agentMetrics = new Map();
    }

    async initialize() {
        await this.db.connect();
        console.log('🤖 Agent Manager initialized');
        this.initializeAgentMetrics();
    }

    initializeAgentMetrics() {
        Object.keys(this.agentTypes).forEach(agentType => {
            this.agentMetrics.set(agentType, {
                tasksCompleted: 0,
                tasksInProgress: 0,
                successRate: 100,
                averageResponseTime: 0,
                lastActive: null,
                errors: 0
            });
        });
    }

    async deployAgent(agentType, propertyIds = null) {
        if (!this.agentTypes[agentType]) {
            throw new Error(`Unknown agent type: ${agentType}`);
        }

        const agentConfig = this.agentTypes[agentType];
        const agentId = `${agentType}_${Date.now()}`;

        const agent = new PropertyAgent(agentId, agentType, agentConfig, this.db);

        // Set property scope if specified
        if (propertyIds) {
            agent.setPropertyScope(propertyIds);
        }

        await agent.initialize();
        this.activeAgents.set(agentId, agent);

        console.log(`🚀 Deployed ${agentConfig.name} (ID: ${agentId})`);

        // Start agent execution
        agent.start();

        return {
            agentId,
            type: agentType,
            name: agentConfig.name,
            status: 'deployed',
            capabilities: agentConfig.capabilities,
            deployedAt: new Date().toISOString()
        };
    }

    async deployAllAgents() {
        const deployedAgents = [];

        for (const agentType of Object.keys(this.agentTypes)) {
            try {
                const agentInfo = await this.deployAgent(agentType);
                deployedAgents.push(agentInfo);
            } catch (error) {
                console.error(`❌ Failed to deploy ${agentType}:`, error.message);
            }
        }

        console.log(`✅ Deployed ${deployedAgents.length} agents successfully`);
        return deployedAgents;
    }

    async stopAgent(agentId) {
        const agent = this.activeAgents.get(agentId);
        if (agent) {
            await agent.stop();
            this.activeAgents.delete(agentId);
            console.log(`🛑 Stopped agent: ${agentId}`);
            return true;
        }
        return false;
    }

    async stopAllAgents() {
        const stoppedAgents = [];
        for (const [agentId, agent] of this.activeAgents) {
            await agent.stop();
            stoppedAgents.push(agentId);
        }
        this.activeAgents.clear();
        console.log(`🛑 Stopped ${stoppedAgents.length} agents`);
        return stoppedAgents;
    }

    getAgentStatus() {
        const status = {
            totalAgents: this.activeAgents.size,
            agentTypes: Object.keys(this.agentTypes),
            activeAgents: []
        };

        for (const [agentId, agent] of this.activeAgents) {
            status.activeAgents.push({
                agentId,
                type: agent.type,
                name: agent.name,
                status: agent.status,
                tasksInProgress: agent.tasksInProgress,
                uptime: agent.getUptime(),
                lastActivity: agent.lastActivity
            });
        }

        return status;
    }

    getAgentMetrics(agentType = null) {
        if (agentType) {
            return this.agentMetrics.get(agentType) || null;
        }

        const allMetrics = {};
        for (const [type, metrics] of this.agentMetrics) {
            allMetrics[type] = metrics;
        }
        return allMetrics;
    }

    updateAgentMetrics(agentType, updates) {
        const currentMetrics = this.agentMetrics.get(agentType);
        if (currentMetrics) {
            this.agentMetrics.set(agentType, { ...currentMetrics, ...updates });
        }
    }

    async handleAgentTask(agentId, taskType, taskData) {
        const agent = this.activeAgents.get(agentId);
        if (agent) {
            return await agent.handleTask(taskType, taskData);
        }
        throw new Error(`Agent ${agentId} not found`);
    }

    async broadcastToAgents(message, agentTypes = null) {
        const targetAgents = agentTypes
            ? Array.from(this.activeAgents.values()).filter(agent => agentTypes.includes(agent.type))
            : Array.from(this.activeAgents.values());

        const responses = [];
        for (const agent of targetAgents) {
            try {
                const response = await agent.receiveMessage(message);
                responses.push({
                    agentId: agent.agentId,
                    response
                });
            } catch (error) {
                responses.push({
                    agentId: agent.agentId,
                    error: error.message
                });
            }
        }

        return responses;
    }
}

class PropertyAgent {
    constructor(agentId, type, config, database) {
        this.agentId = agentId;
        this.type = type;
        this.name = config.name;
        this.description = config.description;
        this.priority = config.priority;
        this.capabilities = config.capabilities;
        this.interval = config.interval;
        this.db = database;

        this.status = 'initializing';
        this.tasksInProgress = 0;
        this.deployedAt = new Date();
        this.lastActivity = null;
        this.propertyScope = null;
        this.taskQueue = [];
        this.intervalId = null;
    }

    async initialize() {
        this.status = 'initialized';
        console.log(`🔧 Initialized ${this.name}`);
    }

    setPropertyScope(propertyIds) {
        this.propertyScope = Array.isArray(propertyIds) ? propertyIds : [propertyIds];
        console.log(`🎯 Set property scope for ${this.name}: ${this.propertyScope.length} properties`);
    }

    start() {
        this.status = 'running';
        this.intervalId = setInterval(() => {
            this.executeMainTask();
        }, this.interval);

        // Execute immediately on start
        this.executeMainTask();
        console.log(`▶️  Started ${this.name}`);
    }

    async stop() {
        this.status = 'stopped';
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log(`⏹️  Stopped ${this.name}`);
    }

    async executeMainTask() {
        try {
            this.lastActivity = new Date();

            switch (this.type) {
                case 'rent_collector':
                    await this.executeRentCollection();
                    break;
                case 'maintenance_coordinator':
                    await this.executeMaintenanceCoordination();
                    break;
                case 'tenant_relationship':
                    await this.executeTenantRelationship();
                    break;
                case 'financial_analyst':
                    await this.executeFinancialAnalysis();
                    break;
                case 'compliance_monitor':
                    await this.executeComplianceMonitoring();
                    break;
                case 'emergency_responder':
                    await this.executeEmergencyResponse();
                    break;
                default:
                    console.log(`❓ Unknown task type for ${this.name}`);
            }
        } catch (error) {
            console.error(`❌ Error in ${this.name}:`, error.message);
        }
    }

    async executeRentCollection() {
        const properties = await this.getRelevantProperties();
        let actionsPerformed = 0;

        for (const property of properties) {
            // Check for overdue rent
            const today = new Date();
            const fifthOfMonth = new Date(today.getFullYear(), today.getMonth(), 5);

            if (today > fifthOfMonth) {
                // Create overdue rent alert
                await this.db.createAlert({
                    property_id: property.id,
                    manager_name: property.manager,
                    alert_type: 'rent_overdue',
                    title: 'Rent Payment Overdue',
                    message: `Rent payment is overdue for ${property.address}. Follow up required.`,
                    priority: 'High',
                    due_date: today.toISOString().split('T')[0]
                });
                actionsPerformed++;
            }
        }

        if (actionsPerformed > 0) {
            console.log(`💰 Rent Collection Agent: Processed ${actionsPerformed} overdue rent situations`);
        }
    }

    async executeMaintenanceCoordination() {
        const properties = await this.getRelevantProperties();
        let actionsPerformed = 0;

        for (const property of properties) {
            // Random maintenance scheduling (30% chance)
            if (Math.random() < 0.3) {
                const maintenanceTypes = ['HVAC Inspection', 'Plumbing Check', 'Electrical Safety', 'Roof Inspection', 'Pest Control'];
                const randomType = maintenanceTypes[Math.floor(Math.random() * maintenanceTypes.length)];

                const scheduledDate = new Date();
                scheduledDate.setDate(scheduledDate.getDate() + Math.floor(Math.random() * 30) + 7); // 1-5 weeks

                await this.db.createAlert({
                    property_id: property.id,
                    manager_name: property.manager,
                    alert_type: 'maintenance_scheduled',
                    title: `${randomType} Scheduled`,
                    message: `${randomType} has been scheduled for ${property.address}`,
                    priority: 'Medium',
                    due_date: scheduledDate.toISOString().split('T')[0]
                });
                actionsPerformed++;
            }
        }

        if (actionsPerformed > 0) {
            console.log(`🔧 Maintenance Coordinator: Scheduled ${actionsPerformed} maintenance tasks`);
        }
    }

    async executeTenantRelationship() {
        const properties = await this.getRelevantProperties();
        let actionsPerformed = 0;

        for (const property of properties) {
            // Random tenant satisfaction check (20% chance)
            if (Math.random() < 0.2) {
                await this.db.createAlert({
                    property_id: property.id,
                    manager_name: property.manager,
                    alert_type: 'tenant_satisfaction',
                    title: 'Tenant Satisfaction Check',
                    message: `Scheduled tenant satisfaction survey for ${property.address}`,
                    priority: 'Low',
                    due_date: new Date().toISOString().split('T')[0]
                });
                actionsPerformed++;
            }
        }

        if (actionsPerformed > 0) {
            console.log(`🤝 Tenant Relationship Agent: Initiated ${actionsPerformed} tenant engagement activities`);
        }
    }

    async executeFinancialAnalysis() {
        const properties = await this.getRelevantProperties();

        // Calculate portfolio performance
        const totalIncome = properties.reduce((sum, prop) => sum + (prop.rent_income || 0), 0);
        const totalExpenses = properties.reduce((sum, prop) => sum + (prop.total_expenses || 0), 0);
        const averageROI = properties.reduce((sum, prop) => sum + (prop.roi || 0), 0) / properties.length;

        // Find underperforming properties
        const underperformers = properties.filter(prop => (prop.roi || 0) < 2).length;

        if (underperformers > 0) {
            await this.db.createAlert({
                property_id: 1,
                manager_name: 'System',
                alert_type: 'financial_analysis',
                title: 'Portfolio Performance Alert',
                message: `${underperformers} properties are underperforming with ROI < 2%. Review recommended.`,
                priority: 'Medium',
                due_date: new Date().toISOString().split('T')[0]
            });
        }

        console.log(`📊 Financial Analyst: Analyzed ${properties.length} properties, average ROI: ${averageROI.toFixed(2)}%`);
    }

    async executeComplianceMonitoring() {
        const properties = await this.getRelevantProperties();
        let complianceIssues = 0;

        for (const property of properties) {
            // Random compliance check (15% chance of issue)
            if (Math.random() < 0.15) {
                const complianceTypes = ['Fire Safety Inspection Due', 'Insurance Renewal Required', 'Property Tax Review', 'Occupancy Permit Check'];
                const randomCompliance = complianceTypes[Math.floor(Math.random() * complianceTypes.length)];

                await this.db.createAlert({
                    property_id: property.id,
                    manager_name: property.manager,
                    alert_type: 'compliance_issue',
                    title: randomCompliance,
                    message: `${randomCompliance} required for ${property.address}`,
                    priority: 'High',
                    due_date: new Date().toISOString().split('T')[0]
                });
                complianceIssues++;
            }
        }

        if (complianceIssues > 0) {
            console.log(`⚖️  Compliance Monitor: Identified ${complianceIssues} compliance issues`);
        }
    }

    async executeEmergencyResponse() {
        const alerts = await this.db.getActiveAlerts();
        const emergencyAlerts = alerts.filter(alert =>
            alert.priority === 'High' &&
            ['maintenance_emergency', 'tenant_emergency', 'compliance_emergency'].includes(alert.alert_type)
        );

        if (emergencyAlerts.length > 0) {
            console.log(`🚨 Emergency Responder: Monitoring ${emergencyAlerts.length} high-priority situations`);

            // Auto-escalate very old high priority alerts
            for (const alert of emergencyAlerts) {
                const alertDate = new Date(alert.created_at || alert.due_date);
                const daysSinceAlert = (new Date() - alertDate) / (1000 * 60 * 60 * 24);

                if (daysSinceAlert > 2) { // Alert is over 2 days old
                    await this.db.createAlert({
                        property_id: alert.property_id,
                        manager_name: 'System',
                        alert_type: 'escalated_emergency',
                        title: 'ESCALATED: ' + alert.title,
                        message: `Alert has been escalated due to lack of response: ${alert.message}`,
                        priority: 'High',
                        due_date: new Date().toISOString().split('T')[0]
                    });
                }
            }
        }
    }

    async getRelevantProperties() {
        const allProperties = await this.db.getAllProperties();

        if (this.propertyScope) {
            return allProperties.filter(prop => this.propertyScope.includes(prop.id));
        }

        return allProperties;
    }

    async handleTask(taskType, taskData) {
        this.tasksInProgress++;
        try {
            // Handle specific task types
            const result = await this.processTask(taskType, taskData);
            return result;
        } finally {
            this.tasksInProgress--;
        }
    }

    async processTask(taskType, taskData) {
        switch (taskType) {
            case 'urgent_maintenance':
                return await this.handleUrgentMaintenance(taskData);
            case 'tenant_inquiry':
                return await this.handleTenantInquiry(taskData);
            case 'payment_issue':
                return await this.handlePaymentIssue(taskData);
            default:
                return { success: false, message: 'Unknown task type' };
        }
    }

    async handleUrgentMaintenance(data) {
        console.log(`🚨 ${this.name} handling urgent maintenance: ${data.description}`);
        return { success: true, message: 'Urgent maintenance request processed' };
    }

    async handleTenantInquiry(data) {
        console.log(`📞 ${this.name} handling tenant inquiry: ${data.inquiry}`);
        return { success: true, message: 'Tenant inquiry processed' };
    }

    async handlePaymentIssue(data) {
        console.log(`💳 ${this.name} handling payment issue: ${data.issue}`);
        return { success: true, message: 'Payment issue resolved' };
    }

    async receiveMessage(message) {
        console.log(`📨 ${this.name} received message: ${message.type}`);
        return { acknowledged: true, timestamp: new Date().toISOString() };
    }

    getUptime() {
        return Date.now() - this.deployedAt.getTime();
    }
}

module.exports = AgentManager;