import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RatePlan } from './entities/rate-plan.entity';

@Injectable()
export class RatePlansService {
  constructor(
    @InjectRepository(RatePlan)
    private ratePlansRepo: Repository<RatePlan>,
  ) {}

  async list(propertyId: string, roomTypeId?: string): Promise<RatePlan[]> {
    const where: any = { property_id: propertyId };
    if (roomTypeId) where.room_type_id = roomTypeId;
    return this.ratePlansRepo.find({ where, order: { sort_order: 'ASC', name: 'ASC' } });
  }

  async getOne(propertyId: string, ratePlanId: string): Promise<RatePlan> {
    const rp = await this.ratePlansRepo.findOne({ where: { id: ratePlanId, property_id: propertyId } });
    if (!rp) throw new NotFoundException('Rate plan not found');
    return rp;
  }

  async create(propertyId: string, dto: Partial<RatePlan>): Promise<RatePlan> {
    const rp = this.ratePlansRepo.create({ ...dto, property_id: propertyId });
    return this.ratePlansRepo.save(rp);
  }

  async update(propertyId: string, ratePlanId: string, dto: Partial<RatePlan>): Promise<RatePlan> {
    const rp = await this.getOne(propertyId, ratePlanId);
    Object.assign(rp, dto);
    return this.ratePlansRepo.save(rp);
  }

  async remove(propertyId: string, ratePlanId: string): Promise<void> {
    const rp = await this.getOne(propertyId, ratePlanId);
    await this.ratePlansRepo.remove(rp);
  }

  async getActiveForRoomType(propertyId: string, roomTypeId: string): Promise<RatePlan[]> {
    return this.ratePlansRepo.find({
      where: { property_id: propertyId, room_type_id: roomTypeId, is_active: true },
      order: { sort_order: 'ASC' },
    });
  }
}
