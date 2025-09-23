const CSVProcessor = require('./csvProcessor');
const Database = require('../models/database');
const path = require('path');

class DataInitializer {
    constructor() {
        this.db = new Database();
    }

    async initializeData(csvPath) {
        try {
            console.log('🚀 Starting data initialization...');

            // Connect to database
            await this.db.connect();

            // Process CSV data
            console.log('📊 Processing CSV data...');
            const properties = CSVProcessor.parseCSVData(csvPath);
            console.log(`Found ${properties.length} properties to process`);

            // Insert properties
            console.log('🏠 Inserting properties into database...');
            const insertedProperties = [];
            for (const property of properties) {
                try {
                    const inserted = await this.db.insertProperty(property);
                    insertedProperties.push(inserted);
                    console.log(`✅ Added: ${property.address}`);
                } catch (error) {
                    if (error.message.includes('UNIQUE constraint failed')) {
                        console.log(`⚠️  Property already exists: ${property.address}`);
                    } else {
                        console.error(`❌ Error adding ${property.address}:`, error.message);
                    }
                }
            }

            // Process and insert manager data
            console.log('👥 Processing manager data...');
            const managerGroups = CSVProcessor.groupByManager(properties);

            for (const managerName of Object.keys(managerGroups)) {
                const managerData = managerGroups[managerName];
                try {
                    await this.db.insertOrUpdateManager(managerData);
                    console.log(`✅ Added/Updated manager: ${managerName}`);
                } catch (error) {
                    console.error(`❌ Error adding manager ${managerName}:`, error.message);
                }
            }

            // Calculate portfolio metrics
            console.log('📈 Calculating portfolio metrics...');
            const portfolioMetrics = CSVProcessor.calculatePortfolioMetrics(properties);
            console.log('Portfolio Summary:');
            console.log(`  Total Properties: ${portfolioMetrics.totalProperties}`);
            console.log(`  Total Rent Income: $${portfolioMetrics.totalRentIncome.toLocaleString()}`);
            console.log(`  Total Expenses: $${portfolioMetrics.totalExpenses.toLocaleString()}`);
            console.log(`  Net Income: $${portfolioMetrics.totalNetIncome.toLocaleString()}`);
            console.log(`  Average ROI: ${portfolioMetrics.averageROI.toFixed(2)}%`);
            console.log(`  Occupancy Rate: ${portfolioMetrics.occupancyRate.toFixed(1)}%`);

            // Generate sample alerts
            console.log('🚨 Generating sample alerts...');
            await this.generateSampleAlerts(insertedProperties);

            // Generate sample financial records
            console.log('📋 Generating sample financial records...');
            await this.generateSampleFinancialRecords(insertedProperties);

            console.log('✅ Data initialization completed successfully!');

            return {
                properties: insertedProperties,
                managers: Object.keys(managerGroups),
                portfolioMetrics: portfolioMetrics
            };

        } catch (error) {
            console.error('❌ Error during data initialization:', error);
            throw error;
        }
    }

    async generateSampleAlerts(properties) {
        const alertTypes = [
            'lease_renewal',
            'maintenance_due',
            'payment_overdue',
            'inspection_due',
            'tax_assessment'
        ];

        const priorities = ['High', 'Medium', 'Low'];
        const alertCount = Math.min(15, properties.length); // Generate alerts for up to 15 properties

        for (let i = 0; i < alertCount; i++) {
            const property = properties[i];
            const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
            const priority = priorities[Math.floor(Math.random() * priorities.length)];

            let title, message, dueDate;

            switch (alertType) {
                case 'lease_renewal':
                    title = 'Lease Renewal Due';
                    message = `Lease for ${property.address} expires in 30 days. Contact tenant for renewal.`;
                    dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'maintenance_due':
                    title = 'Scheduled Maintenance';
                    message = `Annual HVAC maintenance due for ${property.address}.`;
                    dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'payment_overdue':
                    title = 'Payment Overdue';
                    message = `Rent payment is 5 days overdue for ${property.address}.`;
                    dueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
                    break;
                case 'inspection_due':
                    title = 'Property Inspection';
                    message = `Quarterly inspection due for ${property.address}.`;
                    dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
                    break;
                case 'tax_assessment':
                    title = 'Tax Assessment Review';
                    message = `Property tax assessment notice received for ${property.address}.`;
                    dueDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
                    break;
            }

            const alert = {
                property_id: property.id,
                manager_name: property.manager,
                alert_type: alertType,
                title: title,
                message: message,
                priority: priority,
                due_date: dueDate.toISOString().split('T')[0]
            };

            try {
                await this.db.createAlert(alert);
            } catch (error) {
                console.error(`Error creating alert for ${property.address}:`, error.message);
            }
        }

        console.log(`Generated ${alertCount} sample alerts`);
    }

    async generateSampleFinancialRecords(properties) {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        // Generate records for the last 6 months for a subset of properties
        const recordCount = Math.min(10, properties.length);

        for (let i = 0; i < recordCount; i++) {
            const property = properties[i];

            for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
                let recordMonth = currentMonth - monthOffset;
                let recordYear = currentYear;

                if (recordMonth <= 0) {
                    recordMonth += 12;
                    recordYear -= 1;
                }

                // Generate realistic financial data with some variation
                const baseRent = property.rent_income / 12; // Monthly rent
                const variation = 0.9 + (Math.random() * 0.2); // ±10% variation

                const record = {
                    property_id: property.id,
                    month: recordMonth,
                    year: recordYear,
                    rent_income: Math.round(baseRent * variation),
                    repairs: Math.round(Math.random() * 500),
                    maintenance: Math.round(50 + Math.random() * 200),
                    management_fees: Math.round(baseRent * 0.08), // 8% management fee
                    insurance: Math.round(property.total_expenses * 0.15 / 12), // 15% of expenses
                    property_tax: Math.round(property.total_expenses * 0.25 / 12), // 25% of expenses
                    utilities: Math.round(Math.random() * 150),
                    other_expenses: Math.round(Math.random() * 100)
                };

                record.total_expenses = record.repairs + record.maintenance + record.management_fees +
                                      record.insurance + record.property_tax + record.utilities + record.other_expenses;
                record.net_income = record.rent_income - record.total_expenses;

                try {
                    await this.db.insertFinancialRecord(record);
                } catch (error) {
                    console.error(`Error creating financial record:`, error.message);
                }
            }
        }

        console.log(`Generated financial records for ${recordCount} properties (6 months each)`);
    }

    async close() {
        await this.db.close();
    }
}

module.exports = DataInitializer;