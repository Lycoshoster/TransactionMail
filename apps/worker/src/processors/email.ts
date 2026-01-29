import { Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { PrismaClient, MessageStatus, EventType } from '@transactionmail/database';
import { SendEmailJob, formatEmailAddress, sleep, calculateBackoff } from '@transactionmail/shared';
import { config } from '../config';

export class EmailProcessor {
  private prisma: PrismaClient;
  private transporter: nodemailer.Transporter;

  constructor() {
    this.prisma = new PrismaClient();
    
    // Configure Nodemailer
    const smtpConfig = config.useMailHog
      ? {
          host: config.mailHog.host,
          port: config.mailHog.port,
          secure: false,
          ignoreTLS: true,
        }
      : {
          host: config.smtpOut.host,
          port: config.smtpOut.port,
          secure: config.smtpOut.secure,
          auth: config.smtpOut.user
            ? {
                user: config.smtpOut.user,
                pass: config.smtpOut.pass,
              }
            : undefined,
        };

    this.transporter = nodemailer.createTransport(smtpConfig);
  }

  async initialize(): Promise<void> {
    // Verify SMTP connection
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified');
    } catch (err) {
      console.error('❌ SMTP connection failed:', err);
      // Don't throw - we'll retry when sending
    }
  }

  async process(job: Job<SendEmailJob>): Promise<void> {
    const { messageId, to, from, replyTo, subject, htmlBody, textBody, attachments, headers } = job.data;
    
    console.log(`📧 Processing email job ${job.id} for message ${messageId}`);

    try {
      // Update message status to processing
      await this.updateMessageStatus(messageId, MessageStatus.PROCESSING);

      // Build email
      const mailOptions: nodemailer.SendMailOptions = {
        from: formatEmailAddress(from.email, from.name),
        to: to.map((r) => formatEmailAddress(r.email, r.name)).join(', '),
        replyTo,
        subject,
        text: textBody,
        html: htmlBody,
        headers,
        attachments: attachments?.map((att) => ({
          filename: att.filename,
          content: Buffer.from(att.content, 'base64'),
          contentType: att.contentType,
        })),
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent: ${info.messageId}`);

      // Update message as sent
      await this.updateMessageStatus(messageId, MessageStatus.SENT, {
        externalId: info.messageId,
        sentAt: new Date(),
      });

      // For transactional emails, we consider "sent" as "delivered" for MVP
      // In production, you'd wait for actual delivery receipts
      await this.updateMessageStatus(messageId, MessageStatus.DELIVERED, {
        deliveredAt: new Date(),
      });

      // Record events
      await this.recordEvent(messageId, EventType.SENT, {
        providerMessageId: info.messageId,
        response: info.response,
      });

      await this.recordEvent(messageId, EventType.DELIVERED, {
        simulated: true, // Until we have real delivery confirmation
      });

    } catch (error) {
      console.error(`❌ Failed to send email ${messageId}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if we should retry
      const attempts = job.attemptsMade + 1;
      const shouldRetry = attempts < (job.opts.attempts || config.retry.maxAttempts);

      if (shouldRetry) {
        // Update status to retrying
        await this.updateMessageStatus(messageId, MessageStatus.RETRYING, {
          error: errorMessage,
        });

        await this.recordEvent(messageId, EventType.RETRY_SCHEDULED, {
          attempt: attempts,
          error: errorMessage,
          nextRetryAt: new Date(Date.now() + calculateBackoff(attempts)).toISOString(),
        });

        // Re-throw to trigger BullMQ retry
        throw error;
      } else {
        // Final failure
        await this.updateMessageStatus(messageId, MessageStatus.FAILED, {
          error: errorMessage,
        });

        await this.recordEvent(messageId, EventType.FAILED, {
          error: errorMessage,
          attempts: attempts,
        });

        // Add to suppression list if it's a hard bounce (simplified)
        if (this.isHardBounceError(errorMessage)) {
          await this.addToSuppressionList(messageId, to[0].email, errorMessage);
        }

        // Don't throw - we've handled the failure
      }
    }
  }

  private async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    extraData?: Record<string, any>
  ): Promise<void> {
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        status,
        ...extraData,
      },
    });
  }

  private async recordEvent(
    messageId: string,
    type: EventType,
    payload: Record<string, any>
  ): Promise<void> {
    await this.prisma.event.create({
      data: {
        messageId,
        type,
        payload: payload as any,
      },
    });
  }

  private isHardBounceError(errorMessage: string): boolean {
    const hardBounceIndicators = [
      'recipient rejected',
      'user unknown',
      'mailbox unavailable',
      'invalid address',
      'no such user',
      'does not exist',
    ];
    
    const lowerError = errorMessage.toLowerCase();
    return hardBounceIndicators.some((indicator) => lowerError.includes(indicator));
  }

  private async addToSuppressionList(
    messageId: string,
    email: string,
    reason: string
  ): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { projectId: true },
    });

    if (!message) return;

    await this.prisma.suppression.upsert({
      where: {
        projectId_email: {
          projectId: message.projectId,
          email,
        },
      },
      update: {
        reason: 'BOUNCE',
        metadata: { error: reason },
      },
      create: {
        projectId: message.projectId,
        email,
        reason: 'BOUNCE',
        source: 'bounce',
        metadata: { error: reason },
      },
    });
  }

  async shutdown(): Promise<void> {
    await this.prisma.$disconnect();
    this.transporter.close();
  }
}
