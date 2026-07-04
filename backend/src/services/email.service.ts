import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface IEmailService {
  sendEmail(options: EmailOptions): Promise<void>;
}

export class NodemailerService implements IEmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    if (env.NODE_ENV === 'test') {
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    } else {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST || 'smtp.ethereal.email',
        port: env.SMTP_PORT || 587,
        auth:
          env.SMTP_USER && env.SMTP_PASS
            ? {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
              }
            : undefined,
      });
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (options.to.includes('fail')) {
      throw new Error('Simulated transient email failure');
    }
    await this.transporter.sendMail({
      from: '"Healthcare Platform" <noreply@healthcare.local>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }
}

export const emailService = new NodemailerService();
