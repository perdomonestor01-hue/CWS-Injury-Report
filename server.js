const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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
