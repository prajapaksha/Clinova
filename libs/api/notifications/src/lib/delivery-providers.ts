import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export interface OutboundMessage {
  readonly id: string;
  readonly to: string;
  readonly subject: string | null;
  readonly body: string;
}

export interface DeliveryResult {
  readonly provider: string;
  readonly providerMessageId: string | null;
}

export interface DeliveryProvider {
  readonly name: string;
  send(message: OutboundMessage): Promise<DeliveryResult>;
}

/**
 * Development transport: writes each message to FILE_STORAGE_DIR/outbox and logs it,
 * so nothing reaches real patients until SendGrid/Twilio credentials are configured.
 */
export class DevOutboxProvider implements DeliveryProvider {
  readonly name = 'dev-outbox';
  private readonly logger = new Logger('DevOutbox');
  private readonly dir = join(process.env['FILE_STORAGE_DIR'] ?? join(process.cwd(), 'storage'), 'outbox');

  constructor(private readonly channel: 'email' | 'sms') {}

  async send(m: OutboundMessage): Promise<DeliveryResult> {
    const day = new Date().toISOString().slice(0, 10);
    await mkdir(join(this.dir, day), { recursive: true });
    const content = [`To: ${m.to}`, m.subject ? `Subject: ${m.subject}` : null, '', m.body].filter(l => l !== null).join('\n');
    await writeFile(join(this.dir, day, `${m.id}-${this.channel}.txt`), content, 'utf8');
    this.logger.log(`${this.channel.toUpperCase()} → ${m.to}${m.subject ? ` · ${m.subject}` : ''}`);
    return { provider: this.name, providerMessageId: null };
  }
}

/** SendGrid v3 Mail Send over HTTPS (no SDK dependency). */
export class SendGridProvider implements DeliveryProvider {
  readonly name = 'sendgrid';
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(m: OutboundMessage): Promise<DeliveryResult> {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: m.to }] }],
        from: { email: this.from },
        subject: m.subject ?? '',
        content: [{ type: 'text/plain', value: m.body }],
        custom_args: { notification_id: m.id },
      }),
    });
    if (!res.ok) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { provider: this.name, providerMessageId: res.headers.get('x-message-id') };
  }
}

/** Twilio Programmable Messaging over HTTPS (no SDK dependency). */
export class TwilioProvider implements DeliveryProvider {
  readonly name = 'twilio';
  constructor(private readonly accountSid: string, private readonly authToken: string, private readonly from: string) {}

  async send(m: OutboundMessage): Promise<DeliveryResult> {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: m.to, From: this.from, Body: m.body }).toString(),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${json.message ?? 'request failed'}`);
    return { provider: this.name, providerMessageId: json.sid ?? null };
  }
}

/** Picks real providers when credentials are configured, otherwise the dev outbox. */
@Injectable()
export class DeliveryProviders {
  readonly email: DeliveryProvider;
  readonly sms: DeliveryProvider;

  constructor() {
    const env = process.env;
    this.email = env['SENDGRID_API_KEY'] && env['EMAIL_FROM']
      ? new SendGridProvider(env['SENDGRID_API_KEY'], env['EMAIL_FROM'])
      : new DevOutboxProvider('email');
    this.sms = env['TWILIO_ACCOUNT_SID'] && env['TWILIO_AUTH_TOKEN'] && env['TWILIO_FROM']
      ? new TwilioProvider(env['TWILIO_ACCOUNT_SID'], env['TWILIO_AUTH_TOKEN'], env['TWILIO_FROM'])
      : new DevOutboxProvider('sms');
  }
}