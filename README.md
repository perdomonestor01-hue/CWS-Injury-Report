# CWS Injury Report Email Service

Backend service for sending injury report emails via Google Workspace SMTP.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and add your Google Workspace App Password:
```env
EMAIL_USER=safety@customworkforcesolutionsllc.com
EMAIL_PASS=your_16_character_app_password
```

### 3. Run Locally
```bash
npm start
```

Server will run on http://localhost:3000

### 4. Test
```bash
curl http://localhost:3000/api/health
```

## Deployment Options

### Railway (Recommended)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

1. Click button above
2. Connect your GitHub account
3. Add environment variables in Railway dashboard
4. Deploy!

### Render

1. Create new Web Service on Render.com
2. Connect this repository
3. Set environment variables
4. Deploy

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow prompts
4. Set environment variables in dashboard

## API Endpoints

### Health Check
```
GET /api/health
```

Returns server status.

### Send Email
```
POST /api/send-email
Content-Type: application/json

{
  "reportId": "CWS-1001-2025-11-06",
  "employeeName": "John Doe",
  "reportClassification": "accident",
  ...
}
```

Returns:
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "...",
  "reportId": "CWS-1001-2025-11-06"
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `EMAIL_USER` | Google Workspace email | Yes |
| `EMAIL_PASS` | Google App Password | Yes |
| `PORT` | Server port | No (default: 3000) |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | No |
| `CC_EMAILS` | CC recipients (comma-separated) | No |
| `BCC_EMAILS` | BCC recipients (comma-separated) | No |

## Security

- Rate limiting: 10 requests/hour per IP
- Helmet.js for security headers
- CORS protection
- Input validation
- No credentials in code

## Support

Engineered by Jufipai
