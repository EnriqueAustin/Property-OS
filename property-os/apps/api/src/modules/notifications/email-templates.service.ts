import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from './entities/email-template.entity';

const AVAILABLE_VARIABLES = {
  booking_confirmation: ['guestName', 'propertyName', 'referenceNumber', 'checkIn', 'checkOut', 'nights', 'roomName', 'totalPrice', 'currency', 'specialRequests', 'checkInTime', 'checkOutTime'],
  booking_cancellation: ['guestName', 'propertyName', 'referenceNumber', 'checkIn', 'checkOut', 'nights', 'reason'],
  new_booking_alert: ['guestName', 'propertyName', 'referenceNumber', 'checkIn', 'checkOut', 'nights', 'roomName', 'totalPrice', 'currency', 'guestEmail', 'guestPhone'],
  payment_received: ['guestName', 'propertyName', 'referenceNumber', 'amountPaid', 'paymentMethod', 'currency'],
  pre_arrival: ['guestName', 'propertyName', 'referenceNumber', 'checkIn', 'checkOut', 'roomName', 'wifiName', 'wifiPassword', 'directions', 'propertyAddress', 'propertyPhone'],
  post_stay_review: ['guestName', 'propertyName', 'checkIn', 'checkOut'],
  booking_modified: ['guestName', 'propertyName', 'referenceNumber', 'checkIn', 'checkOut', 'nights', 'roomName', 'totalPrice', 'currency', 'changes'],
};

@Injectable()
export class EmailTemplatesService {
  constructor(
    @InjectRepository(EmailTemplate)
    private templatesRepo: Repository<EmailTemplate>,
  ) {}

  async list(propertyId: string): Promise<EmailTemplate[]> {
    return this.templatesRepo.find({
      where: { property_id: propertyId },
      order: { template_type: 'ASC' },
    });
  }

  async getOne(propertyId: string, templateId: string): Promise<EmailTemplate> {
    const t = await this.templatesRepo.findOne({ where: { id: templateId, property_id: propertyId } });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  async upsert(propertyId: string, templateType: string, subject: string, bodyHtml: string): Promise<EmailTemplate> {
    let t = await this.templatesRepo.findOne({ where: { property_id: propertyId, template_type: templateType } });
    if (t) {
      t.subject = subject;
      t.body_html = bodyHtml;
    } else {
      t = this.templatesRepo.create({ property_id: propertyId, template_type: templateType, subject, body_html: bodyHtml });
    }
    return this.templatesRepo.save(t);
  }

  async remove(propertyId: string, templateId: string): Promise<void> {
    const t = await this.getOne(propertyId, templateId);
    await this.templatesRepo.remove(t);
  }

  async renderTemplate(
    propertyId: string,
    templateType: string,
    variables: Record<string, string>,
    fallback: { subject: string; html: string },
  ): Promise<{ subject: string; html: string }> {
    const custom = await this.templatesRepo.findOne({
      where: { property_id: propertyId, template_type: templateType, is_active: true },
    });

    if (!custom) return fallback;

    let subject = custom.subject;
    let html = custom.body_html;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(placeholder, value);
      html = html.replace(placeholder, value);
    }

    return { subject, html };
  }

  getAvailableVariables() {
    return AVAILABLE_VARIABLES;
  }

  getTemplateTypes() {
    return Object.keys(AVAILABLE_VARIABLES);
  }
}
