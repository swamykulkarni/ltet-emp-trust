import nodemailer from 'nodemailer';
import { NotificationDeliveryResult } from '../../models/notification.model';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class EmailDeliveryService {
  private transporter: nodemailer.Transporter;
  private fromAddress: string;

  constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
    this.fromAddress = config.from;
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
    textContent?: string
  ): Promise<NotificationDeliveryResult> {
    try {
      const mailOptions = {
        from: this.fromAddress,
        to,
        subject,
        html: htmlContent,
        text: textContent || this.stripHtml(htmlContent),
      };

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
        externalId: info.messageId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        retryable: this.isRetryableError(error),
      };
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  private isRetryableError(error: any): boolean {
    // Network errors, temporary server errors, etc. are retryable
    const retryableCodes = ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
    return retryableCodes.includes(error.code) || 
           (error.responseCode && error.responseCode >= 500);
  }
}