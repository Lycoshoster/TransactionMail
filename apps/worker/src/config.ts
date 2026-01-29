import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export const config = {
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/transactionmail',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Queue
  queue: {
    prefix: 'tm:',
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10', 10),
  },
  
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
  useMailHog: process.env.USE_MAILHOG !== 'false', // Default true for dev
  mailHog: {
    host: process.env.MAILHOG_SMTP_HOST || 'localhost',
    port: parseInt(process.env.MAILHOG_SMTP_PORT || '1025', 10),
  },
  
  // Retry configuration
  retry: {
    maxAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
    backoffMultiplier: parseInt(process.env.RETRY_BACKOFF_MULTIPLIER || '2', 10),
    initialDelayMs: parseInt(process.env.RETRY_INITIAL_DELAY_MS || '5000', 10),
    maxDelayMs: parseInt(process.env.RETRY_MAX_DELAY_MS || '60000', 10),
  },
  
  // Logging
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
} as const;
