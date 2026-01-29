import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.API_PORT || '3000', 10),
  host: process.env.API_HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/transactionmail',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: '7d',
  
  // SMTP Relay (incoming)
  smtpRelayPort: parseInt(process.env.SMTP_RELAY_PORT || '2525', 10),
  smtpRelayHost: process.env.SMTP_RELAY_HOST || '0.0.0.0',
  
  // SMTP Outgoing
  smtpOut: {
    host: process.env.SMTP_OUT_HOST || 'localhost',
    port: parseInt(process.env.SMTP_OUT_PORT || '1025', 10),
    secure: process.env.SMTP_OUT_SECURE === 'true',
    user: process.env.SMTP_OUT_USER || '',
    pass: process.env.SMTP_OUT_PASS || '',
    from: process.env.SMTP_OUT_FROM || 'noreply@transactionmail.local',
  },
  
  // Use MailHog for testing
  useMailHog: process.env.USE_MAILHOG === 'true',
  mailHog: {
    host: process.env.MAILHOG_SMTP_HOST || 'localhost',
    port: parseInt(process.env.MAILHOG_SMTP_PORT || '1025', 10),
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  // Webhook
  webhookSecret: process.env.WEBHOOK_SECRET || 'webhook-secret-change-in-production',
  
  // Queue
  queue: {
    prefix: 'tm:',
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  },
} as const;
