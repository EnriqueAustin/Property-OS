import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RatePlansService } from './rate-plans.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';

@Controller('properties/:propertyId/rate-plans')
@UseGuards(PropertyGuard)
export class RatePlansController {
  constructor(private readonly ratePlans: RatePlansService) {}

  @Get()
  @RequirePermission(Permission.INVENTORY_VIEW)
  list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('roomTypeId') roomTypeId?: string,
  ) {
    return this.ratePlans.list(propertyId, roomTypeId);
  }

  @Get(':ratePlanId')
  @RequirePermission(Permission.INVENTORY_VIEW)
  getOne(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('ratePlanId', new ParseUUIDPipe()) ratePlanId: string,
  ) {
    return this.ratePlans.getOne(propertyId, ratePlanId);
  }

  @Post()
  @RequirePermission(Permission.INVENTORY_MANAGE)
  create(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() body: any,
  ) {
    return this.ratePlans.create(propertyId, body);
  }

  @Patch(':ratePlanId')
  @RequirePermission(Permission.INVENTORY_MANAGE)
  update(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('ratePlanId', new ParseUUIDPipe()) ratePlanId: string,
    @Body() body: any,
  ) {
    return this.ratePlans.update(propertyId, ratePlanId, body);
  }

  @Delete(':ratePlanId')
  @RequirePermission(Permission.INVENTORY_MANAGE)
  remove(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('ratePlanId', new ParseUUIDPipe()) ratePlanId: string,
  ) {
    return this.ratePlans.remove(propertyId, ratePlanId);
  }
}
