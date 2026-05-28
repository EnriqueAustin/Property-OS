import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GuestsService } from './guests.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { UpdateGuestDto } from './dto/guest.dto';

@Controller()
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get('properties/:propertyId/guests')
  @UseGuards(PropertyGuard)
  list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: { search?: string; page?: number; limit?: number },
  ) {
    return this.guests.listGuests(propertyId, query);
  }

  @Get('guests/:guestId')
  getOne(@Param('guestId', new ParseUUIDPipe()) guestId: string) {
    return this.guests.getGuest(guestId);
  }

  @Patch('guests/:guestId')
  update(
    @Param('guestId', new ParseUUIDPipe()) guestId: string,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.guests.updateGuest(guestId, dto);
  }
}
