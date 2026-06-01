import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromoCode, DiscountType } from './entities/promo-code.entity';
import { Property } from '../properties/entities/property.entity';
import { CreatePromoCodeDto, UpdatePromoCodeDto } from './dto/promo-code.dto';

@Injectable()
export class PromosService {
  constructor(
    @InjectRepository(PromoCode)
    private promosRepo: Repository<PromoCode>,
    @InjectRepository(Property)
    private propertiesRepo: Repository<Property>,
  ) {}

  async create(propertyId: string, dto: CreatePromoCodeDto): Promise<PromoCode> {
    const existing = await this.promosRepo.findOne({
      where: { property_id: propertyId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Promo code "${dto.code}" already exists`);
    }

    const promo = this.promosRepo.create({
      property_id: propertyId,
      code: dto.code,
      description: dto.description,
      discount_type: dto.discountType,
      discount_value: dto.discountValue,
      valid_from: dto.validFrom,
      valid_to: dto.validTo,
      usage_limit: dto.usageLimit,
      min_nights: dto.minNights,
      min_amount: dto.minAmount,
    });
    return this.promosRepo.save(promo);
  }

  async list(propertyId: string): Promise<PromoCode[]> {
    return this.promosRepo.find({
      where: { property_id: propertyId },
      order: { created_at: 'DESC' },
    });
  }

  async getOne(propertyId: string, promoId: string): Promise<PromoCode> {
    const promo = await this.promosRepo.findOne({
      where: { id: promoId, property_id: propertyId },
    });
    if (!promo) throw new NotFoundException('Promo code not found');
    return promo;
  }

  async update(propertyId: string, promoId: string, dto: UpdatePromoCodeDto): Promise<PromoCode> {
    const promo = await this.getOne(propertyId, promoId);
    if (dto.description !== undefined) promo.description = dto.description;
    if (dto.discountType !== undefined) promo.discount_type = dto.discountType;
    if (dto.discountValue !== undefined) promo.discount_value = dto.discountValue;
    if (dto.validFrom !== undefined) promo.valid_from = dto.validFrom;
    if (dto.validTo !== undefined) promo.valid_to = dto.validTo;
    if (dto.usageLimit !== undefined) promo.usage_limit = dto.usageLimit;
    if (dto.minNights !== undefined) promo.min_nights = dto.minNights;
    if (dto.minAmount !== undefined) promo.min_amount = dto.minAmount;
    if (dto.isActive !== undefined) promo.is_active = dto.isActive;
    return this.promosRepo.save(promo);
  }

  async remove(propertyId: string, promoId: string): Promise<void> {
    const promo = await this.getOne(propertyId, promoId);
    await this.promosRepo.remove(promo);
  }

  async validate(
    propertyId: string,
    code: string,
    nights?: number,
    totalAmount?: number,
  ): Promise<{ valid: boolean; discountType?: DiscountType; discountValue?: number; reason?: string }> {
    const promo = await this.promosRepo.findOne({
      where: { property_id: propertyId, code: code.toUpperCase(), is_active: true },
    });

    if (!promo) return { valid: false, reason: 'Invalid promo code' };

    const today = new Date().toISOString().split('T')[0];
    if (promo.valid_from && today < promo.valid_from) {
      return { valid: false, reason: 'Promo code is not yet active' };
    }
    if (promo.valid_to && today > promo.valid_to) {
      return { valid: false, reason: 'Promo code has expired' };
    }
    if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
      return { valid: false, reason: 'Promo code usage limit reached' };
    }
    if (promo.min_nights && nights && nights < promo.min_nights) {
      return { valid: false, reason: `Minimum ${promo.min_nights} nights required` };
    }
    if (promo.min_amount && totalAmount && totalAmount < Number(promo.min_amount)) {
      return { valid: false, reason: `Minimum booking amount of ${promo.min_amount} required` };
    }

    return {
      valid: true,
      discountType: promo.discount_type,
      discountValue: Number(promo.discount_value),
    };
  }

  async applyDiscount(
    propertyId: string,
    code: string,
    totalPrice: number,
  ): Promise<{ discountedPrice: number; discountAmount: number }> {
    const promo = await this.promosRepo.findOne({
      where: { property_id: propertyId, code: code.toUpperCase(), is_active: true },
    });
    if (!promo) return { discountedPrice: totalPrice, discountAmount: 0 };

    let discountAmount = 0;
    if (promo.discount_type === DiscountType.PERCENTAGE) {
      discountAmount = Math.round(totalPrice * (Number(promo.discount_value) / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(Number(promo.discount_value), totalPrice);
    }

    promo.usage_count += 1;
    await this.promosRepo.save(promo);

    return {
      discountedPrice: Math.round((totalPrice - discountAmount) * 100) / 100,
      discountAmount,
    };
  }

  async validateBySlug(
    slug: string,
    code: string,
    nights?: number,
    totalAmount?: number,
  ) {
    const property = await this.propertiesRepo.findOne({ where: { slug } });
    if (!property) throw new NotFoundException('Property not found');
    return this.validate(property.id, code, nights, totalAmount);
  }
}
