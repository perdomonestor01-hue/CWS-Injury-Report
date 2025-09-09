# JufipAI Website 🤖

Automated AI & Automation Services Website with bilingual support (English/Spanish).

## 🚀 Features

- **Bilingual Support**: ENG/ESP language toggle with complete translations
- **Interactive UI**: Blue metallic theme with animations and sound effects
- **Contact Form**: Direct integration with Google Sheets for lead capture
- **Welcome Overlays**: Spectacular customer onboarding experience
- **Automated Deployment**: GitHub Actions for continuous deployment
- **Responsive Design**: Mobile-optimized layout
- **Audio Integration**: Interactive sound feedback system

## 🔧 Automated Deployment

This website uses GitHub Actions for automated deployment to GitHub Pages.

### Setup Instructions:

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit with automated deployment"
   git remote add origin https://github.com/[your-username]/[your-repo-name].git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository settings
   - Navigate to "Pages" section
   - Set Source to "GitHub Actions"

3. **Automatic Updates**:
   - Every push to `main` branch triggers automatic deployment
   - Website updates live in ~2-3 minutes
   - No manual intervention required

## 📝 Adding New Features

Simply edit `index.html` and push changes:

```bash
git add index.html
git commit -m "Add new feature: [description]"
git push
```

The website will automatically update at: `https://[your-username].github.io/[your-repo-name]`

## 🌍 Language System

The website supports English and Spanish with:
- Persistent language preference (localStorage)
- Complete translation coverage
- Form field localization
- Dynamic content switching

## 📊 Google Sheets Integration

Contact form automatically sends data to Google Spreadsheet:
- Column A: Full Name
- Column B: Email Address
- Column C: Company Name
- Column D: Project Description  
- Column E: Timestamp

## 🎵 Interactive Features

- Welcome animations with particle effects
- Customer success overlays
- Service card tooltips
- Audio feedback system
- Smooth scrolling navigation

---

**Built with automation in mind** ⚡