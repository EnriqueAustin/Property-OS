import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { PricingService } from './pricing.service';
import { PropertiesService } from '../properties/properties.service';
import { CreatePricingRuleDto, UpdatePricingRuleDto, BulkCreatePricingRuleDto } from './dto/pricing-rule.dto';

@Controller('properties/:propertyId/pricing-rules')
@UseGuards(PropertyGuard)
export class PricingController {
  constructor(private pricingService: PricingService) {}

  @Post()
  @RequirePermission(Permission.PRICING_MANAGE)
  create(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreatePricingRuleDto,
  ) {
    return this.pricingService.create(propertyId, dto);
  }

  @Get()
  @RequirePermission(Permission.PRICING_VIEW)
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.pricingService.list(propertyId);
  }

  @Patch(':ruleId')
  @RequirePermission(Permission.PRICING_MANAGE)
  update(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdatePricingRuleDto,
  ) {
    return this.pricingService.update(ruleId, dto);
  }

  @Delete(':ruleId')
  @RequirePermission(Permission.PRICING_MANAGE)
  remove(@Param('ruleId', ParseUUIDPipe) ruleId: string) {
    return this.pricingService.remove(ruleId);
  }
}

@Controller('pricing')
export class PricingPortfolioController {
  constructor(
    private pricingService: PricingService,
    private propertiesService: PropertiesService,
  ) {}

  @Get('all')
  async listAll(@Request() req: any) {
    const userId = req.user?.userId ?? req.user?.sub;
    const properties = await this.propertiesService.listForUser(userId);
    const ids = properties.map((p) => p.id);
    const rules = await this.pricingService.listAcrossProperties(ids);
    return {
      properties: properties.map((p) => ({ id: p.id, name: p.name })),
      rules,
    };
  }

  @Post('bulk')
  async bulkCreate(@Request() req: any, @Body() dto: BulkCreatePricingRuleDto) {
    const userId = req.user?.userId ?? req.user?.sub;
    const properties = await this.propertiesService.listForUser(userId);
    const validIds = properties.map((p) => p.id);
    dto.property_ids = dto.property_ids.filter((id) => validIds.includes(id));
    return this.pricingService.bulkCreate(dto);
  }
}
