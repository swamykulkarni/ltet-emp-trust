import { Twilio } from 'twilio';
import { NotificationDeliveryResult } from '../../models/notification.model';

export interface SMSConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class SMSDeliveryService {
  private client: Twilio;
  private fromNumber: string;

  constructor(config: SMSConfig) {
    this.client = new Twilio(config.accountSid, config.authToken);
    this.fromNumber = config.fromNumber;
  }

  async sendSMS(to: string, message: string): Promise<NotificationDeliveryResult> {
    try {
      // Ensure the phone number is in E.164 format
      const formattedTo = this.formatPhoneNumber(to);
      
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedTo,
      });

      return {
        success: true,
        messageId: result.sid,
        externalId: result.sid,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        retryable: this.isRetryableError(error),
      };
    }
  }

  async getDeliveryStatus(messageSid: string): Promise<string | null> {
    try {
      const message = await this.client.messages(messageSid).fetch();
      return message.status;
    } catch (error) {
      console.error('Failed to get SMS delivery status:', error);
      return null;
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // If it starts with country code, use as is
    if (digits.startsWith('91') && digits.length === 12) {
      return `+${digits}`;
    }
    
    // If it's a 10-digit Indian number, add country code
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    
    // Return as is if already formatted
    if (phoneNumber.startsWith('+')) {
      return phoneNumber;
    }
    
    // Default to adding +91 for Indian numbers
    return `+91${digits}`;
  }

  private isRetryableError(error: any): boolean {
    // Twilio error codes that are retryable
    const retryableErrorCodes = [
      20003, // Authentication Error (temporary)
      20429, // Too Many Requests
      21610, // Message cannot be sent to the destination number
      30001, // Queue overflow
      30002, // Account suspended
      30003, // Unreachable destination handset
      30004, // Message blocked
      30005, // Unknown destination handset
      30006, // Landline or unreachable carrier
    ];

    return error.code && retryableErrorCodes.includes(error.code);
  }
}