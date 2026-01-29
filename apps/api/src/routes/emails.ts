import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { 
  sendEmailWithOptionsSchema, 
  messageFilterSchema
} from '@transactionmail/shared';
import { authenticateApiKey, requireScope } from '../middleware/auth';
import { EmailService } from '../services/email';

export async function emailRoutes(fastify: FastifyInstance): Promise<void> {
  const emailService = new EmailService(
    fastify.prisma,
    fastify.queues,
    fastify.redis
  );

  // Send email
  fastify.post(
    '/v1/send',
    { 
      preHandler: [
        authenticateApiKey,
        requireScope('send:email'),
      ],
    },
    async (request, reply) => {
      const result = sendEmailWithOptionsSchema.safeParse(request.body);
      
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email data',
            details: result.error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      }

      const { idempotencyKey, ...emailData } = result.data;

      const response = await emailService.sendEmail(
        request.apiKey!.projectId,
        request.apiKey!.id,
        emailData,
        {
          idempotencyKey,
          tags: result.data.tags,
          priority: result.data.priority,
        }
      );

      if (!response.success) {
        const statusCode = response.error?.code === 'RATE_LIMIT_EXCEEDED' ? 429 :
                          response.error?.code === 'RECIPIENT_SUPPRESSED' ? 400 :
                          response.error?.code === 'TEMPLATE_NOT_FOUND' ? 404 :
                          400;
        return reply.status(statusCode).send(response);
      }

      reply.status(202).send(response);
    }
  );

  // Get messages
  fastify.get(
    '/v1/messages',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('logs:read'),
      ],
    },
    async (request, reply) => {
      const result = messageFilterSchema.safeParse(request.query);
      
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid filter parameters',
            details: result.error.errors,
          },
        });
      }

      const filters = result.data;
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {
        projectId: request.apiKey!.projectId,
      };

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.to) {
        where.toEmail = { contains: filters.to, mode: 'insensitive' };
      }

      if (filters.tag) {
        where.tags = { has: filters.tag };
      }

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) {
          where.createdAt.gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          where.createdAt.lte = new Date(filters.dateTo);
        }
      }

      const [messages, total] = await Promise.all([
        fastify.prisma.message.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            toEmail: true,
            fromEmail: true,
            subject: true,
            status: true,
            tags: true,
            createdAt: true,
            sentAt: true,
          },
        }),
        fastify.prisma.message.count({ where }),
      ]);

      reply.send({
        success: true,
        data: messages,
        meta: {
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    }
  );

  // Get message by ID
  fastify.get(
    '/v1/messages/:id',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('logs:read'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const message = await fastify.prisma.message.findFirst({
        where: {
          id,
          projectId: request.apiKey!.projectId,
        },
        include: {
          events: {
            orderBy: { createdAt: 'asc' },
          },
          attachments: true,
        },
      });

      if (!message) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Message not found' },
        });
      }

      reply.send({
        success: true,
        data: message,
      });
    }
  );
}
