import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FrontdeskService } from './frontdesk.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { AddFolioItemDto } from './dto/folio.dto';

@Controller('properties/:propertyId/frontdesk')
@UseGuards(PropertyGuard)
export class FrontdeskController {
  constructor(private readonly frontdesk: FrontdeskService) {}

  @Get('today')
  @RequirePermission(Permission.FRONTDESK_VIEW)
  todayBoard(@Param('propertyId', new ParseUUIDPipe()) propertyId: string) {
    return this.frontdesk.getTodayBoard(propertyId);
  }

  @Get('folio/:bookingId')
  @RequirePermission(Permission.FRONTDESK_VIEW)
  getFolio(@Param('bookingId', new ParseUUIDPipe()) bookingId: string) {
    return this.frontdesk.getBookingFolio(bookingId);
  }

  @Post('folio')
  @RequirePermission(Permission.FRONTDESK_MANAGE)
  addFolioItem(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: AddFolioItemDto,
    @Req() req: any,
  ) {
    const userName = req.user?.email || req.user?.firstName || 'staff';
    return this.frontdesk.addFolioItem(propertyId, dto, userName);
  }

  @Delete('folio/:itemId')
  @RequirePermission(Permission.FRONTDESK_MANAGE)
  deleteFolioItem(@Param('itemId', new ParseUUIDPipe()) itemId: string) {
    return this.frontdesk.deleteFolioItem(itemId);
  }

  @Post('folio/:bookingId/post-room-charges')
  @RequirePermission(Permission.FRONTDESK_MANAGE)
  postRoomCharges(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.frontdesk.autoPostRoomCharges(bookingId, propertyId);
  }
}
