import { SMTPServer, SMTPServerSession, SMTPServerDataStream } from 'smtp-server';
import { ParsedMail, simpleParser } from 'mailparser';
import { PrismaClient, MessageStatus } from '@transactionmail/database';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import bcrypt from 'bcryptjs';
import { config } from './config';
import type { SendEmailJob } from '@transactionmail/shared';

interface SmtpAuth {
  username: string;
  password: string;
}

export class SmtpRelayServer {
  private server: SMTPServer;
  private prisma: PrismaClient;
  private redis: IORedis;
  private queue: Queue<SendEmailJob>;

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.queue = new Queue<SendEmailJob>('send-email', {
      connection: this.redis,
      prefix: config.queue.prefix,
    });

    this.server = new SMTPServer({
      // Authentication
      authMethods: ['LOGIN', 'PLAIN'],
      onAuth: this.handleAuth.bind(this),
      
      // Handle mail from
      onMailFrom: this.handleMailFrom.bind(this),
      
      // Handle RCPT TO
      onRcptTo: this.handleRcptTo.bind(this),
      
      // Handle data (actual email)
      onData: this.handleData.bind(this),
      
      // Security
      secure: false, // Use STARTTLS in production
      
      // Logging
      logger: config.nodeEnv === 'development',
      
      // Limits
      maxClients: 100
    });

    this.server.on('error', (err) => {
      console.error('SMTP Server error:', err);
    });
  }

  private async handleAuth(
    auth: { username?: string; password?: string; method?: string },
    session: SMTPServerSession,
    callback: (err: Error | null, user?: object) => void
  ): Promise<void> {
    try {
      const { username, password } = auth;
      
      if (!username || !password) {
        return callback(new Error('Authentication required'));
      }

      // Username = project ID, Password = API key
      const projectId = username;
      const apiKeyValue = password;

      // Find project
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { apiKeys: true },
      });

      if (!project || project.status !== 'ACTIVE') {
        return callback(new Error('Invalid credentials'));
      }

      // Validate API key
      let validKey = false;
      for (const key of project.apiKeys) {
        if (key.revokedAt) continue;
        
        const isMatch = await bcrypt.compare(apiKeyValue, key.keyHash);
        if (isMatch) {
          // Check scopes
          if (!key.scopes.includes('send:email')) {
            return callback(new Error('API key does not have email sending permission'));
          }
          
          validKey = true;
          
          // Update last used
          await this.prisma.apiKey.update({
            where: { id: key.id },
            data: { lastUsedAt: new Date() },
          });
          
          break;
        }
      }

      if (!validKey) {
        return callback(new Error('Invalid credentials'));
      }

      // Store project ID in session
      (session as any).projectId = projectId;
      
      callback(null, { user: projectId });
    } catch (err) {
      console.error('SMTP Auth error:', err);
      callback(new Error('Authentication failed'));
    }
  }

  private handleMailFrom(
    address: { address: string },
    session: SMTPServerSession,
    callback: (err?: Error | null) => void
  ): void {
    // Validate from address
    const projectId = (session as any).projectId;
    if (!projectId) {
      return callback(new Error('Not authenticated'));
    }

    // Store envelope from
    (session as any).envelopeFrom = address.address;
    callback();
  }

  private handleRcptTo(
    address: { address: string },
    session: SMTPServerSession,
    callback: (err?: Error | null) => void
  ): void {
    const projectId = (session as any).projectId;
    if (!projectId) {
      return callback(new Error('Not authenticated'));
    }

    // Initialize recipients array
    if (!(session as any).envelopeTo) {
      (session as any).envelopeTo = [];
    }
    
    (session as any).envelopeTo.push(address.address);
    callback();
  }

  private async handleData(
    stream: SMTPServerDataStream,
    session: SMTPServerSession,
    callback: (err?: Error | null) => void
  ): Promise<void> {
    try {
      const projectId = (session as any).projectId;
      const envelopeFrom = (session as any).envelopeFrom;
      const envelopeTo = (session as any).envelopeTo || [];

      if (!projectId) {
        return callback(new Error('Not authenticated'));
      }

      // Parse the email
      const parsed: ParsedMail = await simpleParser(stream);

      // Check suppression list
      for (const recipient of envelopeTo) {
        const suppressed = await this.prisma.suppression.findUnique({
          where: {
            projectId_email: {
              projectId,
              email: recipient,
            },
          },
        });

        if (suppressed) {
          return callback(new Error(`Recipient ${recipient} is suppressed`));
        }
      }

      // Extract attachments
      const attachments = parsed.attachments?.map((att) => ({
        filename: att.filename || 'attachment',
        content: att.content.toString('base64'),
        contentType: att.contentType,
      }));

      // Create message record
      const message = await this.prisma.message.create({
        data: {
          projectId,
          toEmail: envelopeTo.join(', '),
          fromEmail: parsed.from?.value[0]?.address || envelopeFrom,
          fromName: parsed.from?.value[0]?.name,
          replyTo: parsed.replyTo?.value[0]?.address,
          subject: parsed.subject || '(no subject)',
          htmlBody: parsed.html || undefined,
          textBody: parsed.text,
          status: MessageStatus.QUEUED,
          tags: ['smtp-relay'],
        },
      });

      // Add event
      await this.prisma.event.create({
        data: {
          messageId: message.id,
          type: 'QUEUED',
          payload: { source: 'smtp-relay' },
        },
      });

      // Create job data
      const jobData: SendEmailJob = {
        messageId: message.id,
        projectId,
        to: envelopeTo.map((email: string) => ({ email })),
        from: {
          email: parsed.from?.value[0]?.address || envelopeFrom,
          name: parsed.from?.value[0]?.name,
        },
        replyTo: parsed.replyTo?.value[0]?.address,
        subject: parsed.subject || '(no subject)',
        htmlBody: parsed.html || undefined,
        textBody: parsed.text,
        attachments,
      };

      // Add to queue
      await this.queue.add(`smtp:${message.id}`, jobData);

      console.log(`📨 SMTP Relay: Queued message ${message.id} from ${envelopeFrom} to ${envelopeTo.join(', ')}`);

      callback();
    } catch (err) {
      console.error('SMTP Data handling error:', err);
      callback(new Error('Failed to process message'));
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.on('error', reject);
      
      // Start listening on the configured port
      const port = config.smtpRelayPort || 2525;
      const host = config.smtpRelayHost || '0.0.0.0';
      
      this.server.listen(port, host, () => {
        console.log(`📧 SMTP Relay server listening on ${host}:${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
    
    await this.queue.close();
    await this.redis.quit();
    await this.prisma.$disconnect();
  }
}

// Start SMTP relay if this file is run directly
if (require.main === module) {
  const relay = new SmtpRelayServer();
  
  relay.start().catch((err) => {
    console.error('Failed to start SMTP relay:', err);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => relay.stop());
  process.on('SIGINT', () => relay.stop());
}

export default SmtpRelayServer;
