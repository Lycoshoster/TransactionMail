import { FastifyRequest, FastifyReply } from 'fastify';
import { generateRequestId } from '@transactionmail/shared';

export async function requestLogger(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Generate or use existing request ID
  const requestId = (request.headers['x-request-id'] as string) || generateRequestId();
  request.id = requestId;
  
  // Add request ID to response headers
  reply.header('x-request-id', requestId);

  const startTime = process.hrtime.bigint();

  // Use reply's hook for when response is sent
  reply.raw.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    request.log.info({
      requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: durationMs.toFixed(2),
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      apiKey: request.apiKey?.id,
      projectId: request.apiKey?.projectId,
    }, 'Request completed');
  });
}
