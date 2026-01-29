import { PrismaClient } from '@transactionmail/database';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class IdempotencyService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check if idempotency key exists
   */
  async check(
    key: string,
    scope: string
  ): Promise<{ key: string; response: unknown } | null> {
    const record = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (!record) return null;

    // Check if expired
    if (new Date() > record.expiresAt) {
      await this.prisma.idempotencyKey.delete({
        where: { id: record.id },
      });
      return null;
    }

    // Check scope matches
    if (record.scope !== scope) {
      return null;
    }

    return record as { key: string; response: unknown };
  }

  /**
   * Store idempotency key with response
   */
  async store(
    key: string,
    scope: string,
    response: unknown
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);

    await this.prisma.idempotencyKey.create({
      data: {
        key,
        scope,
        response: response as any,
        expiresAt,
      },
    });
  }

  /**
   * Clean up expired keys
   */
  async cleanup(): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}
