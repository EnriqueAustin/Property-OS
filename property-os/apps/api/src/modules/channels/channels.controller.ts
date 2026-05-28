import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChannelsService } from './channels.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import {
  CreateChannelMappingDto,
  UpdateChannelMappingDto,
} from './dto/channel-mapping.dto';

@Controller()
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  // --- Admin endpoints (auth + property guard) ------------------------------

  @Post('properties/:propertyId/channels')
  @UseGuards(PropertyGuard)
  create(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreateChannelDto,
  ) {
    dto.propertyId = propertyId;
    return this.channels.createChannel(dto);
  }

  @Get('properties/:propertyId/channels')
  @UseGuards(PropertyGuard)
  list(@Param('propertyId', new ParseUUIDPipe()) propertyId: string) {
    return this.channels.listChannels(propertyId);
  }

  @Get('properties/:propertyId/channels/:channelId')
  @UseGuards(PropertyGuard)
  getOne(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
  ) {
    return this.channels.getChannel(channelId);
  }

  @Patch('properties/:propertyId/channels/:channelId')
  @UseGuards(PropertyGuard)
  update(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channels.updateChannel(channelId, dto);
  }

  @Delete('properties/:propertyId/channels/:channelId')
  @UseGuards(PropertyGuard)
  remove(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
  ) {
    return this.channels.deleteChannel(channelId);
  }

  // --- Mapping endpoints ----------------------------------------------------

  @Post('properties/:propertyId/channels/:channelId/mappings')
  @UseGuards(PropertyGuard)
  addMapping(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
    @Body() dto: CreateChannelMappingDto,
  ) {
    return this.channels.addMapping(channelId, dto);
  }

  @Patch('properties/:propertyId/channels/:channelId/mappings/:mappingId')
  @UseGuards(PropertyGuard)
  updateMapping(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('channelId', new ParseUUIDPipe()) _channelId: string,
    @Param('mappingId', new ParseUUIDPipe()) mappingId: string,
    @Body() dto: UpdateChannelMappingDto,
  ) {
    return this.channels.updateMapping(mappingId, dto);
  }

  @Delete('properties/:propertyId/channels/:channelId/mappings/:mappingId')
  @UseGuards(PropertyGuard)
  removeMapping(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('channelId', new ParseUUIDPipe()) _channelId: string,
    @Param('mappingId', new ParseUUIDPipe()) mappingId: string,
  ) {
    return this.channels.removeMapping(mappingId);
  }

  // --- Sync endpoints -------------------------------------------------------

  @Post('properties/:propertyId/channels/:channelId/sync')
  @UseGuards(PropertyGuard)
  triggerSync(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
  ) {
    return this.channels.syncICalImport(channelId);
  }

  @Get('properties/:propertyId/channels/:channelId/logs')
  @UseGuards(PropertyGuard)
  getSyncLogs(
    @Param('propertyId', new ParseUUIDPipe()) _propertyId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
    @Query('limit') limit?: string,
  ) {
    return this.channels.getSyncLogs(channelId, limit ? parseInt(limit) : 20);
  }

  // --- Revenue by channel report -------------------------------------------

  @Get('properties/:propertyId/channels/reports/revenue')
  @UseGuards(PropertyGuard)
  revenueByChannel(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.channels.getRevenueByChannel(propertyId, from, to);
  }

  // --- Rate parity -----------------------------------------------------------

  @Get('properties/:propertyId/channels/reports/rate-parity')
  @UseGuards(PropertyGuard)
  rateParity(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.channels.getRateParity(propertyId);
  }

  // --- Public iCal export (no auth, token-based) ----------------------------

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('public/ical/:token/:roomTypeId')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'inline; filename="calendar.ics"')
  icalExport(
    @Param('token') token: string,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
  ) {
    return this.channels.getICalExportByToken(token, roomTypeId);
  }
}
