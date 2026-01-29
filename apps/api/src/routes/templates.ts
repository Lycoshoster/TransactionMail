import { FastifyInstance } from 'fastify';
import { templateSchema, updateTemplateSchema, extractTemplateVariables } from '@transactionmail/shared';
import { authenticateApiKey, requireScope } from '../middleware/auth';

export async function templateRoutes(fastify: FastifyInstance): Promise<void> {
  // List templates
  fastify.get(
    '/v1/templates',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('templates:read'),
      ],
    },
    async (request, reply) => {
      const templates = await fastify.prisma.template.findMany({
        where: { projectId: request.apiKey!.projectId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          subject: true,
          variables: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      reply.send({
        success: true,
        data: templates,
      });
    }
  );

  // Get template by ID
  fastify.get(
    '/v1/templates/:id',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('templates:read'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const template = await fastify.prisma.template.findFirst({
        where: {
          id,
          projectId: request.apiKey!.projectId,
        },
      });

      if (!template) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Template not found' },
        });
      }

      reply.send({
        success: true,
        data: template,
      });
    }
  );

  // Create template
  fastify.post(
    '/v1/templates',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('templates:write'),
      ],
    },
    async (request, reply) => {
      const result = templateSchema.safeParse(request.body);
      
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid template data',
            details: result.error.errors,
          },
        });
      }

      const data = result.data;

      // Extract variables from content if not provided
      const htmlVars = data.html ? extractTemplateVariables(data.html) : [];
      const textVars = data.text ? extractTemplateVariables(data.text) : [];
      const subjectVars = extractTemplateVariables(data.subject);
      
      const variables = data.variables || [
        ...new Set([...htmlVars, ...textVars, ...subjectVars]),
      ];

      try {
        const template = await fastify.prisma.template.create({
          data: {
            name: data.name,
            subject: data.subject,
            html: data.html,
            text: data.text,
            variables,
            projectId: request.apiKey!.projectId,
          },
        });

        reply.status(201).send({
          success: true,
          data: template,
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            success: false,
            error: { code: 'CONFLICT', message: 'Template with this name already exists' },
          });
        }
        throw err;
      }
    }
  );

  // Update template
  fastify.patch(
    '/v1/templates/:id',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('templates:write'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = updateTemplateSchema.safeParse(request.body);
      
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid template data',
            details: result.error.errors,
          },
        });
      }

      const data = result.data;

      // Check if template exists
      const existing = await fastify.prisma.template.findFirst({
        where: {
          id,
          projectId: request.apiKey!.projectId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Template not found' },
        });
      }

      // Update variables if content changed
      let variables = data.variables;
      if (!variables && (data.html !== undefined || data.text !== undefined || data.subject !== undefined)) {
        const htmlVars = (data.html ?? existing.html) ? extractTemplateVariables(data.html ?? existing.html ?? '') : [];
        const textVars = (data.text ?? existing.text) ? extractTemplateVariables(data.text ?? existing.text ?? '') : [];
        const subjectVars = extractTemplateVariables(data.subject ?? existing.subject);
        variables = [...new Set([...htmlVars, ...textVars, ...subjectVars])];
      }

      const template = await fastify.prisma.template.update({
        where: { id },
        data: {
          ...data,
          variables,
        },
      });

      reply.send({
        success: true,
        data: template,
      });
    }
  );

  // Delete template
  fastify.delete(
    '/v1/templates/:id',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('templates:write'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Check if template exists
      const existing = await fastify.prisma.template.findFirst({
        where: {
          id,
          projectId: request.apiKey!.projectId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Template not found' },
        });
      }

      await fastify.prisma.template.delete({
        where: { id },
      });

      reply.status(204).send();
    }
  );
}
