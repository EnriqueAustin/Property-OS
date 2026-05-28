import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { UpdateBookingSettingsDto } from './dto/booking-settings.dto';
import { PropertyGuard } from '../../common/guards/property.guard';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  async create(@Request() req, @Body() dto: CreatePropertyDto) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.propertiesService.create(userId, dto);
  }

  @Get()
  async list(@Request() req) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.propertiesService.listForUser(userId);
  }

  @Get(':propertyId')
  @UseGuards(PropertyGuard)
  async findOne(
    @Request() req,
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    const userId = req.user?.userId ?? req.user?.sub;
    return this.propertiesService.findOneForUser(userId, propertyId);
  }

  @Patch(':propertyId')
  @UseGuards(PropertyGuard)
  async update(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(propertyId, dto);
  }

  @Get(':propertyId/dashboard')
  @UseGuards(PropertyGuard)
  async dashboard(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.propertiesService.getDashboard(propertyId);
  }

  @Get(':propertyId/settings/booking')
  @UseGuards(PropertyGuard)
  async getBookingSettings(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.propertiesService.getBookingSettings(propertyId);
  }

  @Patch(':propertyId/settings/booking')
  @UseGuards(PropertyGuard)
  async updateBookingSettings(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: UpdateBookingSettingsDto,
  ) {
    return this.propertiesService.updateBookingSettings(propertyId, dto);
  }
}
