import nodemailer from 'nodemailer';
import { env } from '../../../config/env.js';

export class AdminNotificationService {
  isConfigured() { return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD); }

  async sendCreatedConfirmation(input: { email: string; displayName: string; loginUrl: string }) {
    if (!this.isConfigured()) return false;
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST!,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
    });
    await transporter.sendMail({
      from: env.EMAIL_FROM ?? env.SMTP_USER!,
      to: input.email,
      subject: 'Your RestoIO platform administrator account is ready',
      text: `Hello ${input.displayName},\n\nYour RestoIO platform administrator account has been created. You can sign in at ${input.loginUrl}.\n\nFor your security, this message does not include your password.`,
    });
    return true;
  }
}

export const adminNotificationService = new AdminNotificationService();
