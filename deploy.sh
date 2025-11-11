#!/bin/bash
set -e

echo "🔄 Running database migrations..."
npm run db:push -- --force

echo "🏗️  Building application..."
npm run build

echo "✅ Deployment build complete!"
