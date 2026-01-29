// Event Types
export type WebhookEventType =
  | 'message.queued'
  | 'message.sent'
  | 'message.delivered'
  | 'message.bounced'
  | 'message.complained'
  | 'message.failed'
  | 'recipient.unsubscribed';

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface MessageEventData {
  messageId: string;
  projectId: string;
  to: string;
  from: string;
  subject: string;
  status: string;
  timestamp: string;
  error?: string;
  provider?: string;
}

export interface UnsubscribeEventData {
  email: string;
  projectId: string;
  reason: string;
  timestamp: string;
}

// Queue Job Types
export interface SendEmailJob {
  messageId: string;
  projectId: string;
  to: {
    email: string;
    name?: string;
  }[];
  from: {
    email: string;
    name?: string;
  };
  replyTo?: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
  headers?: Record<string, string>;
  attempt?: number;
  maxAttempts?: number;
}

export interface WebhookJob {
  webhookId: string;
  eventType: WebhookEventType;
  payload: WebhookPayload;
  attempt?: number;
  maxAttempts?: number;
}

// Rate Limit Info
export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

// SMTP Authentication
export interface SmtpAuth {
  username: string; // projectId
  password: string; // apiKey
}

// DNS Records
export interface DnsRecords {
  spf: {
    host: string;
    type: 'TXT';
    value: string;
  };
  dkim: {
    host: string;
    type: 'TXT';
    value: string;
  };
  dmarc: {
    host: string;
    type: 'TXT';
    value: string;
  };
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

// Health Check
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: { status: 'up' | 'down'; latency: number };
    redis: { status: 'up' | 'down'; latency: number };
    smtp: { status: 'up' | 'down' };
  };
  timestamp: string;
}
