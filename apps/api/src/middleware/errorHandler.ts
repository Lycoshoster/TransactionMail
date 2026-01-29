import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { generateRequestId } from '@transactionmail/shared';

interface CustomError extends FastifyError {
  statusCode?: number;
}

export function errorHandler(
  error: CustomError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = (request.id as string) || generateRequestId();
  
  // Log error
  request.log.error({
    err: error,
    requestId,
    path: request.url,
    method: request.method,
  }, 'Request error');

  // Zod validation error
  if (error instanceof ZodError) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
    return;
  }

  // Rate limit error
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: error.message || 'Too many requests',
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
    return;
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : error.message;

  reply.status(statusCode).send({
    success: false,
    error: { code, message },
    meta: { requestId, timestamp: new Date().toISOString() },
  });
}
