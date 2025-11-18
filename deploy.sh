#!/bin/bash

# Deployment script for Hyderabad Transport Resilience App to GitHub Pages
# This script automates the build and deployment process

set -e  # Exit on error

echo "🚀 Starting deployment to GitHub Pages..."
echo ""

# Check if we're in the resilience-app directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the resilience-app directory."
    exit 1
fi

# Check if gh-pages is installed
if ! grep -q "gh-pages" package.json; then
    echo "📦 Installing gh-pages..."
    npm install gh-pages --save-dev
fi

# Check if homepage is set in package.json
if grep -q "YOUR_GITHUB_USERNAME" package.json; then
    echo "⚠️  WARNING: You need to update the 'homepage' field in package.json!"
    echo "   Replace YOUR_GITHUB_USERNAME and YOUR_REPO_NAME with your actual GitHub details."
    echo ""
    read -p "Have you updated the homepage field? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled. Please update package.json first."
        exit 1
    fi
fi

# Verify data files exist
echo "📊 Checking data files..."
if [ ! -f "public/nodes.csv" ]; then
    echo "❌ Error: public/nodes.csv not found!"
    exit 1
fi
if [ ! -f "public/edges.csv" ]; then
    echo "❌ Error: public/edges.csv not found!"
    exit 1
fi
echo "✅ Data files found (nodes.csv & edges.csv)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Build and deploy
echo "🔨 Building React app..."
npm run build
echo ""

echo "🚀 Deploying to GitHub Pages..."
npm run deploy
echo ""

echo "✅ Deployment complete!"
echo ""
echo "🎉 Your app should be live in 1-2 minutes at:"
grep "homepage" package.json | sed 's/.*"homepage": "\(.*\)".*/\1/'
echo ""
echo "💡 Tip: If this is your first deployment, make sure GitHub Pages is enabled in your repository settings."
