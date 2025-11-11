const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const Database = require('./models/database');
const AutomationEngine = require('./utils/automationEngine');
const AgentManager = require('./agents/AgentManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database, automation engine, and agent manager
const db = new Database();
const automationEngine = new AutomationEngine();
const agentManager = new AgentManager();

// Configure Handlebars
app.engine('handlebars', exphbs.create({
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials'),
    helpers: {
        formatCurrency: function(value) {
            if (typeof value !== 'number') return '$0';
            return '$' + value.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
        },
        formatPercent: function(value) {
            if (typeof value !== 'number') return '0%';
            return value.toFixed(1) + '%';
        },
        json: function(context) {
            return JSON.stringify(context);
        },
        eq: function(a, b) {
            return a === b;
        },
        gt: function(a, b) {
            return a > b;
        },
        lt: function(a, b) {
            return a < b;
        },
        formatDate: function(date) {
            if (!date) return 'N/A';
            return new Date(date).toLocaleDateString();
        },
        divide: function(a, b) {
            if (typeof a !== 'number' || typeof b !== 'number' || b === 0) return 0;
            return a / b;
        },
        formatTime: function(seconds) {
            if (typeof seconds !== 'number') return '0s';
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);

            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else if (minutes > 0) {
                return `${minutes}m ${secs}s`;
            } else {
                return `${secs}s`;
            }
        },
        priorityClass: function(priority) {
            switch(priority) {
                case 'High': return 'priority-high';
                case 'Medium': return 'priority-medium';
                case 'Low': return 'priority-low';
                default: return 'priority-medium';
            }
        }
    }
}).engine);

app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to database and initialize automation on startup
db.connect().then(async () => {
    console.log('✅ Database connected successfully');

    // Initialize automation engine
    await automationEngine.initialize();

    // Initialize agent manager
    await agentManager.initialize();

    // Start automated tasks
    automationEngine.startAutomations();

}).catch(err => {
    console.error('❌ Database connection failed:', err);
});

// Routes

// Dashboard home
app.get('/', async (req, res) => {
    try {
        const [properties, managers, alerts] = await Promise.all([
            db.getAllProperties(),
            db.getAllManagers(),
            db.getActiveAlerts()
        ]);

        // Calculate portfolio metrics
        const totalProperties = properties.length;
        const totalRentIncome = properties.reduce((sum, prop) => sum + (prop.rent_income || 0), 0);
        const totalExpenses = properties.reduce((sum, prop) => sum + (prop.total_expenses || 0), 0);
        const totalNetIncome = totalRentIncome - totalExpenses;
        const totalMortgageBalance = properties.reduce((sum, prop) => sum + (prop.mortgage_balance || 0), 0);
        const averageROI = totalMortgageBalance > 0 ? (totalNetIncome / totalMortgageBalance * 100) : 0;
        const occupancyRate = properties.filter(prop => prop.status === 'Active').length / totalProperties * 100;

        // Top performers
        const topPerformers = properties
            .filter(prop => prop.roi > 0)
            .sort((a, b) => b.roi - a.roi)
            .slice(0, 5);

        // Under performers
        const underPerformers = properties
            .filter(prop => prop.net_income < 0)
            .sort((a, b) => a.net_income - b.net_income)
            .slice(0, 5);

        // High priority alerts
        const highPriorityAlerts = alerts.filter(alert => alert.priority === 'High').slice(0, 5);

        res.render('dashboard', {
            title: 'Property Management Dashboard',
            portfolioMetrics: {
                totalProperties,
                totalRentIncome,
                totalExpenses,
                totalNetIncome,
                totalMortgageBalance,
                averageROI,
                occupancyRate
            },
            topPerformers,
            underPerformers,
            managers: managers.slice(0, 6), // Top 6 managers
            alerts: highPriorityAlerts,
            totalAlerts: alerts.length
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Properties page
app.get('/properties', async (req, res) => {
    try {
        const properties = await db.getAllProperties();
        const managers = await db.getAllManagers();

        res.render('properties', {
            title: 'Properties',
            properties,
            managers
        });
    } catch (error) {
        console.error('Error loading properties:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Managers page
app.get('/managers', async (req, res) => {
    try {
        const managers = await db.getAllManagers();

        res.render('managers', {
            title: 'Property Managers',
            managers
        });
    } catch (error) {
        console.error('Error loading managers:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Manager details page
app.get('/managers/:name', async (req, res) => {
    try {
        const managerName = decodeURIComponent(req.params.name);
        const properties = await db.getPropertiesByManager(managerName);

        // Calculate manager metrics
        const totalProperties = properties.length;
        const totalRentIncome = properties.reduce((sum, prop) => sum + (prop.rent_income || 0), 0);
        const totalExpenses = properties.reduce((sum, prop) => sum + (prop.total_expenses || 0), 0);
        const totalNetIncome = totalRentIncome - totalExpenses;
        const averageROI = totalProperties > 0 ? properties.reduce((sum, prop) => sum + (prop.roi || 0), 0) / totalProperties : 0;

        res.render('manager-detail', {
            title: `Manager: ${managerName}`,
            managerName,
            properties,
            metrics: {
                totalProperties,
                totalRentIncome,
                totalExpenses,
                totalNetIncome,
                averageROI
            }
        });
    } catch (error) {
        console.error('Error loading manager details:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Alerts page
app.get('/alerts', async (req, res) => {
    try {
        const alerts = await db.getActiveAlerts();

        res.render('alerts', {
            title: 'Alerts & Notifications',
            alerts
        });
    } catch (error) {
        console.error('Error loading alerts:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Map page
app.get('/map', async (req, res) => {
    try {
        res.render('map', {
            title: 'Property Map'
        });
    } catch (error) {
        console.error('Error loading map:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Reports page
app.get('/reports', async (req, res) => {
    try {
        const [properties, managers] = await Promise.all([
            db.getAllProperties(),
            db.getAllManagers()
        ]);

        // Calculate comprehensive report data
        const totalProperties = properties.length;
        const totalRentIncome = properties.reduce((sum, prop) => sum + (prop.rent_income || 0), 0);
        const totalExpenses = properties.reduce((sum, prop) => sum + (prop.total_expenses || 0), 0);
        const totalNetIncome = totalRentIncome - totalExpenses;
        const totalMortgageBalance = properties.reduce((sum, prop) => sum + (prop.mortgage_balance || 0), 0);
        const averageROI = totalMortgageBalance > 0 ? (totalNetIncome / totalMortgageBalance * 100) : 0;

        // Manager performance for reports
        const managerStats = managers.map(manager => {
            const managerProperties = properties.filter(prop => prop.manager === manager.name);
            const totalRent = managerProperties.reduce((sum, prop) => sum + (prop.rent_income || 0), 0);
            const totalExpense = managerProperties.reduce((sum, prop) => sum + (prop.total_expenses || 0), 0);
            const netIncome = totalRent - totalExpense;
            const avgROI = managerProperties.length > 0 ?
                managerProperties.reduce((sum, prop) => sum + (prop.roi || 0), 0) / managerProperties.length : 0;

            return {
                name: manager.name,
                propertyCount: managerProperties.length,
                totalRentIncome: totalRent,
                totalExpenses: totalExpense,
                netIncome: netIncome,
                averageROI: avgROI,
                efficiency: totalRent > 0 ? ((totalRent - totalExpense) / totalRent * 100) : 0,
                properties: managerProperties
            };
        }).sort((a, b) => b.averageROI - a.averageROI);

        // Property performance categories
        const topPerformers = properties
            .filter(prop => prop.roi > 10)
            .sort((a, b) => b.roi - a.roi)
            .slice(0, 10);

        const underPerformers = properties
            .filter(prop => prop.roi < 5)
            .sort((a, b) => a.roi - b.roi)
            .slice(0, 10);

        // Monthly financial data (simulated for last 12 months)
        const monthlyData = [];
        const currentDate = new Date();
        for (let i = 11; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const monthlyIncome = totalRentIncome + (Math.random() - 0.5) * totalRentIncome * 0.1;
            const monthlyExpenses = totalExpenses + (Math.random() - 0.5) * totalExpenses * 0.15;
            monthlyData.push({
                month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                income: Math.round(monthlyIncome),
                expenses: Math.round(monthlyExpenses),
                netIncome: Math.round(monthlyIncome - monthlyExpenses),
                date: date.toISOString().split('T')[0]
            });
        }

        // Tax preparation data
        const taxData = {
            totalDepreciation: Math.round(totalMortgageBalance * 0.0364), // Rough estimate
            totalDeductions: Math.round(totalExpenses * 1.2), // Including depreciation
            scheduleEIncome: totalRentIncome,
            scheduleEExpenses: totalExpenses,
            netScheduleE: totalNetIncome
        };

        // Maintenance summary
        const maintenanceData = {
            totalMaintenanceCost: Math.round(totalExpenses * 0.35),
            averagePerProperty: Math.round(totalExpenses * 0.35 / totalProperties),
            highMaintenanceProperties: properties
                .filter(prop => (prop.total_expenses || 0) > totalExpenses / totalProperties * 1.5)
                .sort((a, b) => (b.total_expenses || 0) - (a.total_expenses || 0))
                .slice(0, 5)
        };

        res.render('reports', {
            title: 'Business Reports',
            portfolioMetrics: {
                totalProperties,
                totalRentIncome,
                totalExpenses,
                totalNetIncome,
                totalMortgageBalance,
                averageROI
            },
            managerStats,
            topPerformers,
            underPerformers,
            monthlyData,
            taxData,
            maintenanceData,
            properties,
            managers,
            currentDate: new Date().toISOString().split('T')[0],
            reportData: {
                portfolioMetrics: JSON.stringify({
                    totalProperties,
                    totalRentIncome,
                    totalExpenses,
                    totalNetIncome,
                    totalMortgageBalance,
                    averageROI
                }),
                managerStats: JSON.stringify(managerStats),
                monthlyData: JSON.stringify(monthlyData),
                properties: JSON.stringify(properties),
                taxData: JSON.stringify(taxData),
                maintenanceData: JSON.stringify(maintenanceData)
            }
        });
    } catch (error) {
        console.error('Error loading reports:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Settings page
app.get('/settings', async (req, res) => {
    try {
        const [properties, managers] = await Promise.all([
            db.getAllProperties(),
            db.getAllManagers()
        ]);

        // System status information
        const systemStatus = {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version,
            platform: process.platform,
            lastBackup: new Date(Date.now() - 86400000).toISOString(), // Yesterday for demo
            databaseConnected: true,
            agentsActive: 5 // Demo value
        };

        // User activity logs (simulated)
        const userLogs = [
            { timestamp: new Date(), user: 'admin', action: 'Settings updated', details: 'Notification preferences changed' },
            { timestamp: new Date(Date.now() - 3600000), user: 'admin', action: 'Backup created', details: 'Manual backup initiated' },
            { timestamp: new Date(Date.now() - 7200000), user: 'admin', action: 'Agent deployed', details: 'Rent reminder agent activated' }
        ];

        res.render('settings', {
            title: 'System Settings',
            properties,
            managers,
            systemStatus,
            userLogs,
            totalProperties: properties.length,
            totalManagers: managers.length
        });
    } catch (error) {
        console.error('Error loading settings:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Settings save endpoint
app.post('/settings', async (req, res) => {
    try {
        const { section, settings } = req.body;

        // In a real application, save settings to database or configuration files
        console.log(`Saving settings for section: ${section}`, settings);

        // Create activity log
        await db.createAlert({
            property_id: null,
            manager_name: 'System',
            alert_type: 'system_activity',
            title: 'Settings Updated',
            message: `Settings updated for section: ${section}`,
            priority: 'Low',
            due_date: new Date().toISOString().split('T')[0]
        });

        res.json({
            success: true,
            message: 'Settings saved successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save settings'
        });
    }
});

// Settings export endpoint
app.get('/settings/export', (req, res) => {
    try {
        // Demo settings export
        const settingsData = {
            company: {
                name: 'Ben Zen Properties LLC',
                email: 'admin@benzenproperties.com',
                phone: '(555) 123-4567',
                address: '123 Business Blvd, Suite 100, City, State 12345'
            },
            notifications: {
                emailAlerts: true,
                smsAlerts: true,
                pushNotifications: true,
                rentReminders: true,
                maintenanceAlerts: true
            },
            automation: {
                rentReminders: true,
                maintenanceCheck: true,
                monthlyReports: true,
                agentDeployment: true
            },
            exportDate: new Date().toISOString()
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=settings-export.json');
        res.json(settingsData);
    } catch (error) {
        console.error('Error exporting settings:', error);
        res.status(500).json({ error: 'Failed to export settings' });
    }
});

// Settings import endpoint
app.post('/settings/import', async (req, res) => {
    try {
        const { settings } = req.body;

        // Validate and import settings
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid settings data'
            });
        }

        // In a real application, validate and save imported settings
        console.log('Importing settings:', settings);

        // Create activity log
        await db.createAlert({
            property_id: null,
            manager_name: 'System',
            alert_type: 'system_activity',
            title: 'Settings Imported',
            message: 'Settings configuration imported from file',
            priority: 'Medium',
            due_date: new Date().toISOString().split('T')[0]
        });

        res.json({
            success: true,
            message: 'Settings imported successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error importing settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import settings'
        });
    }
});

// Analytics page
app.get('/analytics', async (req, res) => {
    try {
        const [properties, managers] = await Promise.all([
            db.getAllProperties(),
            db.getAllManagers()
        ]);

        // Portfolio Performance Analysis
        const totalProperties = properties.length;
        const totalRentIncome = properties.reduce((sum, prop) => sum + (prop.rent_income || 0), 0);
        const totalExpenses = properties.reduce((sum, prop) => sum + (prop.total_expenses || 0), 0);
        const totalNetIncome = totalRentIncome - totalExpenses;
        const totalMortgageBalance = properties.reduce((sum, prop) => sum + (prop.mortgage_balance || 0), 0);
        const averageROI = totalMortgageBalance > 0 ? (totalNetIncome / totalMortgageBalance * 100) : 0;

        // ROI Distribution Analysis
        const roiRanges = {
            'Below 0%': 0,
            '0-5%': 0,
            '5-10%': 0,
            '10-15%': 0,
            '15%+': 0
        };

        properties.forEach(prop => {
            const roi = prop.roi || 0;
            if (roi < 0) roiRanges['Below 0%']++;
            else if (roi < 5) roiRanges['0-5%']++;
            else if (roi < 10) roiRanges['5-10%']++;
            else if (roi < 15) roiRanges['10-15%']++;
            else roiRanges['15%+']++;
        });

        // Manager Performance Analysis
        const managerStats = managers.map(manager => {
            const managerProperties = properties.filter(prop => prop.manager === manager.name);
            const totalRent = managerProperties.reduce((sum, prop) => sum + (prop.rent_income || 0), 0);
            const totalExpense = managerProperties.reduce((sum, prop) => sum + (prop.total_expenses || 0), 0);
            const netIncome = totalRent - totalExpense;
            const avgROI = managerProperties.length > 0 ?
                managerProperties.reduce((sum, prop) => sum + (prop.roi || 0), 0) / managerProperties.length : 0;

            return {
                name: manager.name,
                propertyCount: managerProperties.length,
                totalRentIncome: totalRent,
                totalExpenses: totalExpense,
                netIncome: netIncome,
                averageROI: avgROI,
                efficiency: totalRent > 0 ? ((totalRent - totalExpense) / totalRent * 100) : 0
            };
        }).sort((a, b) => b.averageROI - a.averageROI);

        // Property Type Analysis
        const propertyTypes = {};
        properties.forEach(prop => {
            const type = prop.property_type || 'Unknown';
            if (!propertyTypes[type]) {
                propertyTypes[type] = {
                    count: 0,
                    totalRent: 0,
                    totalExpenses: 0,
                    totalROI: 0
                };
            }
            propertyTypes[type].count++;
            propertyTypes[type].totalRent += prop.rent_income || 0;
            propertyTypes[type].totalExpenses += prop.total_expenses || 0;
            propertyTypes[type].totalROI += prop.roi || 0;
        });

        // Geographic Performance Analysis
        const cityPerformance = {};
        properties.forEach(prop => {
            const city = prop.city || 'Unknown';
            if (!cityPerformance[city]) {
                cityPerformance[city] = {
                    count: 0,
                    totalRent: 0,
                    totalExpenses: 0,
                    avgROI: 0,
                    properties: []
                };
            }
            cityPerformance[city].count++;
            cityPerformance[city].totalRent += prop.rent_income || 0;
            cityPerformance[city].totalExpenses += prop.total_expenses || 0;
            cityPerformance[city].properties.push(prop.roi || 0);
        });

        // Calculate average ROI for each city
        Object.keys(cityPerformance).forEach(city => {
            const rois = cityPerformance[city].properties;
            cityPerformance[city].avgROI = rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : 0;
        });

        // Cash Flow Trends (simulated monthly data for last 12 months)
        const cashFlowTrends = [];
        const currentDate = new Date();
        for (let i = 11; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const monthlyIncome = totalRentIncome + (Math.random() - 0.5) * totalRentIncome * 0.1;
            const monthlyExpenses = totalExpenses + (Math.random() - 0.5) * totalExpenses * 0.15;
            cashFlowTrends.push({
                month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                income: Math.round(monthlyIncome),
                expenses: Math.round(monthlyExpenses),
                netIncome: Math.round(monthlyIncome - monthlyExpenses)
            });
        }

        // Expense Category Analysis
        const expenseCategories = {
            'Maintenance': 0,
            'Insurance': 0,
            'Property Tax': 0,
            'Management Fees': 0,
            'Utilities': 0,
            'Marketing': 0,
            'Other': 0
        };

        // Simulate expense breakdown (in real app, this would come from detailed expense records)
        const totalExp = totalExpenses;
        expenseCategories['Maintenance'] = Math.round(totalExp * 0.35);
        expenseCategories['Property Tax'] = Math.round(totalExp * 0.25);
        expenseCategories['Insurance'] = Math.round(totalExp * 0.15);
        expenseCategories['Management Fees'] = Math.round(totalExp * 0.12);
        expenseCategories['Utilities'] = Math.round(totalExp * 0.08);
        expenseCategories['Marketing'] = Math.round(totalExp * 0.03);
        expenseCategories['Other'] = totalExp - Object.values(expenseCategories).reduce((a, b) => a + b, 0);

        // Top and Bottom Performers
        const topPerformers = [...properties]
            .filter(prop => prop.roi > 0)
            .sort((a, b) => b.roi - a.roi)
            .slice(0, 10);

        const bottomPerformers = [...properties]
            .sort((a, b) => a.roi - b.roi)
            .slice(0, 10);

        // Key Performance Indicators
        const kpis = {
            portfolioValue: totalMortgageBalance + (totalNetIncome * 12 * 10), // Rough valuation
            occupancyRate: properties.filter(prop => prop.status === 'Active').length / totalProperties * 100,
            averageRentPerProperty: totalProperties > 0 ? totalRentIncome / totalProperties : 0,
            averageExpenseRatio: totalRentIncome > 0 ? (totalExpenses / totalRentIncome * 100) : 0,
            cashOnCashReturn: totalMortgageBalance > 0 ? (totalNetIncome / totalMortgageBalance * 100) : 0,
            totalEquity: Math.max(0, (totalRentIncome * 12 * 8) - totalMortgageBalance) // Rough equity calculation
        };

        res.render('analytics', {
            title: 'Analytics & Insights',
            portfolioMetrics: {
                totalProperties,
                totalRentIncome,
                totalExpenses,
                totalNetIncome,
                totalMortgageBalance,
                averageROI
            },
            roiDistribution: roiRanges,
            managerPerformance: managerStats,
            propertyTypes,
            cityPerformance,
            cashFlowTrends,
            expenseCategories,
            topPerformers,
            bottomPerformers,
            kpis,
            // Chart data as JSON for JavaScript
            chartData: {
                roiDistribution: JSON.stringify(roiRanges),
                managerPerformance: JSON.stringify(managerStats),
                propertyTypes: JSON.stringify(propertyTypes),
                cityPerformance: JSON.stringify(cityPerformance),
                cashFlowTrends: JSON.stringify(cashFlowTrends),
                expenseCategories: JSON.stringify(expenseCategories)
            }
        });
    } catch (error) {
        console.error('Error loading analytics:', error);
        res.status(500).send('Internal Server Error');
    }
});

// API endpoints for dynamic content

// API: Get all properties as JSON
app.get('/api/properties', async (req, res) => {
    try {
        const properties = await db.getAllProperties();
        res.json(properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Get portfolio metrics
app.get('/api/portfolio-metrics', async (req, res) => {
    try {
        const properties = await db.getAllProperties();

        const totalProperties = properties.length;
        const totalRentIncome = properties.reduce((sum, prop) => sum + (prop.rent_income || 0), 0);
        const totalExpenses = properties.reduce((sum, prop) => sum + (prop.total_expenses || 0), 0);
        const totalNetIncome = totalRentIncome - totalExpenses;
        const totalMortgageBalance = properties.reduce((sum, prop) => sum + (prop.mortgage_balance || 0), 0);
        const averageROI = totalMortgageBalance > 0 ? (totalNetIncome / totalMortgageBalance * 100) : 0;

        res.json({
            totalProperties,
            totalRentIncome,
            totalExpenses,
            totalNetIncome,
            totalMortgageBalance,
            averageROI
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Get manager performance data
app.get('/api/manager-performance', async (req, res) => {
    try {
        const managers = await db.getAllManagers();
        res.json(managers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Automation API endpoints

// Get automation status
app.get('/api/automation/status', (req, res) => {
    try {
        const status = automationEngine.getAutomationStatus();
        res.json({
            success: true,
            automations: status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Manual trigger endpoints
app.post('/api/automation/trigger/rent-reminders', async (req, res) => {
    try {
        await automationEngine.triggerRentReminders();
        res.json({
            success: true,
            message: 'Rent collection reminders triggered successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/automation/trigger/maintenance-check', async (req, res) => {
    try {
        await automationEngine.triggerMaintenanceCheck();
        res.json({
            success: true,
            message: 'Maintenance check triggered successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/automation/trigger/monthly-report', async (req, res) => {
    try {
        await automationEngine.triggerMonthlyReport();
        res.json({
            success: true,
            message: 'Monthly report generation triggered successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Log activity endpoint for automation logging
app.post('/api/log-activity', async (req, res) => {
    try {
        const { property_id, activity_type, details } = req.body;

        // Create an alert to log the activity
        await db.createAlert({
            property_id: property_id,
            manager_name: 'System',
            alert_type: 'system_activity',
            title: `Activity: ${activity_type}`,
            message: details,
            priority: 'Low',
            due_date: new Date().toISOString().split('T')[0]
        });

        res.json({
            success: true,
            message: 'Activity logged successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Agent Management API endpoints

// Get agent status
app.get('/api/agents/status', (req, res) => {
    try {
        const status = agentManager.getAgentStatus();
        res.json({
            success: true,
            status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deploy a specific agent
app.post('/api/agents/deploy/:agentType', async (req, res) => {
    try {
        const { agentType } = req.params;
        const { propertyIds } = req.body;

        const agentInfo = await agentManager.deployAgent(agentType, propertyIds);
        res.json({
            success: true,
            message: `${agentInfo.name} deployed successfully`,
            agent: agentInfo
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deploy all agents
app.post('/api/agents/deploy-all', async (req, res) => {
    try {
        const deployedAgents = await agentManager.deployAllAgents();
        res.json({
            success: true,
            message: `Deployed ${deployedAgents.length} agents successfully`,
            agents: deployedAgents
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop a specific agent
app.post('/api/agents/stop/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const stopped = await agentManager.stopAgent(agentId);

        if (stopped) {
            res.json({
                success: true,
                message: `Agent ${agentId} stopped successfully`
            });
        } else {
            res.status(404).json({
                success: false,
                message: `Agent ${agentId} not found`
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop all agents
app.post('/api/agents/stop-all', async (req, res) => {
    try {
        const stoppedAgents = await agentManager.stopAllAgents();
        res.json({
            success: true,
            message: `Stopped ${stoppedAgents.length} agents`,
            stoppedAgents
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get agent metrics
app.get('/api/agents/metrics/:agentType?', (req, res) => {
    try {
        const { agentType } = req.params;
        const metrics = agentManager.getAgentMetrics(agentType);
        res.json({
            success: true,
            metrics
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send task to agent
app.post('/api/agents/:agentId/task', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { taskType, taskData } = req.body;

        const result = await agentManager.handleAgentTask(agentId, taskType, taskData);
        res.json({
            success: true,
            result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Broadcast message to agents
app.post('/api/agents/broadcast', async (req, res) => {
    try {
        const { message, agentTypes } = req.body;
        const responses = await agentManager.broadcastToAgents(message, agentTypes);
        res.json({
            success: true,
            responses
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Property Management System running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🏠 Properties: http://localhost:${PORT}/properties`);
    console.log(`👥 Managers: http://localhost:${PORT}/managers`);
    console.log(`🚨 Alerts: http://localhost:${PORT}/alerts`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    db.close();
    process.exit(0);
});