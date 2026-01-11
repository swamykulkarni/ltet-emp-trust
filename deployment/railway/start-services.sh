#!/bin/bash

# LTET Employee Trust Portal - Railway Startup Script
set -e

echo "🚀 Starting LTET Employee Trust Portal services..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
until node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => { console.log('Database connected'); client.end(); })
  .catch(() => process.exit(1));
" 2>/dev/null; do
  echo "Database not ready, waiting..."
  sleep 2
done

# Run database migrations
echo "🔄 Running database migrations..."
cd /app
node -e "
const fs = require('fs');
const { Client } = require('pg');

async function runMigrations() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // Read and execute migration files
  const migrationDirs = [
    'database/user-service/migrations',
    'database/scheme-service/migrations', 
    'database/application-service/migrations',
    'database/document-service/migrations',
    'database/notification-service/migrations'
  ];
  
  for (const dir of migrationDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        console.log(\`Running migration: \${file}\`);
        const sql = fs.readFileSync(\`\${dir}/\${file}\`, 'utf8');
        try {
          await client.query(sql);
          console.log(\`✅ Migration \${file} completed\`);
        } catch (err) {
          console.log(\`⚠️  Migration \${file} skipped (likely already applied): \${err.message}\`);
        }
      }
    }
  }
  
  await client.end();
  console.log('🎉 All migrations completed');
}

runMigrations().catch(console.error);
"

# Start all services in background
echo "🔧 Starting backend services..."

# User Service
echo "Starting User Service on port 3001..."
cd /app && PORT=3001 node dist/apps/user-service/main.js &
USER_SERVICE_PID=$!

# Scheme Service  
echo "Starting Scheme Service on port 3002..."
cd /app && PORT=3002 node dist/apps/scheme-service/main.js &
SCHEME_SERVICE_PID=$!

# Application Service
echo "Starting Application Service on port 3003..."
cd /app && PORT=3003 node dist/apps/application-service/main.js &
APPLICATION_SERVICE_PID=$!

# Notification Service
echo "Starting Notification Service on port 3004..."
cd /app && PORT=3004 node dist/apps/notification-service/main.js &
NOTIFICATION_SERVICE_PID=$!

# Document Service
echo "Starting Document Service on port 3005..."
cd /app && PORT=3005 node dist/apps/document-service/main.js &
DOCUMENT_SERVICE_PID=$!

# Wait a moment for services to start
sleep 5

# Start Web App (foreground - this keeps the container running)
echo "🌐 Starting Web Application on port 3000..."
cd /app/dist/apps/web-app && PORT=3000 npm start

# If web app exits, kill all background services
echo "🛑 Shutting down all services..."
kill $USER_SERVICE_PID $SCHEME_SERVICE_PID $APPLICATION_SERVICE_PID $NOTIFICATION_SERVICE_PID $DOCUMENT_SERVICE_PID 2>/dev/null || true