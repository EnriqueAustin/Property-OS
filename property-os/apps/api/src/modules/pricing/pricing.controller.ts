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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyGuard } from '../../common/guards/property.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import { PricingService } from './pricing.service';
import { PropertyUser } from '../properties/entities/property-user.entity';
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
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdatePricingRuleDto,
  ) {
    return this.pricingService.update(ruleId, propertyId, dto);
  }

  @Delete(':ruleId')
  @RequirePermission(Permission.PRICING_MANAGE)
  remove(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.pricingService.remove(ruleId, propertyId);
  }
}

@Controller('pricing')
export class PricingPortfolioController {
  constructor(
    private pricingService: PricingService,
    @InjectRepository(PropertyUser)
    private propertyUsersRepo: Repository<PropertyUser>,
  ) {}

  /**
   * Properties where the current user holds PRICING_MANAGE. These portfolio
   * routes have no :propertyId in the URL, so PropertyGuard cannot enforce the
   * permission; instead we restrict every operation to the properties where
   * the caller actually has rate-management rights (S6).
   */
  private async pricingManageProperties(
    userId: string | undefined,
  ): Promise<{ id: string; name: string }[]> {
    if (!userId) return [];
    const links = await this.propertyUsersRepo.find({
      where: { user_id: userId, is_active: true },
      relations: ['property'],
    });
    return links
      .filter((l) => l.property && l.hasPermission(Permission.PRICING_MANAGE))
      .map((l) => ({ id: l.property.id, name: l.property.name }));
  }

  @Get('all')
  async listAll(@Request() req: any) {
    const userId = req.user?.userId ?? req.user?.sub;
    const properties = await this.pricingManageProperties(userId);
    const ids = properties.map((p) => p.id);
    const rules = await this.pricingService.listAcrossProperties(ids);
    return {
      properties,
      rules,
    };
  }

  @Post('bulk')
  async bulkCreate(@Request() req: any, @Body() dto: BulkCreatePricingRuleDto) {
    const userId = req.user?.userId ?? req.user?.sub;
    const properties = await this.pricingManageProperties(userId);
    const validIds = properties.map((p) => p.id);
    dto.property_ids = dto.property_ids.filter((id) => validIds.includes(id));
    return this.pricingService.bulkCreate(dto);
  }
}
