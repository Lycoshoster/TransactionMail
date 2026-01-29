import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Queue } from 'bullmq';
import { config } from '../config';
import type { SendEmailJob, WebhookJob } from '@transactionmail/shared';

declare module 'fastify' {
  interface FastifyInstance {
    queues: {
      sendEmail: Queue<SendEmailJob>;
      webhook: Queue<WebhookJob>;
    };
  }
}

const queuePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const sendEmailQueue = new Queue<SendEmailJob>('send-email', {
    connection: fastify.redis,
    prefix: config.queue.prefix,
    defaultJobOptions: config.queue.defaultJobOptions,
  });

  const webhookQueue = new Queue<WebhookJob>('webhook', {
    connection: fastify.redis,
    prefix: config.queue.prefix,
    defaultJobOptions: {
      ...config.queue.defaultJobOptions,
      attempts: 5,
    },
  });

  fastify.decorate('queues', {
    sendEmail: sendEmailQueue,
    webhook: webhookQueue,
  });

  fastify.addHook('onClose', async () => {
    await sendEmailQueue.close();
    await webhookQueue.close();
  });

  fastify.log.info('Queues initialized');
};

export default fp(queuePlugin, { name: 'queue', dependencies: ['redis'] });
