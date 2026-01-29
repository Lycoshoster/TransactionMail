import { FastifyInstance } from 'fastify';
import { config } from '../config';
import type { HealthStatus } from '@transactionmail/shared';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    const checks: HealthStatus['checks'] = {
      database: { status: 'down', latency: 0 },
      redis: { status: 'down', latency: 0 },
      smtp: { status: 'up' }, // Assume SMTP is up for now
    };

    let overallStatus: HealthStatus['status'] = 'healthy';

    // Check database
    try {
      const dbStart = Date.now();
      await fastify.prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'up',
        latency: Date.now() - dbStart,
      };
    } catch (err) {
      checks.database.status = 'down';
      overallStatus = 'unhealthy';
    }

    // Check Redis
    try {
      const redisStart = Date.now();
      await fastify.redis.ping();
      checks.redis = {
        status: 'up',
        latency: Date.now() - redisStart,
      };
    } catch (err) {
      checks.redis.status = 'down';
      overallStatus = overallStatus === 'healthy' ? 'degraded' : 'unhealthy';
    }

    const status: HealthStatus = {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 
                       overallStatus === 'degraded' ? 200 : 503;

    reply.status(statusCode).send({
      success: overallStatus !== 'unhealthy',
      data: status,
    });
  });

  // Readiness check
  fastify.get('/ready', async (request, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      await fastify.redis.ping();
      
      reply.send({
        success: true,
        data: { ready: true },
      });
    } catch (err) {
      reply.status(503).send({
        success: false,
        error: { code: 'NOT_READY', message: 'Service not ready' },
      });
    }
  });
}
