import { Injectable, Logger } from '@nestjs/common';

export interface ICalEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  description?: string;
  status?: string;
}

@Injectable()
export class ICalService {
  private readonly logger = new Logger(ICalService.name);

  parseICalFeed(icalText: string): ICalEvent[] {
    const events: ICalEvent[] = [];
    const blocks = icalText.split('BEGIN:VEVENT');

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i]!.split('END:VEVENT')[0] || '';
      const event = this.parseEvent(block);
      if (event) events.push(event);
    }

    return events;
  }

  private parseEvent(block: string): ICalEvent | null {
    const lines = this.unfoldLines(block);
    const fields: Record<string, string> = {};

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).split(';')[0]!.trim().toUpperCase();
      const val = line.substring(colonIdx + 1).trim();
      fields[key] = val;
    }

    const uid = fields['UID'];
    const dtstart = fields['DTSTART'];
    const dtend = fields['DTEND'];

    if (!uid || !dtstart || !dtend) return null;

    return {
      uid,
      summary: fields['SUMMARY'] || 'Blocked',
      dtstart: this.normalizeDate(dtstart),
      dtend: this.normalizeDate(dtend),
      description: fields['DESCRIPTION'],
      status: fields['STATUS'],
    };
  }

  private unfoldLines(text: string): string[] {
    const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
    return unfolded
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  private normalizeDate(val: string): string {
    const clean = val.replace(/[^0-9TZ]/g, '');
    if (clean.length >= 8) {
      return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
    }
    return val;
  }

  generateICalFeed(
    propertyName: string,
    roomName: string,
    bookings: {
      uid: string;
      summary: string;
      checkIn: string;
      checkOut: string;
      description?: string;
    }[],
  ): string {
    const now = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');

    const events = bookings
      .map(
        (b) =>
          `BEGIN:VEVENT\r\n` +
          `UID:${b.uid}\r\n` +
          `DTSTART;VALUE=DATE:${b.checkIn.replace(/-/g, '')}\r\n` +
          `DTEND;VALUE=DATE:${b.checkOut.replace(/-/g, '')}\r\n` +
          `SUMMARY:${this.escapeICalText(b.summary)}\r\n` +
          (b.description
            ? `DESCRIPTION:${this.escapeICalText(b.description)}\r\n`
            : '') +
          `STATUS:CONFIRMED\r\n` +
          `END:VEVENT`,
      )
      .join('\r\n');

    return (
      `BEGIN:VCALENDAR\r\n` +
      `VERSION:2.0\r\n` +
      `PRODID:-//PropertyOS//Channel Manager//EN\r\n` +
      `CALSCALE:GREGORIAN\r\n` +
      `METHOD:PUBLISH\r\n` +
      `X-WR-CALNAME:${this.escapeICalText(propertyName)} - ${this.escapeICalText(roomName)}\r\n` +
      `X-WR-TIMEZONE:Africa/Johannesburg\r\n` +
      `DTSTAMP:${now}\r\n` +
      (events ? events + '\r\n' : '') +
      `END:VCALENDAR`
    );
  }

  private escapeICalText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }
}
