import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private resend: Resend | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; providerRef?: string; error?: string }> {
    if (!this.resend) {
      this.logger.warn(
        `[STUB] Email not sent (no RESEND_API_KEY configured). To: ${payload.to}, Subject: ${payload.subject}`,
      );
      this.logger.debug(`[STUB] Email body:\n${payload.html}`);
      return { success: false, error: 'No email provider configured (RESEND_API_KEY missing)' };
    }

    const from = payload.from || this.config.get<string>('EMAIL_FROM') || 'PropertyOS <noreply@propertyos.co.za>';

    try {
      const { data, error } = await this.resend.emails.send({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });

      if (error) {
        this.logger.error(`Resend error: ${error.message}`);
        return { success: false, error: error.message };
      }

      this.logger.log(`Email sent to ${payload.to} — id: ${data?.id}`);
      return { success: true, providerRef: data?.id };
    } catch (err: any) {
      this.logger.error(`Resend exception: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
