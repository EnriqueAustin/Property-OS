import { Injectable, Logger } from '@nestjs/common';
import {
  ChannelProvider,
  ChannelAvailabilityUpdate,
  ChannelBooking,
  ChannelRateUpdate,
} from './channel-provider.interface';

@Injectable()
export class AirbnbProvider implements ChannelProvider {
  private readonly logger = new Logger(AirbnbProvider.name);
  readonly type = 'airbnb';

  async validateCredentials(credentials: Record<string, any>): Promise<boolean> {
    const { clientId, clientSecret } = credentials;
    if (!clientId || !clientSecret) {
      this.logger.warn('Missing Airbnb API credentials — falling back to iCal');
      return false;
    }
    // TODO: OAuth2 token exchange with Airbnb Connectivity API
    this.logger.log('Airbnb API credentials validation (pending partner approval)');
    return true;
  }

  async pushAvailability(
    credentials: Record<string, any>,
    updates: ChannelAvailabilityUpdate[],
  ) {
    if (!credentials.clientId) {
      this.logger.log('Airbnb — no API credentials, using iCal export instead');
      return { success: true, updatedCount: 0 };
    }
    this.logger.log(
      `Would push ${updates.length} availability updates to Airbnb`,
    );
    // TODO: PUT /v2/calendars/{listing_id}/{start_date}/{end_date}
    return { success: true, updatedCount: 0 };
  }

  async pushRates(
    credentials: Record<string, any>,
    updates: ChannelRateUpdate[],
  ) {
    if (!credentials.clientId) {
      return { success: true, updatedCount: 0 };
    }
    this.logger.log(`Would push ${updates.length} rate updates to Airbnb`);
    // TODO: PUT /v2/calendars pricing via Airbnb API
    return { success: true, updatedCount: 0 };
  }

  async fetchBookings(
    credentials: Record<string, any>,
    since: Date,
  ): Promise<ChannelBooking[]> {
    if (!credentials.clientId) {
      return [];
    }
    this.logger.log(
      `Would fetch Airbnb bookings since ${since.toISOString()}`,
    );
    // TODO: GET /v2/reservations via Airbnb API
    return [];
  }
}
