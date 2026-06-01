import { Test, TestingModule } from '@nestjs/testing';
import { ICalService, ICalEvent } from './ical.service';

describe('ICalService', () => {
  let service: ICalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ICalService],
    }).compile();

    service = module.get<ICalService>(ICalService);
  });

  describe('parseICalFeed', () => {
    it('should parse a standard iCal feed with one event', () => {
      const ical = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'UID:abc123@airbnb.com',
        'DTSTART:20260601',
        'DTEND:20260604',
        'SUMMARY:Reserved - John Doe',
        'DESCRIPTION:Guest checkout',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const events = service.parseICalFeed(ical);

      expect(events).toHaveLength(1);
      expect(events[0].uid).toBe('abc123@airbnb.com');
      expect(events[0].dtstart).toBe('2026-06-01');
      expect(events[0].dtend).toBe('2026-06-04');
      expect(events[0].summary).toBe('Reserved - John Doe');
      expect(events[0].description).toBe('Guest checkout');
      expect(events[0].status).toBe('CONFIRMED');
    });

    it('should parse multiple events', () => {
      const ical = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:event1@test',
        'DTSTART:20260601',
        'DTEND:20260603',
        'SUMMARY:Booking 1',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:event2@test',
        'DTSTART:20260610',
        'DTEND:20260615',
        'SUMMARY:Booking 2',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const events = service.parseICalFeed(ical);

      expect(events).toHaveLength(2);
      expect(events[0].uid).toBe('event1@test');
      expect(events[1].uid).toBe('event2@test');
    });

    it('should handle dates with T and Z markers', () => {
      const ical = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:tz-event@test',
        'DTSTART:20260715T140000Z',
        'DTEND:20260718T100000Z',
        'SUMMARY:With time',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const events = service.parseICalFeed(ical);

      expect(events[0].dtstart).toBe('2026-07-15');
      expect(events[0].dtend).toBe('2026-07-18');
    });

    it('should handle DTSTART with VALUE=DATE parameter', () => {
      const ical = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:date-val@test',
        'DTSTART;VALUE=DATE:20260801',
        'DTEND;VALUE=DATE:20260803',
        'SUMMARY:Date value',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const events = service.parseICalFeed(ical);

      expect(events[0].dtstart).toBe('2026-08-01');
      expect(events[0].dtend).toBe('2026-08-03');
    });

    it('should skip events missing required fields', () => {
      const ical = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:valid@test',
        'DTSTART:20260601',
        'DTEND:20260603',
        'SUMMARY:Valid',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'SUMMARY:No UID or dates',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const events = service.parseICalFeed(ical);

      expect(events).toHaveLength(1);
      expect(events[0].uid).toBe('valid@test');
    });

    it('should default summary to "Blocked" when not provided', () => {
      const ical = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:no-summary@test',
        'DTSTART:20260901',
        'DTEND:20260902',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const events = service.parseICalFeed(ical);

      expect(events[0].summary).toBe('Blocked');
    });

    it('should handle line folding (continuation lines)', () => {
      const ical = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:folded@test',
        'DTSTART:20260601',
        'DTEND:20260603',
        'SUMMARY:A very long summary that',
        ' continues on the next line',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const events = service.parseICalFeed(ical);

      expect(events[0].summary).toBe('A very long summary thatcontinues on the next line');
    });

    it('should return empty array for empty/invalid input', () => {
      expect(service.parseICalFeed('')).toHaveLength(0);
      expect(service.parseICalFeed('not ical at all')).toHaveLength(0);
    });
  });

  describe('generateICalFeed', () => {
    it('should generate a valid iCal feed', () => {
      const result = service.generateICalFeed('Seaside Lodge', 'Room 1', [
        {
          uid: 'booking-1@propertyos',
          summary: 'Reserved - John Doe',
          checkIn: '2026-06-01',
          checkOut: '2026-06-04',
          description: '3 nights',
        },
      ]);

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('END:VCALENDAR');
      expect(result).toContain('BEGIN:VEVENT');
      expect(result).toContain('UID:booking-1@propertyos');
      expect(result).toContain('DTSTART;VALUE=DATE:20260601');
      expect(result).toContain('DTEND;VALUE=DATE:20260604');
      expect(result).toContain('SUMMARY:Reserved - John Doe');
      expect(result).toContain('DESCRIPTION:3 nights');
      expect(result).toContain('STATUS:CONFIRMED');
      expect(result).toContain('X-WR-CALNAME:Seaside Lodge - Room 1');
    });

    it('should generate feed with multiple bookings', () => {
      const result = service.generateICalFeed('Hotel', 'Suite', [
        { uid: 'b1', summary: 'Guest 1', checkIn: '2026-06-01', checkOut: '2026-06-03' },
        { uid: 'b2', summary: 'Guest 2', checkIn: '2026-06-10', checkOut: '2026-06-12' },
      ]);

      expect(result.match(/BEGIN:VEVENT/g)).toHaveLength(2);
      expect(result).toContain('UID:b1');
      expect(result).toContain('UID:b2');
    });

    it('should generate valid feed with no bookings', () => {
      const result = service.generateICalFeed('Hotel', 'Room', []);

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('END:VCALENDAR');
      expect(result).not.toContain('BEGIN:VEVENT');
    });

    it('should escape special characters in text', () => {
      const result = service.generateICalFeed('Hotel; Beach', 'Room, 1', [
        {
          uid: 'esc-1',
          summary: 'Guest; with, special chars',
          checkIn: '2026-06-01',
          checkOut: '2026-06-02',
        },
      ]);

      expect(result).toContain('Guest\\; with\\, special chars');
      expect(result).toContain('Hotel\\; Beach - Room\\, 1');
    });

    it('should omit DESCRIPTION when not provided', () => {
      const result = service.generateICalFeed('Hotel', 'Room', [
        { uid: 'no-desc', summary: 'Test', checkIn: '2026-06-01', checkOut: '2026-06-02' },
      ]);

      expect(result).not.toContain('DESCRIPTION:');
    });
  });
});
