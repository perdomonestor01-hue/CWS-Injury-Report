const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Database = require('../models/database');

class AutomationEngine {
    constructor() {
        this.db = new Database();
        this.emailTransporter = null;
        this.scheduledTasks = new Map();
        this.initializeEmailTransporter();
    }

    async initialize() {
        await this.db.connect();
        this.setupAutomatedTasks();
        console.log('🤖 Automation Engine initialized successfully');
    }

    initializeEmailTransporter() {
        // Configure email transporter (using ethereal for demo)
        // For demo purposes, we'll just log emails instead of sending them
        this.emailTransporter = {
            sendMail: (options) => {
                console.log(`📧 Email would be sent:`, {
                    to: options.to,
                    subject: options.subject,
                    message: options.text || 'HTML email content'
                });
                return Promise.resolve({ messageId: 'demo-' + Date.now() });
            }
        };
    }

    setupAutomatedTasks() {
        // Monthly rent collection reminders (1st of every month at 9 AM)
        const rentReminderTask = cron.schedule('0 9 1 * *', async () => {
            await this.executeRentCollectionReminders();
        }, { scheduled: false });

        // Weekly maintenance checks (Every Monday at 8 AM)
        const maintenanceTask = cron.schedule('0 8 * * 1', async () => {
            await this.executeMaintenanceReminders();
        }, { scheduled: false });

        // Daily overdue payment alerts (Every day at 10 AM)
        const overdueTask = cron.schedule('0 10 * * *', async () => {
            await this.executeOverduePaymentAlerts();
        }, { scheduled: false });

        // Monthly financial reports (28th of month at 5 PM)
        const reportTask = cron.schedule('0 17 28 * *', async () => {
            await this.generateMonthlyReports();
        }, { scheduled: false });

        // Quarterly property inspections (1st of Jan, Apr, Jul, Oct at 9 AM)
        const inspectionTask = cron.schedule('0 9 1 1,4,7,10 *', async () => {
            await this.scheduleQuarterlyInspections();
        }, { scheduled: false });

        this.scheduledTasks.set('rentReminders', rentReminderTask);
        this.scheduledTasks.set('maintenance', maintenanceTask);
        this.scheduledTasks.set('overdueAlerts', overdueTask);
        this.scheduledTasks.set('monthlyReports', reportTask);
        this.scheduledTasks.set('inspections', inspectionTask);

        console.log('📅 Scheduled automation tasks configured');
    }

    startAutomations() {
        this.scheduledTasks.forEach((task, name) => {
            task.start();
            console.log(`✅ Started automation: ${name}`);
        });
    }

    stopAutomations() {
        this.scheduledTasks.forEach((task, name) => {
            task.stop();
            console.log(`🛑 Stopped automation: ${name}`);
        });
    }

    async executeRentCollectionReminders() {
        try {
            console.log('🏠 Executing monthly rent collection reminders...');

            const properties = await this.db.getAllProperties();
            const activeProperties = properties.filter(prop => prop.status === 'Active');

            for (const property of activeProperties) {
                const monthlyRent = Math.round(property.rent_income / 12);
                const dueDate = new Date();
                dueDate.setDate(5); // Rent due on 5th of each month

                // Send tenant reminder
                await this.sendTenantRentReminder(property, monthlyRent, dueDate);

                // Notify property manager
                await this.notifyManagerRentDue(property, monthlyRent, dueDate);

                // Create alert in system
                await this.db.createAlert({
                    property_id: property.id,
                    manager_name: property.manager,
                    alert_type: 'rent_due',
                    title: 'Rent Collection Due',
                    message: `Rent collection reminder sent for ${property.address}. Amount: $${monthlyRent}`,
                    priority: 'Medium',
                    due_date: dueDate.toISOString().split('T')[0]
                });
            }

            console.log(`✅ Sent rent reminders for ${activeProperties.length} properties`);
        } catch (error) {
            console.error('❌ Error executing rent collection reminders:', error);
        }
    }

    async executeMaintenanceReminders() {
        try {
            console.log('🔧 Executing weekly maintenance reminders...');

            const properties = await this.db.getAllProperties();
            const maintenanceDue = properties.filter(prop => {
                // Logic to determine if maintenance is due
                return Math.random() < 0.3; // 30% chance for demo
            });

            for (const property of maintenanceDue) {
                const maintenanceType = this.getRandomMaintenanceType();

                await this.db.createAlert({
                    property_id: property.id,
                    manager_name: property.manager,
                    alert_type: 'maintenance_due',
                    title: `${maintenanceType} Maintenance Due`,
                    message: `Scheduled ${maintenanceType.toLowerCase()} maintenance is due for ${property.address}`,
                    priority: 'Medium',
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                });

                // Notify manager
                await this.notifyManagerMaintenance(property, maintenanceType);
            }

            console.log(`✅ Created maintenance reminders for ${maintenanceDue.length} properties`);
        } catch (error) {
            console.error('❌ Error executing maintenance reminders:', error);
        }
    }

    async executeOverduePaymentAlerts() {
        try {
            console.log('💰 Checking for overdue payments...');

            // Get all active alerts for overdue payments
            const alerts = await this.db.getActiveAlerts();
            const overdueAlerts = alerts.filter(alert => {
                const dueDate = new Date(alert.due_date);
                const today = new Date();
                return alert.alert_type === 'payment_overdue' && dueDate < today;
            });

            for (const alert of overdueAlerts) {
                // Escalate alert priority
                await this.escalateOverduePayment(alert);
            }

            console.log(`⚠️  Processed ${overdueAlerts.length} overdue payment alerts`);
        } catch (error) {
            console.error('❌ Error executing overdue payment alerts:', error);
        }
    }

    async generateMonthlyReports() {
        try {
            console.log('📊 Generating monthly financial reports...');

            const properties = await this.db.getAllProperties();
            const managers = await this.db.getAllManagers();

            // Calculate portfolio metrics
            const totalRentIncome = properties.reduce((sum, prop) => sum + (prop.rent_income || 0), 0);
            const totalExpenses = properties.reduce((sum, prop) => sum + (prop.total_expenses || 0), 0);
            const netIncome = totalRentIncome - totalExpenses;

            const reportData = {
                month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                totalProperties: properties.length,
                totalRentIncome,
                totalExpenses,
                netIncome,
                averageROI: totalRentIncome > 0 ? (netIncome / totalRentIncome * 100) : 0,
                topPerformers: properties
                    .filter(prop => prop.roi > 0)
                    .sort((a, b) => b.roi - a.roi)
                    .slice(0, 5),
                underPerformers: properties
                    .filter(prop => prop.net_income < 0)
                    .sort((a, b) => a.net_income - b.net_income)
                    .slice(0, 5)
            };

            // Send reports to all managers
            for (const manager of managers) {
                await this.sendMonthlyReport(manager, reportData);
            }

            console.log(`✅ Generated and sent monthly reports to ${managers.length} managers`);
        } catch (error) {
            console.error('❌ Error generating monthly reports:', error);
        }
    }

    async scheduleQuarterlyInspections() {
        try {
            console.log('🔍 Scheduling quarterly property inspections...');

            const properties = await this.db.getAllProperties();
            const inspectionDate = new Date();
            inspectionDate.setDate(inspectionDate.getDate() + 14); // Schedule 2 weeks from now

            for (const property of properties) {
                await this.db.createAlert({
                    property_id: property.id,
                    manager_name: property.manager,
                    alert_type: 'inspection_due',
                    title: 'Quarterly Property Inspection',
                    message: `Quarterly inspection is scheduled for ${property.address}`,
                    priority: 'Medium',
                    due_date: inspectionDate.toISOString().split('T')[0]
                });
            }

            console.log(`✅ Scheduled quarterly inspections for ${properties.length} properties`);
        } catch (error) {
            console.error('❌ Error scheduling quarterly inspections:', error);
        }
    }

    // Helper methods for sending notifications

    async sendTenantRentReminder(property, monthlyRent, dueDate) {
        const tenantEmail = `tenant_${property.id}@email.com`; // Placeholder

        const mailOptions = {
            from: 'noreply@propertymanagement.com',
            to: tenantEmail,
            subject: `Rent Reminder - ${property.address}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Rent Payment Reminder</h2>
                    <p>Dear Tenant,</p>
                    <p>This is a friendly reminder that your rent payment is due:</p>
                    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Property:</strong> ${property.address}</p>
                        <p><strong>Amount Due:</strong> $${monthlyRent.toLocaleString()}</p>
                        <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
                    </div>
                    <p>Please ensure payment is made on time to avoid late fees.</p>
                    <p>Thank you,<br>Property Management Team</p>
                </div>
            `
        };

        // In production, this would actually send the email
        console.log(`📧 Rent reminder sent to tenant at ${property.address}`);
    }

    async notifyManagerRentDue(property, monthlyRent, dueDate) {
        const managerEmail = `${property.manager.toLowerCase().replace(/\s+/g, '.')}@propertymanagement.com`;

        const mailOptions = {
            from: 'system@propertymanagement.com',
            to: managerEmail,
            subject: `Rent Collection Alert - ${property.address}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #059669;">Rent Collection Alert</h2>
                    <p>Hi ${property.manager},</p>
                    <p>A rent collection reminder has been sent to the tenant:</p>
                    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Property:</strong> ${property.address}</p>
                        <p><strong>Amount Due:</strong> $${monthlyRent.toLocaleString()}</p>
                        <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
                    </div>
                    <p>Please follow up if payment is not received by the due date.</p>
                    <p>Best regards,<br>Property Management System</p>
                </div>
            `
        };

        console.log(`📧 Manager notification sent to ${property.manager} for ${property.address}`);
    }

    async notifyManagerMaintenance(property, maintenanceType) {
        console.log(`🔧 Maintenance notification sent to ${property.manager} for ${maintenanceType} at ${property.address}`);
    }

    async sendMonthlyReport(manager, reportData) {
        console.log(`📊 Monthly report sent to ${manager.name}`);
    }

    async escalateOverduePayment(alert) {
        console.log(`⚠️  Escalated overdue payment for ${alert.address}`);
    }

    getRandomMaintenanceType() {
        const types = ['HVAC', 'Plumbing', 'Electrical', 'Roof', 'Painting', 'Landscaping'];
        return types[Math.floor(Math.random() * types.length)];
    }

    // Manual trigger methods for testing

    async triggerRentReminders() {
        console.log('🚀 Manually triggering rent collection reminders...');
        await this.executeRentCollectionReminders();
    }

    async triggerMaintenanceCheck() {
        console.log('🚀 Manually triggering maintenance reminders...');
        await this.executeMaintenanceReminders();
    }

    async triggerMonthlyReport() {
        console.log('🚀 Manually triggering monthly report generation...');
        await this.generateMonthlyReports();
    }

    getAutomationStatus() {
        const status = {};
        this.scheduledTasks.forEach((task, name) => {
            status[name] = {
                name: name,
                running: task.running || false,
                nextRun: task.getStatus ? task.getStatus().nextDate : 'Unknown'
            };
        });
        return status;
    }
}

module.exports = AutomationEngine;