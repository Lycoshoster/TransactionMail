#!/bin/bash
set -e

echo "🚀 TransactionMail Setup"
echo "========================"

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Aborting." >&2; exit 1; }

# Copy environment file if not exists
if [ ! -f .env ]; then
    echo "📄 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Start infrastructure
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis mailhog

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 5

# Run migrations
echo "🗄️ Running database migrations..."
docker-compose run --rm migrate

# Seed database
echo "🌱 Seeding database..."
docker-compose run --rm migrate npx prisma db seed

# Start application services
echo "🚀 Starting API and Worker..."
docker-compose up -d api worker admin

echo ""
echo "✅ Setup complete!"
echo ""
echo "Services available:"
echo "  📧 API:        http://localhost:3000"
echo "  🖥️  Admin:      http://localhost:3001"
echo "  📨 MailHog:    http://localhost:8025"
echo "  📚 API Docs:   http://localhost:3000/documentation"
echo ""
echo "Default credentials:"
echo "  Email: admin@transactionmail.local"
echo "  Password: admin123"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"
