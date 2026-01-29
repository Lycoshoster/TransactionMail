import { PrismaClient, UserRole, ProjectStatus, DomainStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@transactionmail.local' },
    update: {},
    create: {
      email: 'admin@transactionmail.local',
      passwordHash: hashedPassword,
      role: UserRole.ADMIN,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create demo project
  const project = await prisma.project.upsert({
    where: { id: 'demo-project-id' },
    update: {},
    create: {
      id: 'demo-project-id',
      name: 'Demo Project',
      description: 'A demo project for testing TransactionMail',
      status: ProjectStatus.ACTIVE,
      ownerId: admin.id,
    },
  });
  console.log('✅ Demo project created:', project.name);

  // Create API key
  const apiKeyValue = 'tm_live_' + Buffer.from(crypto.randomUUID()).toString('base64').slice(0, 32);
  const apiKeyHash = await bcrypt.hash(apiKeyValue, 10);
  
  const apiKey = await prisma.apiKey.upsert({
    where: { keyHash: apiKeyHash },
    update: {},
    create: {
      name: 'Default API Key',
      keyHash: apiKeyHash,
      scopes: ['send:email', 'templates:read', 'templates:write', 'logs:read', 'webhooks:read', 'webhooks:write'],
      projectId: project.id,
    },
  });
  console.log('✅ API key created (save this!):', apiKeyValue);
  console.log('   Scopes:', apiKey.scopes.join(', '));

  // Create verified domain
  const domain = await prisma.domain.upsert({
    where: { 
      projectId_domain: {
        projectId: project.id,
        domain: 'transactionmail.local'
      }
    },
    update: {},
    create: {
      domain: 'transactionmail.local',
      fromName: 'TransactionMail',
      fromEmail: 'noreply@transactionmail.local',
      replyTo: 'support@transactionmail.local',
      status: DomainStatus.VERIFIED,
      spfRecord: 'v=spf1 include:_spf.transactionmail.com ~all',
      dkimRecord: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC1TaNgLlSyQMNWVLNLvyY/neDgaL2oqQE8T5illKqCgDtFHc8eHVAU+nlcaGmrKmDMw9dbgiGk1ocgZ56NR4ycfUHwQhvQPMUZw0cveel/8EAGoi/UyPmqfcPibytH81NFtTMAxUeM4Op8A6iHkvAMj5qLf4YRNsTkKAKW3OkwPQIDAQAB',
      dmarcRecord: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@transactionmail.com',
      dkimSelector: 'tm2024',
      verifiedAt: new Date(),
      projectId: project.id,
    },
  });
  console.log('✅ Domain created:', domain.domain);

  // Create email template
  const template = await prisma.template.upsert({
    where: {
      projectId_name: {
        projectId: project.id,
        name: 'welcome-email'
      }
    },
    update: {},
    create: {
      name: 'welcome-email',
      subject: 'Welcome to {{companyName}}!',
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #2563eb;">Welcome {{firstName}}!</h1>
    <p>Thank you for joining <strong>{{companyName}}</strong>. We're excited to have you on board.</p>
    <p>Your account is now active and ready to use.</p>
    <div style="margin: 30px 0; text-align: center;">
      <a href="{{dashboardUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Go to Dashboard
      </a>
    </div>
    <p style="color: #666; font-size: 14px;">
      If you have any questions, reply to this email or contact our support team.
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">
      {{companyName}} | {{companyAddress}}
    </p>
  </div>
</body>
</html>`,
      text: `Welcome {{firstName}}!

Thank you for joining {{companyName}}. We're excited to have you on board.

Your account is now active and ready to use.

Visit your dashboard: {{dashboardUrl}}

If you have any questions, reply to this email or contact our support team.

---
{{companyName}} | {{companyAddress}}`,
      variables: ['firstName', 'companyName', 'dashboardUrl', 'companyAddress'],
      projectId: project.id,
    },
  });
  console.log('✅ Template created:', template.name);

  // Create webhook
  const webhook = await prisma.webhook.create({
    data: {
      url: 'https://httpbin.org/post',
      secret: 'whsec_' + Buffer.from(crypto.randomUUID()).toString('base64').slice(0, 32),
      eventTypes: ['message.sent', 'message.delivered', 'message.failed'],
      projectId: project.id,
    },
  });
  console.log('✅ Webhook created:', webhook.url);

  console.log('\n🎉 Seed completed!');
  console.log('\n📋 Quick Start:');
  console.log('   1. API Key:', apiKeyValue);
  console.log('   2. Project ID:', project.id);
  console.log('   3. Template:', template.name);
  console.log('\n   Test with curl:');
  console.log(`   curl -X POST http://localhost:3000/v1/send \\
     -H "Authorization: Bearer ${apiKeyValue}" \\
     -H "Content-Type: application/json" \\
     -d '{
       "to": "test@example.com",
       "from": "noreply@transactionmail.local",
       "subject": "Test Email",
       "text": "Hello World!"
     }'`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
