# Quick Start Guide for GitHub Pages Deployment

## 📝 Before You Start - MUST DO!

1. **Update package.json**: Open `package.json` and change this line:
   ```json
   "homepage": "https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME"
   ```
   
   Replace with YOUR actual GitHub username and repository name!
   
   Example:
   ```json
   "homepage": "https://john-doe.github.io/hyderabad-transport-resilience"
   ```

## 🚀 Quick Deployment (3 Methods)

### Method 1: Using the Automated Script (Easiest)

```bash
cd resilience-app
./deploy.sh
```

### Method 2: Manual Commands

```bash
cd resilience-app

# Install deployment package
npm install gh-pages --save-dev

# Deploy
npm run deploy
```

### Method 3: Complete First-Time Setup

```bash
cd resilience-app

# 1. Install dependencies
npm install
npm install gh-pages --save-dev

# 2. Initialize git (if not done)
git init
git add .
git commit -m "Initial commit"

# 3. Add GitHub remote (replace with YOUR details!)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main

# 4. Deploy to GitHub Pages
npm run deploy
```

## ✅ What's Already Configured

✅ **Data files**: nodes.csv (59 KB) and edges.csv (856 KB) are in `public/` folder  
✅ **Deploy scripts**: Added to `package.json`  
✅ **gh-pages package**: Listed in devDependencies  
✅ **.gitignore**: Created to exclude node_modules and build files  
✅ **Deployment script**: `deploy.sh` for automated deployment  

## 📖 Need More Details?

Read the complete guide: **GITHUB_DEPLOYMENT.md**

## 🔗 After Deployment

Your app will be live at:
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME
```

Enable GitHub Pages in repository settings → Settings → Pages → Select `gh-pages` branch

## 💡 Update Your Live Site

```bash
git add .
git commit -m "Your changes"
git push origin main
npm run deploy
```

Done! 🎉
