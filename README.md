# TransactionMail

Plateforme d'envoi d'emails transactionnels auto-hébergée avec API REST et SMTP Relay.

## Fonctionnalités

- **API REST** - Envoi d'emails via API avec templates, variables et pièces jointes
- **SMTP Relay** - Endpoint SMTP pour intégration avec applications existantes
- **File d'attente** - Redis + BullMQ pour traitement asynchrone avec retry
- **Templates** - Support HTML/text avec variables (syntaxe `{{variable}}`)
- **Webhooks** - Notifications d'événements (sent, delivered, bounced, failed)
- **Gestion de domaines** - Instructions DNS SPF/DKIM/DMARC
- **Liste de suppression** - Bounces et unsubscribes
- **Rate Limiting** - Protection anti-abus par API key
- **Idempotence** - Clés d'idempotence pour éviter les doublons
- **Dashboard Admin** - Interface web de gestion

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API (3000)    │────▶│  Redis Queue    │────▶│ Worker (BullMQ) │
│   Fastify       │     │                 │     │                 │
└────────┬────────┘     └─────────────────┘     └────────┬────────┘
         │                                               │
         │                                               ▼
         │                                        ┌─────────────────┐
         │                                        │   SMTP Server   │
         │                                        │   (MailHog/SMTP)│
         │                                        └─────────────────┘
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  (Prisma)       │
└─────────────────┘
```

## Stack Technique

- **Backend**: Node.js + TypeScript + Fastify
- **Base de données**: PostgreSQL (Prisma ORM)
- **Queue**: Redis + BullMQ
- **SMTP**: smtp-server (incoming), Nodemailer (outgoing)
- **Frontend**: Next.js + Tailwind CSS
- **Infra**: Docker Compose

## Démarrage Rapide

### Prérequis

- Docker et Docker Compose
- pnpm (optionnel pour le développement local)

### Installation

1. **Cloner et configurer**:
```bash
# Copier le fichier d'environnement
cp .env.example .env

# Modifier les variables si nécessaire
# Les valeurs par défaut fonctionnent pour le développement local
```

2. **Lancer avec Docker Compose**:
```bash
docker compose up -d
```

3. **Exécuter les migrations et le seed**:
```bash
docker compose run --rm migrate
```

Ou pour le développement local avec pnpm:
```bash
# Installer les dépendances
pnpm install

# Générer Prisma client
pnpm db:generate

# Exécuter les migrations
pnpm db:migrate

# Seeder la base de données
pnpm db:seed
```

### Services disponibles

| Service | URL | Description |
|---------|-----|-------------|
| API | http://localhost:3000 | API REST + Swagger |
| Admin | http://localhost:3001 | Dashboard admin |
| MailHog | http://localhost:8025 | Interface de test email |
| PostgreSQL | localhost:5432 | Base de données |
| Redis | localhost:6379 | Cache & Queue |
| SMTP Relay | localhost:2525 | Endpoint SMTP |

## Utilisation

### Envoyer un email via API

```bash
# Récupérer l'API key dans les logs du seed ou dans la base de données
curl -X POST http://localhost:3000/v1/send \
  -H "Authorization: Bearer tm_live_votre_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "destinataire@example.com",
    "from": "expediteur@transactionmail.local",
    "subject": "Test Email",
    "text": "Hello World!",
    "html": "<h1>Hello World!</h1>"
  }'
```

### Envoyer via un template

```bash
curl -X POST http://localhost:3000/v1/send \
  -H "Authorization: Bearer tm_live_votre_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "templateId": "welcome-email",
    "variables": {
      "firstName": "John",
      "companyName": "Acme Inc",
      "dashboardUrl": "https://app.example.com",
      "companyAddress": "123 Main St"
    }
  }'
```

### Envoyer via SMTP Relay

```bash
# Configuration SMTP
Host: localhost
Port: 2525
Username: demo-project-id  # ID du projet
Password: tm_live_votre_api_key  # Clé API
Security: None (STARTTLS désactivé en dev)

# Test avec swaks (si installé)
swaks --to destinataire@example.com \
  --from expediteur@transactionmail.local \
  --server localhost:2525 \
  --auth-user demo-project-id \
  --auth-password tm_live_votre_api_key \
  --header "Subject: Test SMTP"
```

### API Endpoints

| Méthode | Endpoint | Description | Scope |
|---------|----------|-------------|-------|
| GET | `/health` | Health check | - |
| POST | `/auth/login` | Connexion admin | - |
| POST | `/v1/send` | Envoyer un email | `send:email` |
| GET | `/v1/messages` | Liste des messages | `logs:read` |
| GET | `/v1/messages/:id` | Détails d'un message | `logs:read` |
| GET | `/v1/templates` | Liste des templates | `templates:read` |
| POST | `/v1/templates` | Créer un template | `templates:write` |
| GET | `/v1/webhooks` | Liste des webhooks | `webhooks:read` |
| POST | `/v1/webhooks` | Créer un webhook | `webhooks:write` |
| GET | `/v1/domains` | Liste des domaines | `domains:read` |
| POST | `/v1/domains` | Ajouter un domaine | `domains:write` |

### Dashboard Admin

Accéder à http://localhost:3001 et se connecter avec:
- Email: `admin@transactionmail.local`
- Password: `admin123`

## Configuration DNS

Pour envoyer des emails depuis votre propre domaine, configurez ces enregistrements DNS:

### SPF Record
```
Type: TXT
Host: @
Value: v=spf1 include:_spf.transactionmail.com ~all
```

### DKIM Record
```
Type: TXT
Host: <selector>._domainkey
Value: v=DKIM1; k=rsa; p=<public_key>
```

### DMARC Record
```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@votre-domaine.com
```

## Webhooks

Les webhooks sont signés avec HMAC-SHA256. Vérifiez la signature:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  const provided = signature.match(/v1=([a-f0-9]+)/)?.[1];
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(provided)
  );
}
```

## Développement

### Structure du projet

```
transactionmail/
├── apps/
│   ├── api/          # API REST + SMTP Relay
│   ├── worker/       # Queue workers
│   └── admin/        # Dashboard Next.js
├── packages/
│   ├── database/     # Prisma schema & client
│   └── shared/       # Types & utilitaires
├── docker-compose.yml
└── README.md
```

### Commandes utiles

```bash
# Démarrer en mode développement
pnpm dev

# Build
pnpm build

# Tests
pnpm test

# Base de données
pnpm db:studio    # Prisma Studio
pnpm db:migrate   # Nouvelle migration
pnpm db:seed      # Seeder

# Logs Docker
docker compose logs -f api
docker compose logs -f worker
```

## Production

### Checklist de sécurité

- [ ] Changer `JWT_SECRET`
- [ ] Changer `WEBHOOK_SECRET`
- [ ] Désactiver MailHog (`USE_MAILHOG=false`)
- [ ] Configurer un vrai serveur SMTP
- [ ] Activer TLS sur le SMTP relay
- [ ] Configurer HTTPS (reverse proxy)
- [ ] Mettre en place des backups PostgreSQL
- [ ] Configurer monitoring (logs, métriques)

### Variables d'environnement importantes

```bash
# Sécurité
JWT_SECRET=votre-secret-très-long-et-aléatoire
WEBHOOK_SECRET=un-autre-secret-très-long

# SMTP sortant
USE_MAILHOG=false
SMTP_OUT_HOST=smtp.sendgrid.net
SMTP_OUT_PORT=587
SMTP_OUT_USER=apikey
SMTP_OUT_PASS=votre-cle-api-sendgrid
SMTP_OUT_SECURE=true

# Rate limiting
RATE_LIMIT_MAX_REQUESTS=1000
```

## Troubleshooting

### Les emails ne partent pas
1. Vérifier que le worker est démarré: `docker compose ps`
2. Vérifier les logs: `docker compose logs worker`
3. Vérifier la connexion SMTP: `docker compose logs api`

### Erreur "Rate limit exceeded"
- Augmenter `RATE_LIMIT_MAX_REQUESTS` dans `.env`
- Vérifier le rate limiting Redis

### Problèmes de base de données
```bash
# Reset complet
docker compose down -v
docker compose up -d
docker compose run --rm migrate
```

## License

MIT
