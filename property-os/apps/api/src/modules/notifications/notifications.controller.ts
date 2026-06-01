import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailTemplatesService } from './email-templates.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { UpdateNotificationSettingsDto } from './dto/notification-settings.dto';

@Controller()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly emailTemplates: EmailTemplatesService,
  ) {}

  @Get('properties/:propertyId/notifications')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.NOTIFICATIONS_VIEW)
  listForProperty(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: any,
  ) {
    return this.notifications.listForProperty(propertyId, query);
  }

  @Get('properties/:propertyId/bookings/:bookingId/notifications')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.NOTIFICATIONS_VIEW)
  listForBooking(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.notifications.listForBooking(bookingId, propertyId);
  }

  @Post('properties/:propertyId/notifications/:notificationId/resend')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.NOTIFICATIONS_MANAGE)
  resend(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
  ) {
    return this.notifications.resend(notificationId, propertyId);
  }

  @Get('properties/:propertyId/settings/notifications')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.SETTINGS_VIEW)
  getSettings(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.notifications.getSettings(propertyId);
  }

  @Patch('properties/:propertyId/settings/notifications')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.SETTINGS_MANAGE)
  updateSettings(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notifications.updateSettings(propertyId, dto);
  }

  // -- Email Templates --------------------------------------------------------

  @Get('properties/:propertyId/email-templates')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.SETTINGS_VIEW)
  listTemplates(@Param('propertyId', new ParseUUIDPipe()) propertyId: string) {
    return this.emailTemplates.list(propertyId);
  }

  @Get('properties/:propertyId/email-templates/variables')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.SETTINGS_VIEW)
  getTemplateVariables() {
    return this.emailTemplates.getAvailableVariables();
  }

  @Put('properties/:propertyId/email-templates/:templateType')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.SETTINGS_MANAGE)
  upsertTemplate(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('templateType') templateType: string,
    @Body() body: { subject: string; bodyHtml: string },
  ) {
    return this.emailTemplates.upsert(propertyId, templateType, body.subject, body.bodyHtml);
  }

  @Delete('properties/:propertyId/email-templates/:templateId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.SETTINGS_MANAGE)
  removeTemplate(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('templateId', new ParseUUIDPipe()) templateId: string,
  ) {
    return this.emailTemplates.remove(propertyId, templateId);
  }
}
