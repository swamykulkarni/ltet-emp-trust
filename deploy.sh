#!/bin/bash

echo "🚀 Starting LTET Portal Deployment..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login check
echo "Checking Railway authentication..."
railway whoami || {
    echo "❌ Please login to Railway first: railway login"
    exit 1
}

# Deploy
echo "📦 Deploying to Railway..."
railway up --detach

echo "✅ Deployment initiated!"
echo "🌐 Check status at: https://railway.app/dashboard"
echo "🔗 Live URL: https://ltet-portal-production.up.railway.app"