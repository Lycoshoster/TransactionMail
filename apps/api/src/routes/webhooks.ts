import { FastifyInstance } from 'fastify';
import { webhookSchema, updateWebhookSchema, generateWebhookSecret } from '@transactionmail/shared';
import { authenticateApiKey, requireScope } from '../middleware/auth';

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  // List webhooks
  fastify.get(
    '/v1/webhooks',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('webhooks:read'),
      ],
    },
    async (request, reply) => {
      const webhooks = await fastify.prisma.webhook.findMany({
        where: { projectId: request.apiKey!.projectId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          url: true,
          eventTypes: true,
          active: true,
          successCount: true,
          failCount: true,
          lastTriggeredAt: true,
          createdAt: true,
        },
      });

      reply.send({
        success: true,
        data: webhooks,
      });
    }
  );

  // Get webhook by ID
  fastify.get(
    '/v1/webhooks/:id',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('webhooks:read'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const webhook = await fastify.prisma.webhook.findFirst({
        where: {
          id,
          projectId: request.apiKey!.projectId,
        },
        include: {
          deliveries: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!webhook) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      reply.send({
        success: true,
        data: webhook,
      });
    }
  );

  // Create webhook
  fastify.post(
    '/v1/webhooks',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('webhooks:write'),
      ],
    },
    async (request, reply) => {
      const result = webhookSchema.safeParse(request.body);
      
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid webhook data',
            details: result.error.errors,
          },
        });
      }

      const data = result.data;
      const secret = data.secret || generateWebhookSecret();

      const webhook = await fastify.prisma.webhook.create({
        data: {
          url: data.url,
          secret,
          eventTypes: data.eventTypes,
          projectId: request.apiKey!.projectId,
        },
      });

      reply.status(201).send({
        success: true,
        data: {
          ...webhook,
          secret, // Only shown on creation
        },
      });
    }
  );

  // Update webhook
  fastify.patch(
    '/v1/webhooks/:id',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('webhooks:write'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = updateWebhookSchema.safeParse(request.body);
      
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid webhook data',
            details: result.error.errors,
          },
        });
      }

      // Check if webhook exists
      const existing = await fastify.prisma.webhook.findFirst({
        where: {
          id,
          projectId: request.apiKey!.projectId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      const webhook = await fastify.prisma.webhook.update({
        where: { id },
        data: result.data,
      });

      reply.send({
        success: true,
        data: webhook,
      });
    }
  );

  // Delete webhook
  fastify.delete(
    '/v1/webhooks/:id',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('webhooks:write'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await fastify.prisma.webhook.findFirst({
        where: {
          id,
          projectId: request.apiKey!.projectId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      await fastify.prisma.webhook.delete({
        where: { id },
      });

      reply.status(204).send();
    }
  );

  // Rotate webhook secret
  fastify.post(
    '/v1/webhooks/:id/rotate-secret',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('webhooks:write'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await fastify.prisma.webhook.findFirst({
        where: {
          id,
          projectId: request.apiKey!.projectId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      const newSecret = generateWebhookSecret();

      const webhook = await fastify.prisma.webhook.update({
        where: { id },
        data: { secret: newSecret },
      });

      reply.send({
        success: true,
        data: {
          ...webhook,
          secret: newSecret, // Only shown on rotation
        },
      });
    }
  );

  // Test webhook
  fastify.post(
    '/v1/webhooks/:id/test',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('webhooks:write'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const webhook = await fastify.prisma.webhook.findFirst({
        where: {
          id,
          projectId: request.apiKey!.projectId,
        },
      });

      if (!webhook) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Webhook not found' },
        });
      }

      // Queue a test webhook
      const { WebhookService } = await import('../services/webhook');
      const webhookService = new WebhookService(fastify.prisma, fastify.queues);

      await webhookService.trigger(request.apiKey!.projectId, 'message.sent', {
        messageId: 'test-message-id',
        to: 'test@example.com',
        from: 'test@example.com',
        subject: 'Test Webhook',
        status: 'sent',
        timestamp: new Date().toISOString(),
        test: true,
      });

      reply.send({
        success: true,
        data: { message: 'Test webhook queued for delivery' },
      });
    }
  );
}
