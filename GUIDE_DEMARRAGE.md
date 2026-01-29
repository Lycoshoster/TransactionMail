# 🚀 TransactionMail - Guide de Démarrage

## ✅ Services démarrés

| Service | URL | Statut |
|---------|-----|--------|
| **API** | http://localhost:3000 | ✅ OK |
| **Admin Dashboard** | http://localhost:3001 | ✅ OK |
| **API Documentation** | http://localhost:3000/documentation | ✅ OK |
| **MailHog** | http://localhost:8025 | ✅ OK |

## 🔑 Identifiants

### Admin Dashboard
- **URL**: http://localhost:3001
- **Email**: `admin@transactionmail.local`
- **Password**: `admin123`

### API Key
```
tm_live_NzkzMjdjM2YtODRiNy00ZTRhLTg4MWQt
```

## 🧪 Test avec PowerShell

```powershell
$apiKey = "tm_live_NzkzMjdjM2YtODRiNy00ZTRhLTg4MWQt"
$headers = @{ "Authorization" = "Bearer $apiKey"; "Content-Type" = "application/json" }

# Envoyer un email
$body = @{ 
    to = "test@example.com"
    from = "noreply@transactionmail.local"
    subject = "Test Email"
    text = "Hello from TransactionMail!"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/v1/send" -Method POST -Headers $headers -Body $body

# Voir les messages
Invoke-RestMethod -Uri "http://localhost:3000/v1/messages" -Method GET -Headers $headers
```

## 🧪 Test avec curl (cmd)

```batch
curl -X POST http://localhost:3000/v1/send -H "Authorization: Bearer tm_live_NzkzMjdjM2YtODRiNy00ZTRhLTg4MWQt" -H "Content-Type: application/json" -d "{\"to\":\"test@example.com\",\"from\":\"noreply@transactionmail.local\",\"subject\":\"Test\",\"text\":\"Hello!\"}"
```

## 📧 Vérifier les emails

Ouvrez **MailHog** à http://localhost:8025 pour voir les emails envoyés.

## 📝 Templates disponibles

- **welcome-email** - Template de bienvenue avec variables: `firstName`, `companyName`, `dashboardUrl`, `companyAddress`

## 🛑 Arrêter les services

Fermez les fenêtres de commande ou exécutez :
```batch
docker-compose down
```

## 🔧 Fichiers de démarrage

- `start-api.bat` - Démarrer l'API
- `start-worker.bat` - Démarrer le Worker
- `start-admin.bat` - Démarrer le Dashboard
