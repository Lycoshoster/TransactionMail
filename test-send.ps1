$apiKey = "tm_live_NzkzMjdjM2YtODRiNy00ZTRhLTg4MWQt"
$headers = @{ "Authorization" = "Bearer $apiKey"; "Content-Type" = "application/json" }
$body = @{ 
    to = "user@example.com"
    from = "noreply@transactionmail.local"
    subject = "Test Email - $(Get-Date -Format 'HH:mm:ss')"
    text = "This is a test email sent at $(Get-Date)"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/v1/send" -Method POST -Headers $headers -Body $body
    Write-Host "✅ Email queued!" -ForegroundColor Green
    Write-Host "Message ID: $($response.data.messageId)" -ForegroundColor Gray
    Write-Host "Status: $($response.data.status)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
