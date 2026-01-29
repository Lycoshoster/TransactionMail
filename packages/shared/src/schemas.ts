import { z } from 'zod';

// API Key Scopes
export const ApiKeyScope = {
  SEND_EMAIL: 'send:email',
  TEMPLATES_READ: 'templates:read',
  TEMPLATES_WRITE: 'templates:write',
  LOGS_READ: 'logs:read',
  WEBHOOKS_READ: 'webhooks:read',
  WEBHOOKS_WRITE: 'webhooks:write',
  DOMAINS_READ: 'domains:read',
  DOMAINS_WRITE: 'domains:write',
} as const;

// Send Email Request Schema
export const sendEmailSchema = z.object({
  to: z.union([
    z.string().email(),
    z.object({
      email: z.string().email(),
      name: z.string().optional(),
    }),
    z.array(z.union([z.string().email(), z.object({
      email: z.string().email(),
      name: z.string().optional(),
    })])),
  ]),
  from: z.union([
    z.string().email(),
    z.object({
      email: z.string().email(),
      name: z.string().optional(),
    }),
  ]),
  replyTo: z.string().email().optional(),
  subject: z.string().min(1).max(998),
  text: z.string().optional(),
  html: z.string().optional(),
  templateId: z.string().optional(),
  variables: z.record(z.string()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(), // base64
    contentType: z.string().optional(),
  })).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  headers: z.record(z.string()).optional(),
  priority: z.enum(['high', 'normal', 'low']).optional(),
});

export type SendEmailRequest = z.infer<typeof sendEmailSchema>;

// Send Email with Options
export const sendEmailWithOptionsSchema = sendEmailSchema.extend({
  idempotencyKey: z.string().max(255).optional(),
});

export type SendEmailWithOptionsRequest = z.infer<typeof sendEmailWithOptionsSchema>;

// Template Schema
export const templateSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/i),
  subject: z.string().min(1).max(998),
  html: z.string().optional(),
  text: z.string().optional(),
  variables: z.array(z.string()).optional(),
});

export type CreateTemplateRequest = z.infer<typeof templateSchema>;

export const updateTemplateSchema = templateSchema.partial();

export type UpdateTemplateRequest = z.infer<typeof updateTemplateSchema>;

// Webhook Schema
export const webhookSchema = z.object({
  url: z.string().url(),
  eventTypes: z.array(z.enum([
    'message.queued',
    'message.sent',
    'message.delivered',
    'message.bounced',
    'message.complained',
    'message.failed',
    'recipient.unsubscribed',
  ])).min(1),
  secret: z.string().min(16).optional(),
});

export type CreateWebhookRequest = z.infer<typeof webhookSchema>;

export const updateWebhookSchema = webhookSchema.partial();

export type UpdateWebhookRequest = z.infer<typeof updateWebhookSchema>;

// Domain Schema
export const domainSchema = z.object({
  domain: z.string().min(1).max(253),
  fromName: z.string().max(100).optional(),
  fromEmail: z.string().email(),
  replyTo: z.string().email().optional(),
});

export type CreateDomainRequest = z.infer<typeof domainSchema>;

// Message Filter Schema
export const messageFilterSchema = z.object({
  status: z.enum(['QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'RETRYING']).optional(),
  to: z.string().email().optional(),
  tag: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type MessageFilterRequest = z.infer<typeof messageFilterSchema>;

// API Key Schema
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.nativeEnum(ApiKeyScope)).min(1),
});

export type CreateApiKeyRequest = z.infer<typeof createApiKeySchema>;

// Unsubscribe Schema
export const unsubscribeSchema = z.object({
  token: z.string(),
});

export type UnsubscribeRequest = z.infer<typeof unsubscribeSchema>;

// SMTP Config Schema
export const smtpConfigSchema = z.object({
  host: z.string(),
  port: z.number().int(),
  secure: z.boolean().default(false),
  auth: z.object({
    user: z.string(),
    pass: z.string(),
  }).optional(),
});

export type SmtpConfig = z.infer<typeof smtpConfigSchema>;
