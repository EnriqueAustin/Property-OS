export const BOOKING_EVENTS = {
  CREATED: 'booking.created',
  CANCELLED: 'booking.cancelled',
  MODIFIED: 'booking.modified',
  CHECKED_IN: 'booking.checked_in',
  CHECKED_OUT: 'booking.checked_out',
} as const;

export class BookingCreatedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly propertyId?: string,
    public readonly referenceNumber?: string,
    public readonly source?: string,
  ) {}
}

export class BookingCancelledEvent {
  constructor(
    public readonly bookingId: string,
    public readonly reason?: string,
    public readonly propertyId?: string,
  ) {}
}

export class BookingModifiedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly changes: Record<string, { old: any; new: any }>,
    public readonly propertyId?: string,
  ) {}
}
