import { FastifyInstance } from 'fastify';
import { domainSchema, generateDkimKeyPair, generateDnsRecords } from '@transactionmail/shared';
import { authenticateApiKey, requireScope } from '../middleware/auth';
import { DomainStatus } from '@transactionmail/database';

export async function domainRoutes(fastify: FastifyInstance): Promise<void> {
  // List domains
  fastify.get(
    '/v1/domains',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('domains:read'),
      ],
    },
    async (request, reply) => {
      const domains = await fastify.prisma.domain.findMany({
        where: { projectId: request.apiKey!.projectId },
        orderBy: { createdAt: 'desc' },
      });

      reply.send({
        success: true,
        data: domains,
      });
    }
  );

  // Get domain by ID
  fastify.get(
    '/v1/domains/:id',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('domains:read'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const domain = await fastify.prisma.domain.findFirst({
        where: {
          id,
          projectId: request.apiKey!.projectId,
        },
      });

      if (!domain) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Domain not found' },
        });
      }

      reply.send({
        success: true,
        data: domain,
      });
    }
  );

  // Create domain
  fastify.post(
    '/v1/domains',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('domains:write'),
      ],
    },
    async (request, reply) => {
      const result = domainSchema.safeParse(request.body);
      
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid domain data',
            details: result.error.errors,
          },
        });
      }

      const data = result.data;
      const dkimSelector = `tm${new Date().getFullYear()}`;
      
      // Generate DKIM keys
      const { publicKey } = generateDkimKeyPair();
      
      // Generate DNS records
      const dnsRecords = generateDnsRecords(data.domain, dkimSelector, publicKey);

      try {
        const domain = await fastify.prisma.domain.create({
          data: {
            domain: data.domain,
            fromName: data.fromName,
            fromEmail: data.fromEmail,
            replyTo: data.replyTo,
            status: DomainStatus.PENDING,
            spfRecord: dnsRecords.spf.value,
            dkimRecord: dnsRecords.dkim.value,
            dmarcRecord: dnsRecords.dmarc.value,
            dkimSelector,
            projectId: request.apiKey!.projectId,
          },
        });

        reply.status(201).send({
          success: true,
          data: {
            ...domain,
            dnsRecords: {
              spf: dnsRecords.spf,
              dkim: {
                ...dnsRecords.dkim,
                host: `${dkimSelector}._domainkey.${data.domain}`,
              },
              dmarc: {
                ...dnsRecords.dmarc,
                host: `_dmarc.${data.domain}`,
              },
            },
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            success: false,
            error: { code: 'CONFLICT', message: 'Domain already exists in this project' },
          });
        }
        throw err;
      }
    }
  );

  // Delete domain
  fastify.delete(
    '/v1/domains/:id',
    {
      preHandler: [
        authenticateApiKey,
        requireScope('domains:write'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await fastify.prisma.domain.findFirst({
        where: {
          id,
          projectId: request.apiKey!.projectId,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Domain not found' },
        });
      }

      await fastify.prisma.domain.delete({
        where: { id },
      });

      reply.status(204).send();
    }
  );
}
