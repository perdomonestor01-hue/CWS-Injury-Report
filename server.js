const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

// ========== DATABASE SETUP ==========
const Database = require('better-sqlite3');
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'cws_safety.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Initialize database tables
db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        serial_number TEXT,
        employee_name TEXT NOT NULL,
        employee_id TEXT,
        employee_phone TEXT,
        client TEXT,
        location TEXT,
        incident_date TEXT,
        incident_time TEXT,
        reported_date TEXT,
        reported_time TEXT,
        injury_type TEXT,
        description TEXT,
        witness_name TEXT,
        witness_contact TEXT,
        body_parts TEXT,
        report_classification TEXT,
        reporter_name TEXT,
        reporter_position TEXT,
        medical_decline TEXT,
        drug_test TEXT,
        latitude REAL,
        longitude REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY,
        report_id TEXT,
        employee_name TEXT NOT NULL,
        insurance_carrier TEXT,
        claim_number TEXT,
        injury_date TEXT,
        injury_type TEXT,
        description TEXT,
        status TEXT DEFAULT 'open',
        client TEXT,
        body_parts TEXT,
        closed_at TEXT,
        report_classification TEXT DEFAULT 'accident',
        is_incident INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (report_id) REFERENCES reports(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        date TEXT,
        category TEXT,
        description TEXT,
        amount REAL,
        vendor TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES cases(id)
    );

    CREATE INDEX IF NOT EXISTS idx_reports_employee ON reports(employee_name);
    CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(incident_date);
    CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
    CREATE INDEX IF NOT EXISTS idx_cases_employee ON cases(employee_name);
    CREATE INDEX IF NOT EXISTS idx_expenses_case ON expenses(case_id);
`);

console.log('✅ Database initialized at:', DB_PATH);

// Seed Kevin Simion INCIDENT (not workers comp) if not exists
const kevinCase = db.prepare('SELECT id FROM cases WHERE employee_name LIKE ?').get('%Kevin Simion%');
if (!kevinCase) {
    const insertCase = db.prepare(`
        INSERT INTO cases (id, employee_name, insurance_carrier, claim_number, injury_date, injury_type, description, status, closed_at, report_classification, is_incident, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // Kevin Simion is an INCIDENT - no workers comp, just medical check
    insertCase.run('INC-2024-001', 'Kevin Simion', '', '', '2024-12-10', 'Other', 'Incident Report - Medical check completed. No injury, cleared to work.', 'closed', '2024-12-11', 'incident', 1, '2024-12-10T10:00:00.000Z');

    const insertExpense = db.prepare(`
        INSERT INTO expenses (id, case_id, date, category, description, amount, vendor, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertExpense.run('EXP-KS-001', 'INC-2024-001', '2024-12-11', 'medical', 'Medical Check', 0.00, '', 'Post-incident medical evaluation - cleared to work', '2024-12-11T09:00:00.000Z');
    console.log('✅ Kevin Simion INCIDENT seeded');
}

// Seed Geissa Romero case if not exists
const geissaCase = db.prepare('SELECT id FROM cases WHERE employee_name LIKE ?').get('%Geissa Romero%');
if (!geissaCase) {
    const insertCase = db.prepare(`
        INSERT INTO cases (id, employee_name, insurance_carrier, claim_number, injury_date, injury_type, description, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCase.run('WC-2024-001', 'Geissa Romero', 'Texas Mutual', '', '2024-12-11', 'Other', 'Workers compensation case', 'open', new Date().toISOString());

    const insertExpense = db.prepare(`
        INSERT INTO expenses (id, case_id, date, category, description, amount, vendor, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertExpense.run('EXP-GR-001', 'WC-2024-001', '2024-12-11', 'testing', 'Drug and Alcohol Test', 168.00, '', 'Initial post-incident testing', new Date().toISOString());
    console.log('✅ Geissa Romero case seeded');
}
// ========== END DATABASE SETUP ==========

const app = express();
const PORT = process.env.PORT || 3000;

// ========== AUTHENTICATION SYSTEM ==========
// Secure token storage (in-memory for simplicity, use Redis in production)
const activeTokens = new Map();
const TOKEN_EXPIRY_MS = parseInt(process.env.TOKEN_EXPIRY_MS) || 8 * 60 * 60 * 1000; // 8 hours default
const SUPERVISOR_PIN_HASH = process.env.SUPERVISOR_PIN_HASH || hashPin('4698'); // Default PIN hashed

// Hash function for PIN (using SHA-256 with salt)
function hashPin(pin) {
    const salt = process.env.PIN_SALT || 'cws-safety-2024';
    return crypto.createHash('sha256').update(pin + salt).digest('hex');
}

// Generate secure token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Validate token
function validateToken(token) {
    if (!token || !activeTokens.has(token)) {
        return false;
    }
    const tokenData = activeTokens.get(token);
    if (Date.now() > tokenData.expiresAt) {
        activeTokens.delete(token);
        return false;
    }
    return true;
}

// Cleanup expired tokens periodically
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of activeTokens.entries()) {
        if (now > data.expiresAt) {
            activeTokens.delete(token);
        }
    }
}, 60000); // Cleanup every minute
// ========== END AUTHENTICATION SYSTEM ==========

// Security middleware with CSP configuration
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"], // Allow inline scripts and CDN libraries
            scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick, etc.)
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"]
        }
    }
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, file://, etc.)
        if (!origin || origin === 'null') return callback(null, true);

        // Check if wildcard '*' is in allowed origins
        if (allowedOrigins.includes('*')) {
            return callback(null, true);
        }

        // Check if specific origin is allowed
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS policy: Origin not allowed'), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000, // 1 hour
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/send-email', limiter);

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify transporter configuration
transporter.verify(function(error, success) {
    if (error) {
        console.error('Email transporter configuration error:', error);
    } else {
        console.log('✅ Email server is ready to send messages');
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'CWS Injury Report Email Service',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// ========== AUTHENTICATION ENDPOINTS ==========

// Rate limiter for PIN authentication (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { success: false, error: 'Too many authentication attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// PIN Authentication endpoint
app.post('/api/auth/verify-pin', authLimiter, (req, res) => {
    try {
        const { pin } = req.body;

        if (!pin || typeof pin !== 'string' || pin.length !== 4) {
            return res.status(400).json({
                success: false,
                error: 'Invalid PIN format. PIN must be 4 digits.'
            });
        }

        // Hash the provided PIN and compare
        const providedPinHash = hashPin(pin);

        if (providedPinHash === SUPERVISOR_PIN_HASH) {
            // Generate secure token
            const token = generateToken();
            const expiresAt = Date.now() + TOKEN_EXPIRY_MS;

            // Store token
            activeTokens.set(token, {
                createdAt: Date.now(),
                expiresAt: expiresAt,
                ip: req.ip
            });

            console.log(`✅ Supervisor authenticated from IP: ${req.ip}`);

            return res.json({
                success: true,
                token: token,
                expiresAt: expiresAt,
                expiresIn: TOKEN_EXPIRY_MS
            });
        } else {
            console.log(`❌ Failed authentication attempt from IP: ${req.ip}`);
            return res.status(401).json({
                success: false,
                error: 'Invalid PIN'
            });
        }
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication service error'
        });
    }
});

// Token validation endpoint
app.post('/api/auth/validate-token', (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                valid: false,
                error: 'Token required'
            });
        }

        const isValid = validateToken(token);

        if (isValid) {
            const tokenData = activeTokens.get(token);
            return res.json({
                success: true,
                valid: true,
                expiresAt: tokenData.expiresAt,
                remainingMs: tokenData.expiresAt - Date.now()
            });
        } else {
            return res.json({
                success: true,
                valid: false,
                error: 'Token expired or invalid'
            });
        }
    } catch (error) {
        console.error('Token validation error:', error);
        return res.status(500).json({
            success: false,
            valid: false,
            error: 'Validation service error'
        });
    }
});

// Logout endpoint (invalidate token)
app.post('/api/auth/logout', (req, res) => {
    try {
        const { token } = req.body;

        if (token && activeTokens.has(token)) {
            activeTokens.delete(token);
            console.log(`✅ Token invalidated (logout)`);
        }

        return res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            success: false,
            error: 'Logout service error'
        });
    }
});

// Middleware to protect routes requiring authentication
function requireAuth(req, res, next) {
    const token = req.headers['x-auth-token'] || req.body.token;

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    if (!validateToken(token)) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }

    next();
}

// Protected endpoint example: Get cases data (for future API expansion)
app.get('/api/cases', requireAuth, (req, res) => {
    // This endpoint can be expanded to store cases server-side
    res.json({
        success: true,
        message: 'Authenticated access to cases',
        timestamp: new Date().toISOString()
    });
});

// ========== END AUTHENTICATION ENDPOINTS ==========

// ========== REPORTS API ENDPOINTS ==========

// Get all reports
app.get('/api/reports', (req, res) => {
    try {
        const reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
        res.json({ success: true, reports });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch reports' });
    }
});

// Get single report
app.get('/api/reports/:id', (req, res) => {
    try {
        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }
        res.json({ success: true, report });
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch report' });
    }
});

// Create report
app.post('/api/reports', (req, res) => {
    try {
        const data = req.body;
        const stmt = db.prepare(`
            INSERT INTO reports (id, serial_number, employee_name, employee_id, employee_phone, client, location,
                incident_date, incident_time, reported_date, reported_time, injury_type, description,
                witness_name, witness_contact, body_parts, report_classification, reporter_name,
                reporter_position, medical_decline, drug_test, latitude, longitude, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            data.reportId || data.id,
            data.serialNumber,
            data.employeeName,
            data.employeeId,
            data.employeePhone,
            data.client,
            data.location,
            data.incidentDate,
            data.incidentTime,
            data.reportedDate,
            data.reportedTime,
            data.injuryType,
            data.description,
            data.witnessName,
            data.witnessContact,
            JSON.stringify(data.bodyParts || []),
            data.reportClassification,
            data.reporterName,
            data.reporterPosition,
            JSON.stringify(data.medicalDecline || {}),
            JSON.stringify(data.drugTest || {}),
            data.latitude,
            data.longitude,
            data.timestamp || new Date().toISOString()
        );

        console.log(`✅ Report saved: ${data.reportId || data.id}`);
        res.json({ success: true, reportId: data.reportId || data.id });
    } catch (error) {
        console.error('Error saving report:', error);
        res.status(500).json({ success: false, error: 'Failed to save report' });
    }
});

// ========== CASES API ENDPOINTS ==========

// Get all cases with expenses
app.get('/api/cases', (req, res) => {
    try {
        const cases = db.prepare('SELECT * FROM cases ORDER BY created_at DESC').all();

        // Get expenses for each case
        const getExpenses = db.prepare('SELECT * FROM expenses WHERE case_id = ? ORDER BY date DESC');
        const casesWithExpenses = cases.map(c => ({
            ...c,
            bodyParts: c.body_parts ? JSON.parse(c.body_parts) : [],
            expenses: getExpenses.all(c.id)
        }));

        res.json({ success: true, cases: casesWithExpenses });
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch cases' });
    }
});

// Get single case with expenses
app.get('/api/cases/:id', (req, res) => {
    try {
        const caseData = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
        if (!caseData) {
            return res.status(404).json({ success: false, error: 'Case not found' });
        }

        const expenses = db.prepare('SELECT * FROM expenses WHERE case_id = ? ORDER BY date DESC').all(req.params.id);
        caseData.expenses = expenses;
        caseData.bodyParts = caseData.body_parts ? JSON.parse(caseData.body_parts) : [];

        res.json({ success: true, case: caseData });
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch case' });
    }
});

// Create case
app.post('/api/cases', (req, res) => {
    try {
        const data = req.body;
        const stmt = db.prepare(`
            INSERT INTO cases (id, report_id, employee_name, insurance_carrier, claim_number, injury_date,
                injury_type, description, status, client, body_parts, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            data.id,
            data.reportId || null,
            data.employeeName,
            data.insuranceCarrier || 'Texas Mutual',
            data.claimNumber || '',
            data.injuryDate,
            data.injuryType || 'Other',
            data.description,
            data.status || 'open',
            data.client || '',
            JSON.stringify(data.bodyParts || []),
            data.createdAt || new Date().toISOString()
        );

        console.log(`✅ Case saved: ${data.id}`);
        res.json({ success: true, caseId: data.id });
    } catch (error) {
        console.error('Error saving case:', error);
        res.status(500).json({ success: false, error: 'Failed to save case' });
    }
});

// Update case
app.put('/api/cases/:id', (req, res) => {
    try {
        const data = req.body;
        const stmt = db.prepare(`
            UPDATE cases SET
                employee_name = COALESCE(?, employee_name),
                insurance_carrier = COALESCE(?, insurance_carrier),
                claim_number = COALESCE(?, claim_number),
                injury_date = COALESCE(?, injury_date),
                injury_type = COALESCE(?, injury_type),
                description = COALESCE(?, description),
                status = COALESCE(?, status),
                client = COALESCE(?, client),
                closed_at = ?,
                updated_at = ?
            WHERE id = ?
        `);

        stmt.run(
            data.employeeName,
            data.insuranceCarrier,
            data.claimNumber,
            data.injuryDate,
            data.injuryType,
            data.description,
            data.status,
            data.client,
            data.status === 'closed' ? (data.closedAt || new Date().toISOString()) : null,
            new Date().toISOString(),
            req.params.id
        );

        console.log(`✅ Case updated: ${req.params.id}`);
        res.json({ success: true, caseId: req.params.id });
    } catch (error) {
        console.error('Error updating case:', error);
        res.status(500).json({ success: false, error: 'Failed to update case' });
    }
});

// ========== EXPENSES API ENDPOINTS ==========

// Add expense to case
app.post('/api/cases/:caseId/expenses', (req, res) => {
    try {
        const data = req.body;
        const stmt = db.prepare(`
            INSERT INTO expenses (id, case_id, date, category, description, amount, vendor, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            data.id,
            req.params.caseId,
            data.date,
            data.category,
            data.description,
            data.amount,
            data.vendor || '',
            data.notes || '',
            data.createdAt || new Date().toISOString()
        );

        console.log(`✅ Expense added to case ${req.params.caseId}: ${data.id}`);
        res.json({ success: true, expenseId: data.id });
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(500).json({ success: false, error: 'Failed to add expense' });
    }
});

// Delete expense
app.delete('/api/expenses/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
        console.log(`✅ Expense deleted: ${req.params.id}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ success: false, error: 'Failed to delete expense' });
    }
});

// ========== SYNC ENDPOINT ==========
// Bulk sync from frontend localStorage
app.post('/api/sync', (req, res) => {
    try {
        const { cases: clientCases } = req.body;
        let synced = 0;

        if (clientCases && Array.isArray(clientCases)) {
            const upsertCase = db.prepare(`
                INSERT OR REPLACE INTO cases (id, report_id, employee_name, insurance_carrier, claim_number,
                    injury_date, injury_type, description, status, client, body_parts, closed_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const upsertExpense = db.prepare(`
                INSERT OR REPLACE INTO expenses (id, case_id, date, category, description, amount, vendor, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const syncTransaction = db.transaction((cases) => {
                for (const c of cases) {
                    upsertCase.run(
                        c.id,
                        c.reportId || null,
                        c.employeeName,
                        c.insuranceCarrier || 'Texas Mutual',
                        c.claimNumber || '',
                        c.injuryDate,
                        c.injuryType || 'Other',
                        c.description || '',
                        c.status || 'open',
                        c.client || '',
                        JSON.stringify(c.bodyParts || []),
                        c.closedAt || null,
                        c.createdAt || new Date().toISOString(),
                        new Date().toISOString()
                    );

                    // Sync expenses
                    if (c.expenses && Array.isArray(c.expenses)) {
                        for (const exp of c.expenses) {
                            upsertExpense.run(
                                exp.id,
                                c.id,
                                exp.date,
                                exp.category,
                                exp.description,
                                exp.amount,
                                exp.vendor || '',
                                exp.notes || '',
                                exp.createdAt || new Date().toISOString()
                            );
                        }
                    }
                    synced++;
                }
            });

            syncTransaction(clientCases);
        }

        // Return all server cases
        const serverCases = db.prepare('SELECT * FROM cases ORDER BY created_at DESC').all();
        const getExpenses = db.prepare('SELECT * FROM expenses WHERE case_id = ?');
        const casesWithExpenses = serverCases.map(c => ({
            id: c.id,
            reportId: c.report_id,
            employeeName: c.employee_name,
            insuranceCarrier: c.insurance_carrier,
            claimNumber: c.claim_number,
            injuryDate: c.injury_date,
            injuryType: c.injury_type,
            description: c.description,
            status: c.status,
            client: c.client,
            bodyParts: c.body_parts ? JSON.parse(c.body_parts) : [],
            closedAt: c.closed_at,
            createdAt: c.created_at,
            expenses: getExpenses.all(c.id).map(e => ({
                id: e.id,
                date: e.date,
                category: e.category,
                description: e.description,
                amount: e.amount,
                vendor: e.vendor,
                notes: e.notes,
                createdAt: e.created_at
            }))
        }));

        console.log(`✅ Synced ${synced} cases from client`);
        res.json({ success: true, synced, cases: casesWithExpenses });
    } catch (error) {
        console.error('Error syncing:', error);
        res.status(500).json({ success: false, error: 'Failed to sync data' });
    }
});

// ========== KPI STATS ENDPOINT ==========
app.get('/api/stats', (req, res) => {
    try {
        const totalCases = db.prepare('SELECT COUNT(*) as count FROM cases').get().count;
        const openCases = db.prepare('SELECT COUNT(*) as count FROM cases WHERE status = ?').get('open').count;
        const closedCases = db.prepare('SELECT COUNT(*) as count FROM cases WHERE status = ?').get('closed').count;
        const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses').get().total;

        // Cases this month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const thisMonth = db.prepare('SELECT COUNT(*) as count FROM cases WHERE created_at >= ?').get(monthStart).count;

        // Cases by injury type
        const byInjuryType = db.prepare(`
            SELECT injury_type as type, COUNT(*) as count
            FROM cases
            GROUP BY injury_type
            ORDER BY count DESC
        `).all();

        // Cases by client
        const byClient = db.prepare(`
            SELECT client, COUNT(*) as count
            FROM cases
            WHERE client IS NOT NULL AND client != ''
            GROUP BY client
            ORDER BY count DESC
            LIMIT 5
        `).all();

        res.json({
            success: true,
            stats: {
                totalCases,
                openCases,
                closedCases,
                totalExpenses,
                thisMonth,
                closeRate: totalCases > 0 ? Math.round((closedCases / totalCases) * 100) : 0,
                byInjuryType,
                byClient
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// ========== END DATABASE API ENDPOINTS ==========

// Email sending endpoint
app.post('/api/send-email', async (req, res) => {
    try {
        const reportData = req.body;

        // Validate required fields
        if (!reportData.reportId || !reportData.employeeName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Format body parts list
        const bodyPartsList = reportData.bodyParts && reportData.bodyParts.length > 0
            ? reportData.bodyParts.join(', ')
            : 'None specified';

        // Create email HTML
        const emailHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .badge { display: inline-block; padding: 8px 20px; border-radius: 20px; font-weight: bold; margin: 15px 0; font-size: 14px; }
        .badge-incident { background: #f59e0b; color: white; }
        .badge-accident { background: #ef4444; color: white; }
        .content { padding: 20px; background: #f8fafc; }
        .section { background: white; padding: 20px; margin-bottom: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .section h2 { color: #0f172a; margin-top: 0; font-size: 18px; border-bottom: 2px solid #4ade80; padding-bottom: 10px; }
        .field { margin: 10px 0; }
        .label { font-weight: bold; color: #475569; }
        .value { color: #0f172a; }
        .alert { background: #dcfce7; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .footer { background: #0f172a; color: white; padding: 20px; text-align: center; font-size: 12px; }
        .footer-highlight { color: #4ade80; }
        img { max-width: 100%; height: auto; border-radius: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Safety Report Submitted</h1>
            <div class="badge badge-${reportData.reportClassification || 'accident'}">
                ${(reportData.reportClassification || 'ACCIDENT').toUpperCase()} REPORT
            </div>
        </div>

        <div class="content">
            <div class="section">
                <h2>📋 Report Information</h2>
                <div class="field">
                    <span class="label">Report ID:</span>
                    <span class="value">${reportData.reportId}</span>
                </div>
                <div class="field">
                    <span class="label">Serial Number:</span>
                    <span class="value">${reportData.serialNumber}</span>
                </div>
                <div class="field">
                    <span class="label">Classification:</span>
                    <span class="value">${(reportData.reportClassification || 'accident').toUpperCase()}</span>
                </div>
                <div class="field">
                    <span class="label">Submitted:</span>
                    <span class="value">${new Date(reportData.timestamp).toLocaleString('en-US', { timeZone: 'America/Chicago' })}</span>
                </div>
            </div>

            <div class="section">
                <h2>👤 Employee Information</h2>
                <div class="field">
                    <span class="label">Name:</span>
                    <span class="value">${reportData.employeeName}</span>
                </div>
                <div class="field">
                    <span class="label">Employee ID:</span>
                    <span class="value">${reportData.employeeId || 'Not provided'}</span>
                </div>
                <div class="field">
                    <span class="label">Cellphone:</span>
                    <span class="value">${reportData.employeePhone || 'Not provided'}</span>
                </div>
                <div class="field">
                    <span class="label">Client Company:</span>
                    <span class="value">${reportData.client}</span>
                </div>
            </div>

            <div class="section">
                <h2>📍 Incident Details</h2>
                <div class="field">
                    <span class="label">Date:</span>
                    <span class="value">${reportData.incidentDate} at ${reportData.incidentTime}</span>
                </div>
                <div class="field">
                    <span class="label">Reported On:</span>
                    <span class="value">${reportData.reportedDate} at ${reportData.reportedTime}</span>
                </div>
                <div class="field">
                    <span class="label">Complete Address:</span>
                    <span class="value">${reportData.location}</span>
                </div>
                <div class="field">
                    <span class="label">Type of Injury:</span>
                    <span class="value">${reportData.injuryType}</span>
                </div>
                <div class="field">
                    <span class="label">Description:</span>
                    <div class="value" style="background: #f8fafc; padding: 10px; border-radius: 5px; margin-top: 5px;">
                        ${reportData.description}
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>🩹 Injury Information</h2>
                <div class="field">
                    <span class="label">Affected Body Parts:</span>
                    <span class="value">${bodyPartsList}</span>
                </div>
                ${reportData.bodyDiagramImage ? `
                    <div class="field">
                        <span class="label">Body Diagram:</span><br>
                        <img src="cid:bodyDiagram" alt="Body Diagram" style="max-width: 300px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    </div>
                ` : ''}
            </div>

            ${reportData.witnessName ? `
            <div class="section">
                <h2>👁️ Witness Information</h2>
                <div class="field">
                    <span class="label">Name:</span>
                    <span class="value">${reportData.witnessName}</span>
                </div>
                ${reportData.witnessContact ? `
                <div class="field">
                    <span class="label">Contact:</span>
                    <span class="value">${reportData.witnessContact}</span>
                </div>
                ` : ''}
            </div>
            ` : ''}

            ${reportData.injuryPhoto && (Array.isArray(reportData.injuryPhoto) ? reportData.injuryPhoto.length > 0 : reportData.injuryPhoto) ? `
            <div class="section">
                <h2>📸 Injury Photo${Array.isArray(reportData.injuryPhoto) && reportData.injuryPhoto.length > 1 ? 's' : ''}</h2>
                ${Array.isArray(reportData.injuryPhoto)
                    ? reportData.injuryPhoto.map((photo, index) => `
                        <div style="margin-bottom: 15px;">
                            <p style="font-weight: bold; color: #1e3a5f; margin-bottom: 5px;">Photo ${index + 1} of ${reportData.injuryPhoto.length}:</p>
                            <img src="cid:injuryPhoto${index}" alt="Injury Photo ${index + 1}" style="border: 1px solid #e2e8f0; border-radius: 8px; max-width: 100%;">
                        </div>
                    `).join('')
                    : `<img src="cid:injuryPhoto" alt="Injury Photo" style="border: 1px solid #e2e8f0; border-radius: 8px;">`
                }
            </div>
            ` : ''}

            ${reportData.employeeSignature ? `
            <div class="section">
                <h2>✍️ Employee Signature</h2>
                <img src="cid:employeeSignature" alt="Employee Signature" style="max-width: 300px; border: 1px solid #e2e8f0; border-radius: 8px;">
            </div>
            ` : ''}

            <div class="section">
                <h2>📝 Reported By</h2>
                <div class="field">
                    <span class="label">Name:</span>
                    <span class="value">${reportData.reporterName}</span>
                </div>
                <div class="field">
                    <span class="label">Position:</span>
                    <span class="value">${reportData.reporterPosition}</span>
                </div>
            </div>

            <div class="alert">
                <strong>⚠️ Action Required:</strong> Please review this report and take appropriate action according to company safety protocols.
            </div>
        </div>

        <div class="footer">
            <p><strong>Custom Workforce Solutions LLC</strong></p>
            <p>Safety Management System</p>
            <p class="footer-highlight">Engineered by Safety Developer</p>
            <p style="margin-top: 10px; font-size: 11px; color: #94a3b8;">
                This is an automated message. All reports are confidential and should be handled according to OSHA guidelines.
            </p>
        </div>
    </div>
</body>
</html>
        `;

        // Prepare attachments
        const attachments = [];

        // Add body diagram as attachment if present
        if (reportData.bodyDiagramImage && reportData.bodyDiagramImage.startsWith('data:')) {
            attachments.push({
                filename: `body-diagram-${reportData.reportId}.png`,
                path: reportData.bodyDiagramImage,
                cid: 'bodyDiagram' // Content ID for inline embedding
            });
        }

        // Add injury photo(s) as attachment(s) if present
        if (reportData.injuryPhoto) {
            if (Array.isArray(reportData.injuryPhoto)) {
                // Handle multiple photos
                reportData.injuryPhoto.forEach((photo, index) => {
                    if (photo && photo.startsWith('data:')) {
                        attachments.push({
                            filename: `injury-photo-${index + 1}-${reportData.reportId}.jpg`,
                            path: photo,
                            cid: `injuryPhoto${index}`
                        });
                    }
                });
            } else if (reportData.injuryPhoto.startsWith('data:')) {
                // Handle single photo (backwards compatibility)
                attachments.push({
                    filename: `injury-photo-${reportData.reportId}.jpg`,
                    path: reportData.injuryPhoto,
                    cid: 'injuryPhoto'
                });
            }
        }

        // Add employee signature as attachment if present
        if (reportData.employeeSignature && reportData.employeeSignature.startsWith('data:')) {
            attachments.push({
                filename: `signature-${reportData.reportId}.png`,
                path: reportData.employeeSignature,
                cid: 'employeeSignature'
            });
        }

        // Add PDF attachment if present
        if (reportData.pdfData && reportData.pdfData.startsWith('data:')) {
            attachments.push({
                filename: `injury-report-${reportData.reportId}.pdf`,
                path: reportData.pdfData
            });
        }

        // Email configuration
        const mailOptions = {
            from: `"CWS Safety Reports" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: `[URGENT] ${(reportData.reportClassification || 'ACCIDENT').toUpperCase()} Report - ${reportData.employeeName} - ${reportData.reportId}`,
            html: emailHTML,
            cc: process.env.CC_EMAILS || undefined,
            bcc: process.env.BCC_EMAILS || undefined,
            attachments: attachments.length > 0 ? attachments : undefined
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);

        console.log('✅ Email sent successfully:', info.messageId);
        console.log('Report ID:', reportData.reportId);

        res.json({
            success: true,
            message: 'Email sent successfully',
            messageId: info.messageId,
            reportId: reportData.reportId
        });

    } catch (error) {
        console.error('❌ Error sending email:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send email',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║   CWS Injury Report Email Service             ║
║   Engineered by Safety Developer               ║
╠════════════════════════════════════════════════╣
║   Status: ✅ Running                           ║
║   Port: ${PORT.toString().padEnd(38)}      ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(29)} ║
║   Email: ${(process.env.EMAIL_USER || 'Not configured').padEnd(34)} ║
╚════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing server gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
