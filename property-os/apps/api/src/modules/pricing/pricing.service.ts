import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingRule, PricingRuleType } from './entities/pricing-rule.entity';
import { CreatePricingRuleDto, UpdatePricingRuleDto, BulkCreatePricingRuleDto } from './dto/pricing-rule.dto';

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PricingRule)
    private rulesRepo: Repository<PricingRule>,
  ) {}

  create(propertyId: string, dto: CreatePricingRuleDto): Promise<PricingRule> {
    const rule = this.rulesRepo.create({ ...dto, property_id: propertyId });
    return this.rulesRepo.save(rule);
  }

  list(propertyId: string): Promise<PricingRule[]> {
    return this.rulesRepo.find({
      where: { property_id: propertyId },
      relations: ['room_type'],
      order: { priority: 'DESC', created_at: 'ASC' },
    });
  }

  async update(ruleId: string, dto: UpdatePricingRuleDto): Promise<PricingRule> {
    const rule = await this.rulesRepo.findOne({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException('Pricing rule not found');
    Object.assign(rule, dto);
    return this.rulesRepo.save(rule);
  }

  async remove(ruleId: string): Promise<void> {
    const rule = await this.rulesRepo.findOne({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException('Pricing rule not found');
    await this.rulesRepo.remove(rule);
  }

  async bulkCreate(dto: BulkCreatePricingRuleDto): Promise<PricingRule[]> {
    const { property_ids, ...ruleData } = dto;
    const rules = property_ids.map((pid) =>
      this.rulesRepo.create({ ...ruleData, property_id: pid, is_active: true }),
    );
    return this.rulesRepo.save(rules);
  }

  async listAcrossProperties(propertyIds: string[]): Promise<PricingRule[]> {
    if (propertyIds.length === 0) return [];
    return this.rulesRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.room_type', 'rt')
      .where('r.property_id IN (:...ids)', { ids: propertyIds })
      .orderBy('r.property_id', 'ASC')
      .addOrderBy('r.priority', 'DESC')
      .getMany();
  }

  async calculatePrice(
    propertyId: string,
    roomTypeId: string,
    basePrice: number,
    checkInDate: string,
    nightIndex: number,
    totalNights: number,
    occupancyPercent: number,
  ): Promise<{ price: number; appliedRules: string[] }> {
    const rules = await this.rulesRepo.find({
      where: { property_id: propertyId, is_active: true },
      order: { priority: 'DESC' },
    });

    let price = basePrice;
    const appliedRules: string[] = [];
    const nightDate = new Date(checkInDate);
    nightDate.setDate(nightDate.getDate() + nightIndex);
    const dayOfWeek = nightDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const daysUntilCheckin = Math.ceil(
      (new Date(checkInDate).getTime() - Date.now()) / 86400000,
    );

    for (const rule of rules) {
      if (rule.room_type_id && rule.room_type_id !== roomTypeId) continue;

      let applies = false;

      switch (rule.rule_type) {
        case PricingRuleType.WEEKEND:
          applies = isWeekend;
          break;
        case PricingRuleType.WEEKDAY:
          applies = !isWeekend;
          break;
        case PricingRuleType.LAST_MINUTE:
          applies =
            rule.days_before_checkin !== null &&
            daysUntilCheckin <= rule.days_before_checkin;
          break;
        case PricingRuleType.EARLY_BIRD:
          applies =
            rule.days_before_checkin !== null &&
            daysUntilCheckin >= rule.days_before_checkin;
          break;
        case PricingRuleType.LENGTH_OF_STAY:
          applies =
            rule.min_nights !== null && totalNights >= rule.min_nights;
          break;
        case PricingRuleType.OCCUPANCY:
          applies =
            rule.occupancy_threshold_percent !== null &&
            occupancyPercent >= rule.occupancy_threshold_percent;
          break;
      }

      if (applies) {
        price = Math.round(price * (1 + Number(rule.modifier_percent) / 100) * 100) / 100;
        appliedRules.push(rule.name);
      }
    }

    return { price: Math.max(0, price), appliedRules };
  }
}
