# Test script for TransactionMail
$apiKey = "tm_live_NzkzMjdjM2YtODRiNy00ZTRhLTg4MWQt"
$apiUrl = "http://localhost:3000"

Write-Host "🧪 Testing TransactionMail API..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Health check
Write-Host "1️⃣ Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/health" -Method GET
    Write-Host "✅ API is healthy" -ForegroundColor Green
} catch {
    Write-Host "❌ API not responding. Make sure the server is running." -ForegroundColor Red
    exit 1
}

# Test 2: Send simple email
Write-Host ""
Write-Host "2️⃣ Sending test email..." -ForegroundColor Yellow
$body = @{
    to = "test@example.com"
    from = "noreply@transactionmail.local"
    subject = "Test Email from TransactionMail"
    text = "Hello! This is a test email sent via TransactionMail API."
    html = "<h1>Hello!</h1><p>This is a test email sent via <strong>TransactionMail</strong> API.</p>"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$apiUrl/v1/send" -Method POST -Headers @{
        "Authorization" = "Bearer $apiKey"
        "Content-Type" = "application/json"
    } -Body $body
    
    Write-Host "✅ Email queued successfully!" -ForegroundColor Green
    Write-Host "   Message ID: $($response.data.messageId)" -ForegroundColor Gray
    Write-Host "   Status: $($response.data.status)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to send email" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Test 3: Get messages
Write-Host ""
Write-Host "3️⃣ Fetching message list..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/v1/messages" -Method GET -Headers @{
        "Authorization" = "Bearer $apiKey"
    }
    Write-Host "✅ Found $($response.meta.pagination.total) messages" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to fetch messages" -ForegroundColor Red
}

# Test 4: Get templates
Write-Host ""
Write-Host "4️⃣ Fetching templates..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/v1/templates" -Method GET -Headers @{
        "Authorization" = "Bearer $apiKey"
    }
    Write-Host "✅ Found $($response.data.Count) templates" -ForegroundColor Green
    foreach ($template in $response.data) {
        Write-Host "   - $($template.name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Failed to fetch templates" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 Test completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📧 Check MailHog for the sent email: http://localhost:8025" -ForegroundColor Cyan
