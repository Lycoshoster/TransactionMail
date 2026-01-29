import { FastifyInstance } from 'fastify';
import { PrismaClient, MessageStatus } from '@transactionmail/database';
import { 
  SendEmailRequest, 
  SendEmailJob, 
  renderTemplate, 
  formatEmailAddress,
  generateRequestId,
  ApiResponse 
} from '@transactionmail/shared';
import { RateLimiter } from './rateLimiter';
import { IdempotencyService } from './idempotency';

export interface SendEmailOptions {
  idempotencyKey?: string;
  tags?: string[];
  priority?: 'high' | 'normal' | 'low';
}

export class EmailService {
  private rateLimiter: RateLimiter;
  private idempotency: IdempotencyService;

  constructor(
    private prisma: PrismaClient,
    private queues: FastifyInstance['queues'],
    redis: FastifyInstance['redis']
  ) {
    this.rateLimiter = new RateLimiter(redis);
    this.idempotency = new IdempotencyService(prisma);
  }

  /**
   * Send email via queue
   */
  async sendEmail(
    projectId: string,
    apiKeyId: string,
    data: SendEmailRequest,
    options: SendEmailOptions = {}
  ): Promise<ApiResponse<{ messageId: string; status: string }>> {
    // Check rate limit
    const rateLimitKey = this.rateLimiter.getProjectKey(projectId);
    const rateLimit = await this.rateLimiter.checkLimit(rateLimitKey);
    
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
        },
      };
    }

    // Check idempotency
    if (options.idempotencyKey) {
      const existing = await this.idempotency.check(
        options.idempotencyKey,
        `send:${projectId}`
      );
      
      if (existing) {
        return {
          success: true,
          data: existing.response as { messageId: string; status: string },
        };
      }
    }

    // Check suppression list
    const toEmails = this.normalizeRecipients(data.to);
    for (const recipient of toEmails) {
      const suppressed = await this.prisma.suppression.findUnique({
        where: {
          projectId_email: {
            projectId,
            email: recipient.email,
          },
        },
      });

      if (suppressed) {
        return {
          success: false,
          error: {
            code: 'RECIPIENT_SUPPRESSED',
            message: `Recipient ${recipient.email} is suppressed: ${suppressed.reason}`,
          },
        };
      }
    }

    // Normalize from address
    const from = this.normalizeFrom(data.from);

    // Handle template
    let htmlBody = data.html;
    let textBody = data.text;
    let subject = data.subject;
    let templateId: string | undefined;
    let templateData: Record<string, string> | undefined;

    if (data.templateId) {
      const template = await this.prisma.template.findFirst({
        where: {
          id: data.templateId,
          projectId,
        },
      });

      if (!template) {
        return {
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: `Template with ID ${data.templateId} not found`,
          },
        };
      }

      templateId = template.id;
      templateData = data.variables || {};
      subject = renderTemplate(template.subject, templateData);
      htmlBody = template.html ? renderTemplate(template.html, templateData) : undefined;
      textBody = template.text ? renderTemplate(template.text, templateData) : undefined;
    }

    // Validate we have content
    if (!htmlBody && !textBody) {
      return {
        success: false,
        error: {
          code: 'MISSING_CONTENT',
          message: 'Email must have either html, text, or a template with content',
        },
      };
    }

    // Create message record
    const messageId = generateRequestId();
    const message = await this.prisma.message.create({
      data: {
        id: messageId,
        projectId,
        toEmail: toEmails.map((r) => r.email).join(', '),
        toName: toEmails.find((r) => r.name)?.name,
        fromEmail: from.email,
        fromName: from.name,
        replyTo: data.replyTo,
        subject,
        htmlBody,
        textBody,
        templateId,
        templateData: templateData as any,
        status: MessageStatus.QUEUED,
        tags: options.tags || [],
        idempotencyKey: options.idempotencyKey,
      },
    });

    // Add event
    await this.prisma.event.create({
      data: {
        messageId: message.id,
        type: 'QUEUED',
        payload: { apiKeyId, timestamp: new Date().toISOString() },
      },
    });

    // Create job data
    const jobData: SendEmailJob = {
      messageId: message.id,
      projectId,
      to: toEmails,
      from,
      replyTo: data.replyTo,
      subject,
      htmlBody,
      textBody,
      attachments: data.attachments,
      headers: data.headers,
    };

    // Add to queue with priority
    const jobOptions: any = {};
    if (options.priority === 'high') {
      jobOptions.priority = 1;
    } else if (options.priority === 'low') {
      jobOptions.priority = 10;
    }

    await this.queues.sendEmail.add(`send:${message.id}`, jobData, jobOptions);

    const response = {
      messageId: message.id,
      status: MessageStatus.QUEUED,
    };

    // Store idempotency key
    if (options.idempotencyKey) {
      await this.idempotency.store(
        options.idempotencyKey,
        `send:${projectId}`,
        response
      );
    }

    return {
      success: true,
      data: response,
    };
  }

  /**
   * Normalize recipients to array of {email, name}
   */
  private normalizeRecipients(
    to: SendEmailRequest['to']
  ): Array<{ email: string; name?: string }> {
    const recipients: Array<{ email: string; name?: string }> = [];

    if (typeof to === 'string') {
      recipients.push({ email: to });
    } else if (Array.isArray(to)) {
      for (const recipient of to) {
        if (typeof recipient === 'string') {
          recipients.push({ email: recipient });
        } else {
          recipients.push(recipient);
        }
      }
    } else {
      recipients.push(to);
    }

    return recipients;
  }

  /**
   * Normalize from address
   */
  private normalizeFrom(
    from: SendEmailRequest['from']
  ): { email: string; name?: string } {
    if (typeof from === 'string') {
      return { email: from };
    }
    return from;
  }
}
