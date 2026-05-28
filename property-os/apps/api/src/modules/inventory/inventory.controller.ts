import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import {
  CreateRoomTypeDto,
  UpdateRoomTypeDto,
} from './dto/room-type.dto';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
import {
  AvailabilityQueryDto,
  BlockDatesDto,
  BulkAvailabilityUpdateDto,
  UnblockDatesDto,
} from './dto/availability.dto';
import { CreateRatePeriodDto, UpdateRatePeriodDto } from './dto/rate-period.dto';

@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // Room Types
  @Post('properties/:propertyId/room-types')
  @UseGuards(PropertyGuard)
  createRoomType(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreateRoomTypeDto,
  ) {
    return this.inventory.createRoomType(propertyId, dto);
  }

  @Get('properties/:propertyId/room-types')
  @UseGuards(PropertyGuard)
  listRoomTypes(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.inventory.listRoomTypes(propertyId);
  }

  @Patch('room-types/:roomTypeId')
  updateRoomType(
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Body() dto: UpdateRoomTypeDto,
  ) {
    return this.inventory.updateRoomType(roomTypeId, dto);
  }

  // Rooms
  @Post('properties/:propertyId/rooms')
  @UseGuards(PropertyGuard)
  createRoom(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.inventory.createRoom(propertyId, dto);
  }

  @Get('properties/:propertyId/rooms')
  @UseGuards(PropertyGuard)
  listRooms(@Param('propertyId', new ParseUUIDPipe()) propertyId: string) {
    return this.inventory.listRooms(propertyId);
  }

  @Patch('rooms/:roomId')
  updateRoom(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.inventory.updateRoom(roomId, dto);
  }

  // Availability
  @Get('properties/:propertyId/availability')
  @UseGuards(PropertyGuard)
  availability(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() q: AvailabilityQueryDto,
  ) {
    return this.inventory.getAvailability(propertyId, q);
  }

  @Post('properties/:propertyId/availability/block')
  @UseGuards(PropertyGuard)
  block(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: BlockDatesDto,
  ) {
    return this.inventory.blockDates(propertyId, dto);
  }

  @Post('properties/:propertyId/availability/unblock')
  @UseGuards(PropertyGuard)
  unblock(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: UnblockDatesDto,
  ) {
    return this.inventory.unblockDates(propertyId, dto);
  }

  @Post('properties/:propertyId/availability/bulk-update')
  @UseGuards(PropertyGuard)
  bulkUpdate(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: BulkAvailabilityUpdateDto,
  ) {
    return this.inventory.bulkUpdateAvailability(propertyId, dto);
  }

  // Rate Periods
  @Post('properties/:propertyId/rate-periods')
  @UseGuards(PropertyGuard)
  createRatePeriod(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreateRatePeriodDto,
  ) {
    return this.inventory.createRatePeriod(propertyId, dto);
  }

  @Get('properties/:propertyId/rate-periods')
  @UseGuards(PropertyGuard)
  listRatePeriods(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.inventory.listRatePeriods(propertyId);
  }

  @Patch('rate-periods/:ratePeriodId')
  updateRatePeriod(
    @Param('ratePeriodId', new ParseUUIDPipe()) ratePeriodId: string,
    @Body() dto: UpdateRatePeriodDto,
  ) {
    return this.inventory.updateRatePeriod(ratePeriodId, dto);
  }

  @Delete('rate-periods/:ratePeriodId')
  @HttpCode(204)
  deleteRatePeriod(
    @Param('ratePeriodId', new ParseUUIDPipe()) ratePeriodId: string,
  ) {
    return this.inventory.deleteRatePeriod(ratePeriodId);
  }
}
