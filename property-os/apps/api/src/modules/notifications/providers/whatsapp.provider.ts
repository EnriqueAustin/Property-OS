import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WhatsappPayload {
  to: string;
  templateName: string;
  templateParams: Record<string, string>;
}

@Injectable()
export class WhatsappProvider {
  private readonly logger = new Logger(WhatsappProvider.name);

  constructor(private config: ConfigService) {}

  async send(payload: WhatsappPayload): Promise<{ success: boolean; providerRef?: string; error?: string }> {
    const provider = this.config.get<string>('WHATSAPP_PROVIDER'); // 'twilio' | 'clickatell' | undefined

    if (!provider) {
      this.logger.warn(
        `[STUB] WhatsApp not sent (no WHATSAPP_PROVIDER configured). To: ${payload.to}, Template: ${payload.templateName}`,
      );
      this.logger.debug(`[STUB] Template params: ${JSON.stringify(payload.templateParams)}`);
      return { success: false, error: 'No WhatsApp provider configured (WHATSAPP_PROVIDER missing)' };
    }

    // Future: plug in real Twilio/Clickatell SDK here
    // if (provider === 'twilio') { ... }
    // if (provider === 'clickatell') { ... }

    this.logger.warn(`Unknown WHATSAPP_PROVIDER: ${provider}. Message not sent.`);
    return { success: false, error: `Unknown provider: ${provider}` };
  }
}
