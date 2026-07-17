import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Thin SMTP transport wrapper. Configuration is entirely env-driven:
 *
 *   SMTP_HOST     — required to enable email delivery
 *   SMTP_PORT     — default 587
 *   SMTP_SECURE   — 'true' for implicit TLS (port 465)
 *   SMTP_USER / SMTP_PASS — optional auth
 *   MAIL_FROM     — sender, default 'SF DevOps Command Center <no-reply@localhost>'
 *
 * When SMTP_HOST is unset the service reports unconfigured and every send is a
 * silent no-op, so notification code never needs its own guards.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null | undefined;

  isConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST);
  }

  /** Best-effort delivery — returns true when the message was accepted. */
  async send(message: MailMessage): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) return false;
    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM ?? 'SF DevOps Command Center <no-reply@localhost>',
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `email send failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private getTransporter(): Transporter | null {
    if (this.transporter !== undefined) return this.transporter;
    if (!this.isConfigured()) {
      this.transporter = null;
      return null;
    }
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    this.transporter = createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
        : undefined,
    });
    return this.transporter;
  }
}
