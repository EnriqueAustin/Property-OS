import { Injectable } from '@nestjs/common';
import { ChannelProvider } from './channel-provider.interface';
import { ICalChannelProvider } from './ical.provider';
import { BookingComProvider } from './booking-com.provider';
import { AirbnbProvider } from './airbnb.provider';

@Injectable()
export class ChannelProviderRegistry {
  private readonly providers = new Map<string, ChannelProvider>();

  constructor(
    icalProvider: ICalChannelProvider,
    bookingComProvider: BookingComProvider,
    airbnbProvider: AirbnbProvider,
  ) {
    this.providers.set('ical', icalProvider);
    this.providers.set('booking_com', bookingComProvider);
    this.providers.set('airbnb', airbnbProvider);
    this.providers.set('expedia', icalProvider);
    this.providers.set('lekkeslaap', icalProvider);
    this.providers.set('safarinow', icalProvider);
  }

  get(type: string): ChannelProvider | undefined {
    return this.providers.get(type);
  }

  has(type: string): boolean {
    return this.providers.has(type);
  }
}
