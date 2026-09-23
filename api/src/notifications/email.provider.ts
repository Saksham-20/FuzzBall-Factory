import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '../config/env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  /** True when nothing was really sent (no RESEND_API_KEY): the email was logged to the console. */
  mock: boolean;
  id?: string;
}

/** Resend when `RESEND_API_KEY` is set, otherwise logs the email (subject, recipient, plain text) to the console. */
@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private client?: Resend;

  constructor(private readonly config: ConfigService<Env, true>) {}

  isMock(): boolean {
    return !this.config.get('RESEND_API_KEY', { infer: true });
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const key = this.config.get('RESEND_API_KEY', { infer: true });
    if (!key) {
      this.logger.log(`[email:mock] to=${message.to} subject="${message.subject}"\n${message.text}`);
      return { mock: true };
    }
    this.client ??= new Resend(key);
    const { data, error } = await this.client.emails.send({
      from: this.config.get('MAIL_FROM', { infer: true }),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
    return { mock: false, id: data?.id };
  }
}
