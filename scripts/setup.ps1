# TransactionMail Setup Script for Windows
# Requires: Docker Desktop with WSL2

Write-Host "🚀 TransactionMail Setup" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

# Check prerequisites
try {
    docker version | Out-Null
    Write-Host "✅ Docker found" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is required but not installed. Aborting." -ForegroundColor Red
    exit 1
}

# Copy environment file if not exists
if (-not (Test-Path .env)) {
    Write-Host "📄 Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✅ .env file created" -ForegroundColor Green
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

# Start infrastructure
Write-Host "🐳 Starting Docker services..." -ForegroundColor Yellow
docker-compose up -d postgres redis mailhog

# Wait for services
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Run migrations
Write-Host "🗄️ Running database migrations..." -ForegroundColor Yellow
docker-compose run --rm migrate

# Seed database
Write-Host "🌱 Seeding database..." -ForegroundColor Yellow
docker-compose run --rm migrate npx prisma db seed

# Start application services
Write-Host "🚀 Starting API and Worker..." -ForegroundColor Yellow
docker-compose up -d api worker admin

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Services available:" -ForegroundColor Cyan
Write-Host "  📧 API:        http://localhost:3000"
Write-Host "  🖥️  Admin:      http://localhost:3001"
Write-Host "  📨 MailHog:    http://localhost:8025"
Write-Host "  📚 API Docs:   http://localhost:3000/documentation"
Write-Host ""
Write-Host "Default credentials:" -ForegroundColor Cyan
Write-Host "  Email: admin@transactionmail.local"
Write-Host "  Password: admin123"
Write-Host ""
Write-Host "To view logs: docker-compose logs -f" -ForegroundColor Gray
Write-Host "To stop: docker-compose down" -ForegroundColor Gray
