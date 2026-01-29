import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { PrismaClient, ApiKey } from '@transactionmail/database';

// Extend FastifyRequest to include authenticated entities
declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKey & { project: { id: string; name: string; status: string } };
    user?: { id: string; email: string; role: string };
  }
}

/**
 * Authenticate via API Key (Bearer token)
 */
export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  
  if (!authHeader) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' },
    });
  }

  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'Bearer' || !token) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid authorization format. Use Bearer <token>' },
    });
  }

  const prisma = request.server.prisma;
  
  // Find API key by hash - we need to check all non-revoked keys
  // This is not ideal for performance but necessary with bcrypt
  // In production, consider caching or a different approach
  const apiKeys = await prisma.apiKey.findMany({
    where: { revokedAt: null },
    include: { project: true },
  });

  let matchedKey: typeof apiKeys[0] | null = null;
  
  for (const key of apiKeys) {
    const isMatch = await bcrypt.compare(token, key.keyHash);
    if (isMatch) {
      matchedKey = key;
      break;
    }
  }

  if (!matchedKey) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    });
  }

  if (matchedKey.project.status !== 'ACTIVE') {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Project is not active' },
    });
  }

  // Update last used
  await prisma.apiKey.update({
    where: { id: matchedKey.id },
    data: { lastUsedAt: new Date() },
  });

  request.apiKey = matchedKey as FastifyRequest['apiKey'];
}

/**
 * Authenticate via JWT (for admin dashboard)
 */
export async function authenticateJwt(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  
  if (!authHeader) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' },
    });
  }

  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'Bearer' || !token) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid authorization format' },
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      email: string;
      role: string;
    };

    request.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (err) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }
}

/**
 * Check if API key has required scope
 */
export function requireScope(...scopes: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.apiKey) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const hasScope = scopes.some((scope) => request.apiKey!.scopes.includes(scope));
    
    if (!hasScope) {
      return reply.status(403).send({
        success: false,
        error: { 
          code: 'FORBIDDEN', 
          message: `Missing required scope. Required one of: ${scopes.join(', ')}`,
        },
      });
    }
  };
}

// Re-export for convenience
export { requireScope as requireScopes };

/**
 * Check if user is admin
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user || request.user.role !== 'ADMIN') {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
  }
}
