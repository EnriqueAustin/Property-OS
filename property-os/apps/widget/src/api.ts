export interface RoomType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  maxOccupancy: number;
  amenities: string[];
}

export interface PropertyInfo {
  name: string;
  description: string;
  coverImage: string | null;
  location: string;
  checkInTime: string;
  checkOutTime: string;
  roomTypes: RoomType[];
}

export interface AvailableRoom {
  roomTypeId: string;
  roomTypeName: string;
  description: string;
  amenities: string[];
  nightlyRate: number;
  totalPrice: number;
  availableCount: number;
  maxOccupancy: number;
}

export interface AvailabilityResult {
  checkIn: string;
  checkOut: string;
  nights: number;
  availableRooms: AvailableRoom[];
}

export interface BookingResult {
  id: string;
  reference_number: string;
  total_price: number;
}

export interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialRequests?: string;
}

function unwrap<T>(json: any): T {
  return json.data ?? json;
}

export class Api {
  constructor(private baseUrl: string) {}

  async getProperty(slug: string): Promise<PropertyInfo> {
    const res = await fetch(`${this.baseUrl}/public/properties/${slug}`);
    if (!res.ok) throw new Error('Property not found');
    return unwrap(await res.json());
  }

  async checkAvailability(slug: string, checkIn: string, checkOut: string, guests: number): Promise<AvailabilityResult> {
    const res = await fetch(
      `${this.baseUrl}/public/properties/${slug}/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`,
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error?.message || body.message || 'Failed to check availability');
    }
    return unwrap(await res.json());
  }

  async createBooking(params: {
    propertySlug: string;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    guestCount: number;
    guest: GuestDetails;
    specialRequests?: string;
  }): Promise<BookingResult> {
    const res = await fetch(`${this.baseUrl}/public/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertySlug: params.propertySlug,
        roomTypeId: params.roomTypeId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        guestCount: params.guestCount,
        guest: {
          firstName: params.guest.firstName,
          lastName: params.guest.lastName,
          email: params.guest.email,
          phone: params.guest.phone,
        },
        specialRequests: params.specialRequests || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error?.message || body.message || 'Booking failed');
    }
    return unwrap(await res.json());
  }
}
