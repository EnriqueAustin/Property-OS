export const BOOKING_EVENTS = {
  CREATED: 'booking.created',
  CANCELLED: 'booking.cancelled',
  MODIFIED: 'booking.modified',
} as const;

export class BookingCreatedEvent {
  constructor(public readonly bookingId: string) {}
}

export class BookingCancelledEvent {
  constructor(
    public readonly bookingId: string,
    public readonly reason?: string,
  ) {}
}

export class BookingModifiedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly changes: Record<string, { old: any; new: any }>,
  ) {}
}
