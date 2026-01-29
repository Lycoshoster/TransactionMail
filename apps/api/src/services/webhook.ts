import { FastifyInstance } from 'fastify';
import { PrismaClient, Webhook } from '@transactionmail/database';
import { WebhookPayload, WebhookJob, signWebhookPayload } from '@transactionmail/shared';
import { config } from '../config';

export class WebhookService {
  constructor(
    private prisma: PrismaClient,
    private queues: FastifyInstance['queues']
  ) {}

  /**
   * Trigger webhook for a specific event
   */
  async trigger(
    projectId: string,
    eventType: WebhookPayload['event'],
    data: Record<string, unknown>
  ): Promise<void> {
    // Find active webhooks for this event type
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        projectId,
        active: true,
        eventTypes: {
          has: eventType,
        },
      },
    });

    if (webhooks.length === 0) return;

    const payload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    // Queue webhook delivery for each webhook
    for (const webhook of webhooks) {
      const jobData: WebhookJob = {
        webhookId: webhook.id,
        eventType,
        payload,
      };

      await this.queues.webhook.add(
        `webhook:${webhook.id}:${Date.now()}`,
        jobData,
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }
      );
    }
  }

  /**
   * Deliver webhook to endpoint
   */
  async deliver(
    webhook: Webhook,
    payload: WebhookPayload
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const payloadString = JSON.stringify(payload);
    const signature = signWebhookPayload(payloadString, webhook.secret);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Id': webhook.id,
          'X-Event-Type': payload.event,
          'User-Agent': 'TransactionMail-Webhook/1.0',
        },
        body: payloadString,
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      // Record delivery
      await this.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          eventType: payload.event,
          payload: payload as any,
          responseStatus: response.status,
          responseBody: await response.text().catch(() => null),
        },
      });

      // Update webhook stats
      if (response.ok) {
        await this.prisma.webhook.update({
          where: { id: webhook.id },
          data: {
            successCount: { increment: 1 },
            lastTriggeredAt: new Date(),
          },
        });
      } else {
        await this.prisma.webhook.update({
          where: { id: webhook.id },
          data: {
            failCount: { increment: 1 },
            lastTriggeredAt: new Date(),
          },
        });
      }

      return {
        success: response.ok,
        statusCode: response.status,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Record failed delivery
      await this.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          eventType: payload.event,
          payload: payload as any,
          error: errorMessage,
        },
      });

      await this.prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          failCount: { increment: 1 },
          lastTriggeredAt: new Date(),
        },
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
