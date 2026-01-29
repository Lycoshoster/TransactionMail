import { FastifyInstance } from 'fastify';
import { createApiKeySchema, generateApiKey } from '@transactionmail/shared';
import { authenticateApiKey, authenticateJwt, requireAdmin, requireScope } from '../middleware/auth';
import bcrypt from 'bcryptjs';

export async function apiKeyRoutes(fastify: FastifyInstance): Promise<void> {
  // List API keys (admin or project-scoped via JWT)
  fastify.get(
    '/v1/api-keys',
    {
      preHandler: [authenticateApiKey, requireScope('logs:read')],
    },
    async (request, reply) => {
      const apiKeys = await fastify.prisma.apiKey.findMany({
        where: {
          projectId: request.apiKey!.projectId,
          revokedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          scopes: true,
          createdAt: true,
          lastUsedAt: true,
        },
      });

      reply.send({
        success: true,
        data: apiKeys,
      });
    }
  );

  // Create API key
  fastify.post(
    '/v1/api-keys',
    {
      preHandler: [authenticateApiKey, requireScope('webhooks:write')],
    },
    async (request, reply) => {
      const result = createApiKeySchema.safeParse(request.body);
      
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid API key data',
            details: result.error.errors,
          },
        });
      }

      const data = result.data;
      const apiKeyValue = generateApiKey();
      const keyHash = await bcrypt.hash(apiKeyValue, 12);

      const apiKey = await fastify.prisma.apiKey.create({
        data: {
          name: data.name,
          keyHash,
          scopes: data.scopes,
          projectId: request.apiKey!.projectId,
        },
      });

      reply.status(201).send({
        success: true,
        data: {
          ...apiKey,
          key: apiKeyValue, // Only shown on creation
        },
      });
    }
  );

  // Revoke API key
  fastify.delete(
    '/v1/api-keys/:id',
    {
      preHandler: [authenticateApiKey, requireScope('webhooks:write')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await fastify.prisma.apiKey.findFirst({
        where: {
          id,
          projectId: request.apiKey!.projectId,
          revokedAt: null,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'API key not found' },
        });
      }

      await fastify.prisma.apiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
      });

      reply.status(204).send();
    }
  );
}
