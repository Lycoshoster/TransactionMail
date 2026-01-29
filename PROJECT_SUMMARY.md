# TransactionMail - Résumé du Projet

## Ce qui a été construit

### 1. Architecture Monorepo
```
transactionmail/
├── apps/
│   ├── api/          # API REST Fastify + SMTP Relay
│   ├── worker/       # Workers BullMQ (email + webhook)
│   └── admin/        # Dashboard Next.js
├── packages/
│   ├── database/     # Prisma ORM + schéma
│   └── shared/       # Types, schemas, utilitaires
└── docker-compose.yml
```

### 2. API REST (Fastify)
**Endpoints implémentés:**
- ✅ `GET /health` - Health check
- ✅ `POST /auth/login` - Authentification JWT
- ✅ `GET /auth/me` - Utilisateur courant
- ✅ `POST /v1/send` - Envoi d'emails
- ✅ `GET /v1/messages` - Liste des messages
- ✅ `GET /v1/messages/:id` - Détails d'un message
- ✅ `GET /v1/templates` - CRUD templates
- ✅ `POST /v1/templates` - Créer template
- ✅ `PATCH /v1/templates/:id` - Modifier template
- ✅ `DELETE /v1/templates/:id` - Supprimer template
- ✅ `GET /v1/webhooks` - CRUD webhooks
- ✅ `POST /v1/webhooks` - Créer webhook
- ✅ `POST /v1/webhooks/:id/test` - Test webhook
- ✅ `GET /v1/domains` - Liste des domaines
- ✅ `POST /v1/domains` - Ajouter un domaine
- ✅ `GET /v1/api-keys` - Gestion des clés API

**Fonctionnalités:**
- Authentification API Key (Bearer token)
- Rate limiting par projet
- Idempotence (clés uniques)
- Validation Zod
- Logs JSON structurés (Pino)
- Documentation Swagger/OpenAPI

### 3. SMTP Relay (Port 2525)
- Authentification LOGIN/PLAIN
- Username = Project ID
- Password = API Key
- Parser d'emails entrants (mailparser)
- Intégration avec la queue d'envoi

### 4. Worker (BullMQ)
**Queues:**
- `send-email` - Envoi via Nodemailer
- `webhook` - Delivery des webhooks

**Features:**
- Retry exponentiel avec jitter
- DLQ (Dead Letter Queue) automatique
- Suppression list (bounces)
- Webhook signing (HMAC)

### 5. Base de données (Prisma)
**Tables:**
- `users` - Utilisateurs admin
- `projects` - Projets clients
- `api_keys` - Clés API avec scopes
- `domains` - Domaines d'envoi + DNS
- `templates` - Templates email
- `messages` - Emails envoyés
- `events` - Événements (sent, delivered, etc.)
- `webhooks` - Config webhooks
- `webhook_deliveries` - Historique deliveries
- `suppressions` - Liste suppression
- `idempotency_keys` - Clés d'idempotence

### 6. Dashboard Admin (Next.js)
**Pages:**
- Login avec JWT
- Overview (stats)
- Messages (liste + pagination)
- Templates (CRUD)
- Webhooks (liste + test)
- Domains (DNS records modal)

### 7. Docker Compose
**Services:**
- PostgreSQL 16
- Redis 7
- MailHog (test SMTP)
- API (port 3000 + 2525 SMTP)
- Worker
- Admin (port 3001)
- Migrate (one-shot)

## Démarrage rapide

```bash
# 1. Cloner et entrer dans le dossier
cd transactionmail

# 2. Windows PowerShell
.\scripts\setup.ps1

# 3. Ou manuellement
cp .env.example .env
docker-compose up -d postgres redis mailhog
sleep 5
docker-compose run --rm migrate
docker-compose run --rm migrate npx prisma db seed
docker-compose up -d api worker admin
```

## URLs de test

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Admin | http://localhost:3001 |
| MailHog | http://localhost:8025 |
| API Docs | http://localhost:3000/documentation |

## Test rapide

```bash
# Récupérer la clé API depuis les logs du seed
curl -X POST http://localhost:3000/v1/send \
  -H "Authorization: Bearer tm_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "from": "noreply@transactionmail.local",
    "subject": "Test",
    "text": "Hello!"
  }'
```

## Fonctionnalités MVP complètes

✅ API REST d'envoi d'emails
✅ SMTP Relay
✅ Queue + Retry + DLQ
✅ Templates avec variables
✅ Webhooks signés
✅ Rate limiting
✅ Idempotence
✅ Dashboard admin
✅ Docker Compose complet
✅ Documentation README

## Pour aller plus loin

1. **Tests** - Ajouter plus de tests unitaires/intégration
2. **Monitoring** - Prometheus/Grafana
3. **TLS** - Certificats SSL pour SMTP relay
4. **Multi-provider** - SES, SendGrid, Brevo
5. **Bounce handling** - Endpoint pour recevoir bounces
6. **Analytics** - Stats d'ouverture/click
7. **i18n** - Internationalisation
