# 🚀 Deploy Hyderabad Transport Resilience App to GitHub Pages

This guide will help you deploy your React-based resilience app to GitHub Pages so anyone can access it online.

---

## 📋 Prerequisites

1. **GitHub Account**: Create one at [github.com](https://github.com) if you don't have one
2. **Git Installed**: Check with `git --version` in terminal
3. **Node.js Installed**: Check with `node --version` (should be v14 or higher)

---

## 🎯 Step-by-Step Deployment Guide

### Step 1: Create a GitHub Repository

1. Go to [github.com](https://github.com) and log in
2. Click the **"+"** icon in top-right corner → **"New repository"**
3. Repository settings:
   - **Repository name**: `hyderabad-transport-resilience` (or any name you prefer)
   - **Description**: "Hyderabad Transport Network Resilience & Greedy Recommender"
   - **Visibility**: Choose **Public** (required for free GitHub Pages)
   - **DON'T** initialize with README, .gitignore, or license (we already have files)
4. Click **"Create repository"**

---

### Step 2: Update package.json with Your GitHub Details

Open `package.json` and update the `homepage` field:

```json
"homepage": "https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME"
```

**Example**: If your GitHub username is `john-doe` and repo name is `hyderabad-transport-resilience`:
```json
"homepage": "https://john-doe.github.io/hyderabad-transport-resilience"
```

**⚠️ IMPORTANT**: Replace `YOUR_GITHUB_USERNAME` and `YOUR_REPO_NAME` with your actual values!

---

### Step 3: Install gh-pages Package

Open terminal in the `resilience-app` folder and run:

```bash
npm install gh-pages --save-dev
```

This package automates deployment to GitHub Pages.

---

### Step 4: Initialize Git Repository (First Time Only)

If this is your first time setting up git in this folder:

```bash
# Navigate to resilience-app folder
cd resilience-app

# Initialize git repository
git init

# Add all files
git add .

# Commit files
git commit -m "Initial commit: Hyderabad Transport Resilience App"

# Add your GitHub repository as remote
# Replace YOUR_USERNAME and YOUR_REPO_NAME with your actual values
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Example**:
```bash
git remote add origin https://github.com/john-doe/hyderabad-transport-resilience.git
```

---

### Step 5: Deploy to GitHub Pages

Run the deploy command:

```bash
npm run deploy
```

This will:
1. Build your React app (creates optimized production files)
2. Create a `gh-pages` branch
3. Push the build files to GitHub
4. Make your app live!

**⏱️ Wait Time**: First deployment may take 2-3 minutes.

---

### Step 6: Enable GitHub Pages (First Time Only)

1. Go to your GitHub repository
2. Click **"Settings"** tab
3. Scroll down to **"Pages"** in left sidebar
4. Under **"Source"**, it should already show:
   - Branch: `gh-pages`
   - Folder: `/ (root)`
5. If not, select `gh-pages` branch and click **Save**
6. Wait a minute, then refresh the page
7. You'll see: **"Your site is live at https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/"**

---

### Step 7: Access Your Live App! 🎉

Your app is now live at:
```
https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME
```

Share this link with anyone!

---

## 🔄 Updating Your Deployed App

Whenever you make changes to your code:

```bash
# 1. Save your changes and commit
git add .
git commit -m "Description of your changes"
git push origin main

# 2. Deploy updated version
npm run deploy
```

Your live site will update in 1-2 minutes.

---

## 📊 About Your Data Files

Your app uses two CSV files:
- `nodes.csv` (59 KB) - Network nodes/stations
- `edges.csv` (856 KB) - Network connections

These files are located in `public/` folder and will be automatically deployed with your app.

**✅ Your app loads these files correctly** - they're already in the right place!

---

## 🐛 Troubleshooting

### Problem: Blank page after deployment
**Solution**: Check the `homepage` field in `package.json` matches your GitHub Pages URL exactly.

### Problem: "Failed to load resource" errors
**Solution**: 
1. Check browser console (F12 → Console tab)
2. Ensure `nodes.csv` and `edges.csv` are in `public/` folder
3. Rebuild and redeploy: `npm run deploy`

### Problem: Git errors during push
**Solution**:
```bash
# Configure git user (first time only)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Problem: npm install fails
**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📂 Project Structure

```
resilience-app/
├── public/
│   ├── nodes.csv          ✅ Network nodes data
│   ├── edges.csv          ✅ Network edges data
│   ├── index.html         ✅ HTML template
│   └── manifest.json      ✅ PWA config
├── src/
│   ├── App.js             ✅ Main application
│   ├── components/        ✅ React components
│   └── utils/             ✅ Graph algorithms
├── package.json           ✅ Updated with homepage & deploy script
└── GITHUB_DEPLOYMENT.md   📖 This file
```

---

## 🔒 Important Notes

1. **Public Repository Required**: GitHub Pages free tier only works with public repos
2. **Data Size**: Your CSV files (915 KB total) are well within GitHub's limits
3. **Updates**: Always run `npm run deploy` after making changes
4. **Branch**: Don't manually edit the `gh-pages` branch - it's auto-generated
5. **HTTPS**: Your site will automatically use HTTPS

---

## 📞 Need Help?

- **GitHub Pages Docs**: https://pages.github.com/
- **Create React App Deployment**: https://create-react-app.dev/docs/deployment/#github-pages
- **gh-pages Package**: https://www.npmjs.com/package/gh-pages

---

## ✅ Quick Checklist

Before deploying, ensure:
- [ ] Updated `homepage` in package.json with YOUR GitHub username and repo name
- [ ] Installed `gh-pages`: `npm install gh-pages --save-dev`
- [ ] Created GitHub repository (public)
- [ ] `nodes.csv` and `edges.csv` are in `public/` folder ✅
- [ ] Committed all files to git
- [ ] Run `npm run deploy`
- [ ] Enabled GitHub Pages in repository settings

---

## 🎊 Success!

Once deployed, anyone can access your Hyderabad Transport Resilience portal by visiting your GitHub Pages URL. The app will work exactly as it does locally, with all features including:

- Network visualization
- Resilience analysis
- Greedy route recommendations
- Interactive maps
- All your transport data

**Share your link and enjoy! 🚀**
