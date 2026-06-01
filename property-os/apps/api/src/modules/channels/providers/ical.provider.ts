import { Injectable, Logger } from '@nestjs/common';
import {
  ChannelProvider,
  ChannelAvailabilityUpdate,
  ChannelBooking,
  ChannelRateUpdate,
} from './channel-provider.interface';

@Injectable()
export class ICalChannelProvider implements ChannelProvider {
  private readonly logger = new Logger(ICalChannelProvider.name);
  readonly type = 'ical';

  async validateCredentials(_credentials: Record<string, any>): Promise<boolean> {
    return true;
  }

  async pushAvailability(
    _credentials: Record<string, any>,
    _updates: ChannelAvailabilityUpdate[],
  ) {
    this.logger.log('iCal channels use pull-based export — no push needed');
    return { success: true, updatedCount: 0 };
  }

  async pushRates(
    _credentials: Record<string, any>,
    _updates: ChannelRateUpdate[],
  ) {
    this.logger.log('iCal channels do not support rate push');
    return { success: true, updatedCount: 0 };
  }

  async fetchBookings(
    _credentials: Record<string, any>,
    _since: Date,
  ): Promise<ChannelBooking[]> {
    return [];
  }
}
