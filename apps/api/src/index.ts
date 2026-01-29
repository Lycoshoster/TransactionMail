import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config';

// Plugins
import prismaPlugin from './plugins/prisma';
import redisPlugin from './plugins/redis';
import queuePlugin from './plugins/queue';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Routes
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { emailRoutes } from './routes/emails';
import { templateRoutes } from './routes/templates';
import { webhookRoutes } from './routes/webhooks';
import { domainRoutes } from './routes/domains';
import { apiKeyRoutes } from './routes/apiKeys';

// Extend FastifyInstance to include config
declare module 'fastify' {
  interface FastifyInstance {
    config: typeof config;
  }
}

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'development' ? 'debug' : 'info',
      transport: config.nodeEnv === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
    },
    genReqId: () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  });

  // Store config
  app.decorate('config', config);

  // Error handler
  app.setErrorHandler(errorHandler);

  // Request logger
  app.addHook('onRequest', requestLogger);

  // Security plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: config.rateLimit.maxRequests,
    timeWindow: config.rateLimit.windowMs,
    keyGenerator: (req) => {
      // Use API key if available, otherwise IP
      return req.headers.authorization || req.ip;
    },
    errorResponseBuilder: (req, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Retry after ${context.after}`,
      },
      meta: {
        requestId: req.id,
        timestamp: new Date().toISOString(),
      },
    }),
  });

  // Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'TransactionMail API',
        description: 'Transactional Email API',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Development server' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Register plugins
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(queuePlugin);

  // Register routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(emailRoutes);
  await app.register(templateRoutes);
  await app.register(webhookRoutes);
  await app.register(domainRoutes);
  await app.register(apiKeyRoutes);

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  try {
    await app.ready();
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`🚀 API server listening on http://${config.host}:${config.port}`);
    app.log.info(`📚 API documentation available at http://${config.host}:${config.port}/documentation`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Starting graceful shutdown...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap();
