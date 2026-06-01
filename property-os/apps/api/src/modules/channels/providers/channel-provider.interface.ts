export interface ChannelAvailabilityUpdate {
  roomTypeId: string;
  externalRoomId: string;
  dates: { date: string; available: boolean; rate?: number }[];
}

export interface ChannelBooking {
  externalId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: number;
  currency: string;
  status: string;
  specialRequests?: string;
}

export interface ChannelRateUpdate {
  externalRoomId: string;
  dates: { date: string; rate: number; minStay?: number }[];
}

export interface ChannelProvider {
  readonly type: string;

  validateCredentials(credentials: Record<string, any>): Promise<boolean>;

  pushAvailability(
    credentials: Record<string, any>,
    updates: ChannelAvailabilityUpdate[],
  ): Promise<{ success: boolean; updatedCount: number }>;

  pushRates(
    credentials: Record<string, any>,
    updates: ChannelRateUpdate[],
  ): Promise<{ success: boolean; updatedCount: number }>;

  fetchBookings(
    credentials: Record<string, any>,
    since: Date,
  ): Promise<ChannelBooking[]>;
}
