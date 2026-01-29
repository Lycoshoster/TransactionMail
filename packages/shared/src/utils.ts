import crypto from 'crypto';

/**
 * Generate a secure random API key
 */
export function generateApiKey(): string {
  const prefix = 'tm_live_';
  const randomPart = crypto.randomBytes(32).toString('hex');
  return prefix + randomPart;
}

/**
 * Generate a webhook secret
 */
export function generateWebhookSecret(): string {
  const prefix = 'whsec_';
  const randomPart = crypto.randomBytes(32).toString('hex');
  return prefix + randomPart;
}

/**
 * Sign webhook payload with HMAC
 */
export function signWebhookPayload(payload: string, secret: string): string {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `t=${Date.now()},v1=${signature}`;
}

/**
 * Verify webhook signature
 */
export function verifyWebhookPayload(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  // Extract v1 signature from header
  const match = signature.match(/v1=([a-f0-9]+)/);
  if (!match) return false;
  
  const providedSignature = match[1];
  
  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Generate unsubscribe token
 */
export function generateUnsubscribeToken(email: string, projectId: string, secret: string): string {
  const data = `${email}:${projectId}:${Date.now()}`;
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');
}

/**
 * Hash an API key for storage
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(apiKey, 12);
}

/**
 * Verify an API key against its hash
 */
export async function verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(apiKey, hash);
}

/**
 * Generate DKIM key pair
 */
export function generateDkimKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  
  return { privateKey, publicKey };
}

/**
 * Format DKIM public key for DNS record
 */
export function formatDkimPublicKey(publicKey: string): string {
  // Remove header/footer and newlines
  const key = publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');
  
  return `v=DKIM1; k=rsa; p=${key}`;
}

/**
 * Generate DNS records for a domain
 */
export function generateDnsRecords(
  domain: string,
  dkimSelector: string,
  dkimPublicKey: string
): {
  spf: { host: string; type: 'TXT'; value: string };
  dkim: { host: string; type: 'TXT'; value: string };
  dmarc: { host: string; type: 'TXT'; value: string };
} {
  return {
    spf: {
      host: domain,
      type: 'TXT',
      value: 'v=spf1 include:_spf.transactionmail.com ~all',
    },
    dkim: {
      host: `${dkimSelector}._domainkey.${domain}`,
      type: 'TXT',
      value: formatDkimPublicKey(dkimPublicKey),
    },
    dmarc: {
      host: `_dmarc.${domain}`,
      type: 'TXT',
      value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@transactionmail.com',
    },
  };
}

/**
 * Simple template engine - replace {{variable}} with values
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string | number | boolean>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Extract variables from a template
 */
export function extractTemplateVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  
  const variables = matches.map((match) => match.slice(2, -2));
  return [...new Set(variables)]; // Remove duplicates
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Parse email address with optional name
 * "Name <email@example.com>" or "email@example.com"
 */
export function parseEmailAddress(address: string): { email: string; name?: string } {
  const match = address.match(/^(?:"?([^"]*?)"?\s*)?<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim() || undefined, email: match[2].trim() };
  }
  return { email: address.trim() };
}

/**
 * Format email address with name
 */
export function formatEmailAddress(email: string, name?: string): string {
  if (name) {
    return `"${name}" <${email}>`;
  }
  return email;
}

/**
 * Generate request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Sleep/delay utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff with jitter
 */
export function calculateBackoff(attempt: number, baseDelay: number = 1000, maxDelay: number = 60000): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Truncate string to max length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Sanitize HTML to prevent XSS
 * Basic sanitization - use a proper library like DOMPurify for production
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
