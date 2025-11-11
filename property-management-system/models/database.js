const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/properties.db');
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.initializeTables().then(resolve).catch(reject);
                }
            });
        });
    }

    initializeTables() {
        return new Promise((resolve, reject) => {
            const createTablesSQL = `
                -- Properties table
                CREATE TABLE IF NOT EXISTS properties (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    address TEXT NOT NULL UNIQUE,
                    manager TEXT NOT NULL,
                    property_type TEXT,
                    status TEXT DEFAULT 'Active',
                    rent_income REAL DEFAULT 0,
                    total_expenses REAL DEFAULT 0,
                    net_income REAL DEFAULT 0,
                    mortgage_balance REAL DEFAULT 0,
                    roi REAL DEFAULT 0,
                    city TEXT,
                    state TEXT,
                    latitude REAL,
                    longitude REAL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- Managers table
                CREATE TABLE IF NOT EXISTS managers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    email TEXT,
                    phone TEXT,
                    total_properties INTEGER DEFAULT 0,
                    total_rent_income REAL DEFAULT 0,
                    total_expenses REAL DEFAULT 0,
                    average_roi REAL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- Financial records table for monthly tracking
                CREATE TABLE IF NOT EXISTS financial_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    property_id INTEGER,
                    month INTEGER,
                    year INTEGER,
                    rent_income REAL DEFAULT 0,
                    repairs REAL DEFAULT 0,
                    maintenance REAL DEFAULT 0,
                    management_fees REAL DEFAULT 0,
                    insurance REAL DEFAULT 0,
                    property_tax REAL DEFAULT 0,
                    utilities REAL DEFAULT 0,
                    other_expenses REAL DEFAULT 0,
                    total_expenses REAL DEFAULT 0,
                    net_income REAL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (property_id) REFERENCES properties (id)
                );

                -- Tenants table
                CREATE TABLE IF NOT EXISTS tenants (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    property_id INTEGER,
                    name TEXT NOT NULL,
                    email TEXT,
                    phone TEXT,
                    lease_start DATE,
                    lease_end DATE,
                    monthly_rent REAL,
                    security_deposit REAL,
                    status TEXT DEFAULT 'Active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (property_id) REFERENCES properties (id)
                );

                -- Maintenance requests table
                CREATE TABLE IF NOT EXISTS maintenance_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    property_id INTEGER,
                    tenant_id INTEGER,
                    title TEXT NOT NULL,
                    description TEXT,
                    priority TEXT DEFAULT 'Medium',
                    status TEXT DEFAULT 'Open',
                    cost REAL DEFAULT 0,
                    contractor TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME,
                    FOREIGN KEY (property_id) REFERENCES properties (id),
                    FOREIGN KEY (tenant_id) REFERENCES tenants (id)
                );

                -- Alerts table
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    property_id INTEGER,
                    manager_name TEXT,
                    alert_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT,
                    priority TEXT DEFAULT 'Medium',
                    status TEXT DEFAULT 'Active',
                    due_date DATE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    resolved_at DATETIME,
                    FOREIGN KEY (property_id) REFERENCES properties (id)
                );

                -- Performance metrics table
                CREATE TABLE IF NOT EXISTS performance_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    property_id INTEGER,
                    manager_name TEXT,
                    metric_type TEXT NOT NULL,
                    value REAL,
                    period_start DATE,
                    period_end DATE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (property_id) REFERENCES properties (id)
                );
            `;

            this.db.exec(createTablesSQL, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Database tables initialized');
                    resolve();
                }
            });
        });
    }

    // Property CRUD operations
    insertProperty(property) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO properties (
                    address, manager, property_type, status, rent_income,
                    total_expenses, net_income, mortgage_balance, roi,
                    city, state, latitude, longitude
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                property.address,
                property.manager,
                property.propertyType,
                property.status,
                property.rentIncome,
                property.totalExpenses,
                property.netIncome,
                property.mortgageBalance,
                property.roi,
                property.location.city,
                property.location.state,
                property.location.coordinates.lat,
                property.location.coordinates.lng
            ];

            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...property });
                }
            });
        });
    }

    getAllProperties() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM properties ORDER BY address';

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    getPropertiesByManager(manager) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM properties WHERE manager = ? ORDER BY address';

            this.db.all(sql, [manager], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Manager operations
    insertOrUpdateManager(managerData) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO managers (
                    name, total_properties, total_rent_income,
                    total_expenses, average_roi
                ) VALUES (?, ?, ?, ?, ?)
            `;

            const params = [
                managerData.manager,
                managerData.totalProperties,
                managerData.totalRentIncome,
                managerData.totalExpenses,
                managerData.averageROI
            ];

            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID || this.changes, ...managerData });
                }
            });
        });
    }

    getAllManagers() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM managers ORDER BY total_rent_income DESC';

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Financial records
    insertFinancialRecord(record) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO financial_records (
                    property_id, month, year, rent_income, repairs,
                    maintenance, management_fees, insurance, property_tax,
                    utilities, other_expenses, total_expenses, net_income
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(sql, Object.values(record), function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...record });
                }
            });
        });
    }

    // Alert operations
    createAlert(alert) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO alerts (
                    property_id, manager_name, alert_type, title,
                    message, priority, due_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                alert.property_id,
                alert.manager_name,
                alert.alert_type,
                alert.title,
                alert.message,
                alert.priority,
                alert.due_date
            ];

            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...alert });
                }
            });
        });
    }

    getActiveAlerts() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT a.*, p.address
                FROM alerts a
                LEFT JOIN properties p ON a.property_id = p.id
                WHERE a.status = 'Active'
                ORDER BY a.priority DESC, a.created_at DESC
            `;

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = Database;