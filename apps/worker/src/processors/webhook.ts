import { Job } from 'bullmq';
import { PrismaClient } from '@transactionmail/database';
import { WebhookJob, signWebhookPayload } from '@transactionmail/shared';
import { config } from '../config';

export class WebhookProcessor {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async process(job: Job<WebhookJob>): Promise<void> {
    const { webhookId, eventType, payload } = job.data;
    
    console.log(`🔔 Processing webhook job ${job.id} for webhook ${webhookId}`);

    // Fetch webhook
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      console.error(`Webhook ${webhookId} not found`);
      return;
    }

    if (!webhook.active) {
      console.log(`Webhook ${webhookId} is inactive, skipping`);
      return;
    }

    // Prepare payload
    const payloadString = JSON.stringify(payload);
    const signature = signWebhookPayload(payloadString, webhook.secret);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Id': webhook.id,
          'X-Event-Type': eventType,
          'User-Agent': 'TransactionMail-Webhook/1.0',
        },
        body: payloadString,
        signal: AbortSignal.timeout(30000),
      });

      // Record delivery
      await this.prisma.webhookDelivery.create({
        data: {
          webhookId,
          eventType,
          payload: payload as any,
          responseStatus: response.status,
          responseBody: await response.text().catch(() => null),
        },
      });

      if (response.ok) {
        console.log(`✅ Webhook delivered to ${webhook.url}: ${response.status}`);
        
        await this.prisma.webhook.update({
          where: { id: webhookId },
          data: {
            successCount: { increment: 1 },
            lastTriggeredAt: new Date(),
          },
        });
      } else {
        console.error(`❌ Webhook failed: ${response.status}`);
        
        await this.prisma.webhook.update({
          where: { id: webhookId },
          data: {
            failCount: { increment: 1 },
            lastTriggeredAt: new Date(),
          },
        });

        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Webhook delivery failed: ${errorMessage}`);

      // Record failed delivery
      await this.prisma.webhookDelivery.create({
        data: {
          webhookId,
          eventType,
          payload: payload as any,
          error: errorMessage,
        },
      });

      await this.prisma.webhook.update({
        where: { id: webhookId },
        data: {
          failCount: { increment: 1 },
          lastTriggeredAt: new Date(),
        },
      });

      throw error;
    }
  }

  async shutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
