import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config';
import { EmailProcessor } from './processors/email';
import { WebhookProcessor } from './processors/webhook';
import type { SendEmailJob, WebhookJob } from '@transactionmail/shared';

class WorkerService {
  private redis: IORedis;
  private emailWorker: Worker<SendEmailJob>;
  private webhookWorker: Worker<WebhookJob>;
  private emailProcessor: EmailProcessor;
  private webhookProcessor: WebhookProcessor;

  constructor() {
    this.redis = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.emailProcessor = new EmailProcessor();
    this.webhookProcessor = new WebhookProcessor();

    // Create workers
    this.emailWorker = new Worker<SendEmailJob>(
      'send-email',
      async (job) => this.emailProcessor.process(job),
      {
        connection: this.redis,
        prefix: config.queue.prefix,
        concurrency: config.queue.concurrency,
        limiter: {
          max: 100,
          duration: 1000, // 100 emails per second max
        },
      }
    );

    this.webhookWorker = new Worker<WebhookJob>(
      'webhook',
      async (job) => this.webhookProcessor.process(job),
      {
        connection: this.redis,
        prefix: config.queue.prefix,
        concurrency: 20,
      }
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Email worker events
    this.emailWorker.on('completed', (job: Job) => {
      console.log(`✅ Email job ${job.id} completed`);
    });

    this.emailWorker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`❌ Email job ${job?.id} failed:`, err.message);
    });

    // Retry event handled by failed with willRetry flag
    this.emailWorker.on('progress', (job: Job) => {
      console.log(`🔄 Email job ${job.id} progress updated`);
    });

    // Webhook worker events
    this.webhookWorker.on('completed', (job: Job) => {
      console.log(`✅ Webhook job ${job.id} completed`);
    });

    this.webhookWorker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`❌ Webhook job ${job?.id} failed:`, err.message);
    });

    // Error handling
    this.emailWorker.on('error', (err: Error) => {
      console.error('Email worker error:', err);
    });

    this.webhookWorker.on('error', (err: Error) => {
      console.error('Webhook worker error:', err);
    });
  }

  async start(): Promise<void> {
    console.log('🚀 Starting TransactionMail Worker...');
    
    // Initialize processors
    await this.emailProcessor.initialize();
    
    console.log('✅ Workers started');
    console.log(`   - Email worker: concurrency=${config.queue.concurrency}`);
    console.log(`   - Webhook worker: concurrency=20`);

    // Keep process alive
    await new Promise(() => {});
  }

  async stop(): Promise<void> {
    console.log('\n🛑 Shutting down workers...');
    
    await this.emailWorker.close();
    await this.webhookWorker.close();
    await this.redis.quit();
    await this.emailProcessor.shutdown();
    await this.webhookProcessor.shutdown();
    
    console.log('✅ Workers stopped');
    process.exit(0);
  }
}

// Start worker
const workerService = new WorkerService();

// Handle graceful shutdown
process.on('SIGTERM', () => workerService.stop());
process.on('SIGINT', () => workerService.stop());

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  workerService.stop();
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

workerService.start().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});
