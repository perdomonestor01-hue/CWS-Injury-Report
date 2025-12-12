const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ========== JSON FILE DATABASE SETUP ==========
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'cws_safety.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Database structure
let db = {
    reports: [],
    cases: [],
    expenses: []
};

// Load database from file
function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            db = JSON.parse(data);
            console.log('✅ Database loaded from:', DB_FILE);
        } else {
            // Initialize with seed data
            seedDatabase();
            saveDatabase();
            console.log('✅ Database initialized at:', DB_FILE);
        }
    } catch (error) {
        console.error('Error loading database:', error);
        seedDatabase();
        saveDatabase();
    }
}

// Save database to file
function saveDatabase() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (error) {
        console.error('Error saving database:', error);
    }
}

// Seed initial data
function seedDatabase() {
    // Kevin Simion INCIDENT (not workers comp)
    const kevinExists = db.cases.find(c => c.employeeName && c.employeeName.toLowerCase().includes('kevin simion'));
    if (!kevinExists) {
        db.cases.push({
            id: 'INC-2024-001',
            employeeName: 'Kevin Simion',
            reportClassification: 'incident',
            insuranceCarrier: '',
            claimNumber: '',
            injuryDate: '2024-12-10',
            injuryType: 'Other',
            description: 'Incident Report - Medical check completed. No injury, cleared to work.',
            status: 'closed',
            closedAt: '2024-12-11',
            client: '',
            isIncident: true,
            createdAt: '2024-12-10T10:00:00.000Z'
        });
        db.expenses.push({
            id: 'EXP-KS-001',
            caseId: 'INC-2024-001',
            date: '2024-12-11',
            category: 'medical',
            description: 'Medical Check',
            amount: 0.00,
            vendor: '',
            notes: 'Post-incident medical evaluation - cleared to work',
            createdAt: '2024-12-11T09:00:00.000Z'
        });
        console.log('✅ Kevin Simion INCIDENT seeded');
    }

    // Geissa Romero Workers Comp
    const geissaExists = db.cases.find(c => c.employeeName && c.employeeName.toLowerCase().includes('geissa romero'));
    if (!geissaExists) {
        db.cases.push({
            id: 'WC-2024-001',
            employeeName: 'Geissa Romero',
            reportClassification: 'accident',
            insuranceCarrier: 'Texas Mutual',
            claimNumber: '1425001472540',
            injuryDate: '2024-12-11',
            injuryType: 'Other',
            description: 'Workers compensation case',
            status: 'open',
            client: '',
            isIncident: false,
            createdAt: new Date().toISOString()
        });
        db.expenses.push({
            id: 'EXP-GR-001',
            caseId: 'WC-2024-001',
            date: '2024-12-11',
            category: 'testing',
            description: 'Drug and Alcohol Test',
            amount: 168.00,
            vendor: '',
            notes: 'Initial post-incident testing',
            createdAt: new Date().toISOString()
        });
        console.log('✅ Geissa Romero case seeded');
    }
}

// Initialize database
loadDatabase();
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
        const reports = [...db.reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json({ success: true, reports });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch reports' });
    }
});

// Get single report
app.get('/api/reports/:id', (req, res) => {
    try {
        const report = db.reports.find(r => r.id === req.params.id);
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
        const report = {
            id: data.reportId || data.id,
            serialNumber: data.serialNumber,
            employeeName: data.employeeName,
            employeeId: data.employeeId,
            employeePhone: data.employeePhone,
            client: data.client,
            location: data.location,
            incidentDate: data.incidentDate,
            incidentTime: data.incidentTime,
            reportedDate: data.reportedDate,
            reportedTime: data.reportedTime,
            injuryType: data.injuryType,
            description: data.description,
            witnessName: data.witnessName,
            witnessContact: data.witnessContact,
            bodyParts: data.bodyParts || [],
            reportClassification: data.reportClassification,
            reporterName: data.reporterName,
            reporterPosition: data.reporterPosition,
            medicalDecline: data.medicalDecline || {},
            drugTest: data.drugTest || {},
            latitude: data.latitude,
            longitude: data.longitude,
            createdAt: data.timestamp || new Date().toISOString()
        };

        db.reports.push(report);
        saveDatabase();

        console.log(`✅ Report saved: ${report.id}`);
        res.json({ success: true, reportId: report.id });
    } catch (error) {
        console.error('Error saving report:', error);
        res.status(500).json({ success: false, error: 'Failed to save report' });
    }
});

// ========== CASES API ENDPOINTS ==========

// Get all cases with expenses
app.get('/api/cases', (req, res) => {
    try {
        const casesWithExpenses = db.cases.map(c => ({
            ...c,
            expenses: db.expenses.filter(e => e.caseId === c.id)
        })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ success: true, cases: casesWithExpenses });
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch cases' });
    }
});

// Get single case with expenses
app.get('/api/cases/:id', (req, res) => {
    try {
        const caseData = db.cases.find(c => c.id === req.params.id);
        if (!caseData) {
            return res.status(404).json({ success: false, error: 'Case not found' });
        }

        const result = {
            ...caseData,
            expenses: db.expenses.filter(e => e.caseId === req.params.id)
        };

        res.json({ success: true, case: result });
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch case' });
    }
});

// Create case
app.post('/api/cases', (req, res) => {
    try {
        const data = req.body;
        const newCase = {
            id: data.id,
            reportId: data.reportId || null,
            employeeName: data.employeeName,
            reportClassification: data.reportClassification || 'accident',
            insuranceCarrier: data.insuranceCarrier || 'Texas Mutual',
            claimNumber: data.claimNumber || '',
            injuryDate: data.injuryDate,
            injuryType: data.injuryType || 'Other',
            description: data.description,
            status: data.status || 'open',
            client: data.client || '',
            bodyParts: data.bodyParts || [],
            isIncident: data.isIncident || false,
            createdAt: data.createdAt || new Date().toISOString()
        };

        db.cases.push(newCase);
        saveDatabase();

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
        const index = db.cases.findIndex(c => c.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Case not found' });
        }

        db.cases[index] = {
            ...db.cases[index],
            ...data,
            closedAt: data.status === 'closed' ? (data.closedAt || new Date().toISOString()) : db.cases[index].closedAt,
            updatedAt: new Date().toISOString()
        };
        saveDatabase();

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
        const expense = {
            id: data.id,
            caseId: req.params.caseId,
            date: data.date,
            category: data.category,
            description: data.description,
            amount: data.amount,
            vendor: data.vendor || '',
            notes: data.notes || '',
            createdAt: data.createdAt || new Date().toISOString()
        };

        db.expenses.push(expense);
        saveDatabase();

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
        const index = db.expenses.findIndex(e => e.id === req.params.id);
        if (index !== -1) {
            db.expenses.splice(index, 1);
            saveDatabase();
        }
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
            for (const c of clientCases) {
                // Upsert case
                const existingIndex = db.cases.findIndex(ec => ec.id === c.id);
                const caseData = {
                    id: c.id,
                    reportId: c.reportId || null,
                    employeeName: c.employeeName,
                    reportClassification: c.reportClassification || 'accident',
                    insuranceCarrier: c.insuranceCarrier || 'Texas Mutual',
                    claimNumber: c.claimNumber || '',
                    injuryDate: c.injuryDate,
                    injuryType: c.injuryType || 'Other',
                    description: c.description || '',
                    status: c.status || 'open',
                    client: c.client || '',
                    bodyParts: c.bodyParts || [],
                    isIncident: c.isIncident || false,
                    closedAt: c.closedAt || null,
                    createdAt: c.createdAt || new Date().toISOString()
                };

                if (existingIndex !== -1) {
                    db.cases[existingIndex] = caseData;
                } else {
                    db.cases.push(caseData);
                }

                // Sync expenses
                if (c.expenses && Array.isArray(c.expenses)) {
                    for (const exp of c.expenses) {
                        const expIndex = db.expenses.findIndex(e => e.id === exp.id);
                        const expenseData = {
                            id: exp.id,
                            caseId: c.id,
                            date: exp.date,
                            category: exp.category,
                            description: exp.description,
                            amount: exp.amount,
                            vendor: exp.vendor || '',
                            notes: exp.notes || '',
                            createdAt: exp.createdAt || new Date().toISOString()
                        };

                        if (expIndex !== -1) {
                            db.expenses[expIndex] = expenseData;
                        } else {
                            db.expenses.push(expenseData);
                        }
                    }
                }
                synced++;
            }
            saveDatabase();
        }

        // Return all server cases with expenses
        const casesWithExpenses = db.cases.map(c => ({
            ...c,
            expenses: db.expenses.filter(e => e.caseId === c.id)
        })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
        const totalCases = db.cases.length;
        const openCases = db.cases.filter(c => c.status === 'open').length;
        const closedCases = db.cases.filter(c => c.status === 'closed').length;
        const totalExpenses = db.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

        // Cases this month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonth = db.cases.filter(c => new Date(c.createdAt) >= monthStart).length;

        // Cases by injury type
        const injuryTypeCounts = {};
        db.cases.forEach(c => {
            const type = c.injuryType || 'Other';
            injuryTypeCounts[type] = (injuryTypeCounts[type] || 0) + 1;
        });
        const byInjuryType = Object.entries(injuryTypeCounts)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count);

        // Cases by client
        const clientCounts = {};
        db.cases.forEach(c => {
            if (c.client) {
                clientCounts[c.client] = (clientCounts[c.client] || 0) + 1;
            }
        });
        const byClient = Object.entries(clientCounts)
            .map(([client, count]) => ({ client, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

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
