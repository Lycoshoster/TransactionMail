import { FastifyInstance } from 'fastify';
import { RateLimitInfo } from '@transactionmail/shared';
import { config } from '../config';

const RATE_LIMIT_PREFIX = 'rate_limit:';

export class RateLimiter {
  constructor(private redis: FastifyInstance['redis']) {}

  /**
   * Check if request is allowed based on rate limit
   */
  async checkLimit(
    key: string,
    maxRequests: number = config.rateLimit.maxRequests,
    windowMs: number = config.rateLimit.windowMs
  ): Promise<RateLimitInfo> {
    const redisKey = `${RATE_LIMIT_PREFIX}${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.pipeline();
    
    // Remove old entries
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    
    // Count current entries
    pipeline.zcard(redisKey);
    
    // Add current request
    pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);
    
    // Set expiry
    pipeline.pexpire(redisKey, windowMs);

    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) || 0;

    // Get oldest timestamp for reset time
    const oldest = await this.redis.zrange(redisKey, 0, 0, 'WITHSCORES');
    const resetAt = oldest.length > 1 
      ? new Date(parseInt(oldest[1]) + windowMs)
      : new Date(now + windowMs);

    return {
      allowed: currentCount < maxRequests,
      remaining: Math.max(0, maxRequests - currentCount - 1),
      resetAt,
      limit: maxRequests,
    };
  }

  /**
   * Get rate limit key for API key
   */
  getApiKeyKey(apiKeyId: string, endpoint: string): string {
    return `api:${apiKeyId}:${endpoint}`;
  }

  /**
   * Get rate limit key for project
   */
  getProjectKey(projectId: string): string {
    return `project:${projectId}`;
  }
}
