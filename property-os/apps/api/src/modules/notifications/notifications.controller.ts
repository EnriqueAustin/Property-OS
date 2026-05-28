import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { UpdateNotificationSettingsDto } from './dto/notification-settings.dto';

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('properties/:propertyId/notifications')
  @UseGuards(PropertyGuard)
  listForProperty(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: any,
  ) {
    return this.notifications.listForProperty(propertyId, query);
  }

  @Get('properties/:propertyId/bookings/:bookingId/notifications')
  @UseGuards(PropertyGuard)
  listForBooking(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.notifications.listForBooking(bookingId, propertyId);
  }

  @Post('properties/:propertyId/notifications/:notificationId/resend')
  @UseGuards(PropertyGuard)
  resend(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
  ) {
    return this.notifications.resend(notificationId, propertyId);
  }

  @Get('properties/:propertyId/settings/notifications')
  @UseGuards(PropertyGuard)
  getSettings(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.notifications.getSettings(propertyId);
  }

  @Patch('properties/:propertyId/settings/notifications')
  @UseGuards(PropertyGuard)
  updateSettings(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notifications.updateSettings(propertyId, dto);
  }
}
