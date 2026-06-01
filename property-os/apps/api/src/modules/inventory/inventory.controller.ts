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
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
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
  @RequirePermission(Permission.INVENTORY_MANAGE)
  createRoomType(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreateRoomTypeDto,
  ) {
    return this.inventory.createRoomType(propertyId, dto);
  }

  @Get('properties/:propertyId/room-types')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_VIEW)
  listRoomTypes(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.inventory.listRoomTypes(propertyId);
  }

  @Patch('properties/:propertyId/room-types/:roomTypeId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_MANAGE)
  updateRoomType(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Body() dto: UpdateRoomTypeDto,
  ) {
    return this.inventory.updateRoomType(roomTypeId, dto);
  }

  // Rooms
  @Post('properties/:propertyId/rooms')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_MANAGE)
  createRoom(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.inventory.createRoom(propertyId, dto);
  }

  @Get('properties/:propertyId/rooms')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_VIEW)
  listRooms(@Param('propertyId', new ParseUUIDPipe()) propertyId: string) {
    return this.inventory.listRooms(propertyId);
  }

  @Patch('properties/:propertyId/rooms/:roomId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_MANAGE)
  updateRoom(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.inventory.updateRoom(roomId, dto);
  }

  // Availability
  @Get('properties/:propertyId/availability')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_VIEW)
  availability(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() q: AvailabilityQueryDto,
  ) {
    return this.inventory.getAvailability(propertyId, q);
  }

  @Post('properties/:propertyId/availability/block')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_MANAGE)
  block(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: BlockDatesDto,
  ) {
    return this.inventory.blockDates(propertyId, dto);
  }

  @Post('properties/:propertyId/availability/unblock')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_MANAGE)
  unblock(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: UnblockDatesDto,
  ) {
    return this.inventory.unblockDates(propertyId, dto);
  }

  @Post('properties/:propertyId/availability/bulk-update')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_MANAGE)
  bulkUpdate(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: BulkAvailabilityUpdateDto,
  ) {
    return this.inventory.bulkUpdateAvailability(propertyId, dto);
  }

  // Rate Periods
  @Post('properties/:propertyId/rate-periods')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_MANAGE)
  createRatePeriod(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreateRatePeriodDto,
  ) {
    return this.inventory.createRatePeriod(propertyId, dto);
  }

  @Get('properties/:propertyId/rate-periods')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_VIEW)
  listRatePeriods(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.inventory.listRatePeriods(propertyId);
  }

  @Patch('properties/:propertyId/rate-periods/:ratePeriodId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_MANAGE)
  updateRatePeriod(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('ratePeriodId', new ParseUUIDPipe()) ratePeriodId: string,
    @Body() dto: UpdateRatePeriodDto,
  ) {
    return this.inventory.updateRatePeriod(ratePeriodId, dto);
  }

  @Delete('properties/:propertyId/rate-periods/:ratePeriodId')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.INVENTORY_MANAGE)
  @HttpCode(204)
  deleteRatePeriod(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('ratePeriodId', new ParseUUIDPipe()) ratePeriodId: string,
  ) {
    return this.inventory.deleteRatePeriod(ratePeriodId);
  }
}
