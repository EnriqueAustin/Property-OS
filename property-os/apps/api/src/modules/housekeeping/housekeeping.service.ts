import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { HousekeepingTask, TaskStatus, TaskType, TaskPriority } from './entities/housekeeping-task.entity';
import { CreateHousekeepingTaskDto, UpdateHousekeepingTaskDto } from './dto/housekeeping-task.dto';
import { Booking } from '../bookings/entities/booking.entity';

@Injectable()
export class HousekeepingService {
  private readonly logger = new Logger(HousekeepingService.name);

  constructor(
    @InjectRepository(HousekeepingTask)
    private tasksRepo: Repository<HousekeepingTask>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    private dataSource: DataSource,
  ) {}

  async create(propertyId: string, dto: CreateHousekeepingTaskDto): Promise<HousekeepingTask> {
    const task = this.tasksRepo.create({ ...dto, property_id: propertyId });
    const saved = await this.tasksRepo.save(task);

    if (dto.blocks_room && dto.room_id && dto.task_type === TaskType.MAINTENANCE) {
      await this.blockRoomForMaintenance(dto.room_id, dto.due_date);
    }

    return saved;
  }

  async list(propertyId: string, filters?: { status?: TaskStatus; date?: string; room_id?: string }) {
    const qb = this.tasksRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.room', 'room')
      .leftJoinAndSelect('t.booking', 'booking')
      .where('t.property_id = :propertyId', { propertyId })
      .orderBy('t.due_date', 'ASC')
      .addOrderBy("CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END", 'ASC');

    if (filters?.status) {
      qb.andWhere('t.status = :status', { status: filters.status });
    }
    if (filters?.date) {
      qb.andWhere('t.due_date = :date', { date: filters.date });
    }
    if (filters?.room_id) {
      qb.andWhere('t.room_id = :roomId', { roomId: filters.room_id });
    }

    return qb.getMany();
  }

  async update(taskId: string, dto: UpdateHousekeepingTaskDto): Promise<HousekeepingTask> {
    const task = await this.tasksRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    if (dto.status === TaskStatus.COMPLETED && task.status !== TaskStatus.COMPLETED) {
      task.completed_at = new Date();
    }
    Object.assign(task, dto);
    return this.tasksRepo.save(task);
  }

  async remove(taskId: string): Promise<void> {
    const task = await this.tasksRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    await this.tasksRepo.remove(task);
  }

  async getStats(propertyId: string, date?: string) {
    const qb = this.tasksRepo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('t.property_id = :propertyId', { propertyId })
      .groupBy('t.status');

    if (date) {
      qb.andWhere('t.due_date = :date', { date });
    }

    const rows = await qb.getRawMany();
    return {
      pending: Number(rows.find((r) => r.status === 'pending')?.count ?? 0),
      in_progress: Number(rows.find((r) => r.status === 'in_progress')?.count ?? 0),
      completed: Number(rows.find((r) => r.status === 'completed')?.count ?? 0),
      skipped: Number(rows.find((r) => r.status === 'skipped')?.count ?? 0),
    };
  }

  @OnEvent('booking.checked_out')
  async onCheckout(payload: { bookingId: string }) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: payload.bookingId },
      relations: ['room'],
    });
    if (!booking || !booking.room_id) return;

    const existing = await this.tasksRepo.findOne({
      where: {
        booking_id: booking.id,
        task_type: TaskType.CHECKOUT_CLEAN,
      },
    });
    if (existing) return;

    const task = this.tasksRepo.create({
      property_id: booking.property_id,
      room_id: booking.room_id,
      booking_id: booking.id,
      task_type: TaskType.CHECKOUT_CLEAN,
      title: `Checkout clean — ${booking.room?.name || 'Room'}`,
      due_date: new Date().toISOString().slice(0, 10),
      priority: TaskPriority.HIGH,
      status: TaskStatus.PENDING,
    });
    await this.tasksRepo.save(task);
  }

  async getMaintenanceSummary(propertyId: string) {
    const result = await this.tasksRepo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(t.actual_cost), 0)', 'total_cost')
      .where('t.property_id = :propertyId', { propertyId })
      .andWhere('t.task_type = :type', { type: TaskType.MAINTENANCE })
      .groupBy('t.status')
      .getRawMany();

    return {
      tasks: result.map((r) => ({
        status: r.status,
        count: parseInt(r.count, 10),
        totalCost: parseFloat(r.total_cost),
      })),
      totalMaintenanceCost: result.reduce((s, r) => s + parseFloat(r.total_cost), 0),
    };
  }

  private async blockRoomForMaintenance(roomId: string, date: string) {
    try {
      await this.dataSource.query(
        `UPDATE room_availability
         SET status = 'maintenance', updated_at = NOW()
         WHERE room_id = $1 AND date = $2 AND status = 'available'`,
        [roomId, date],
      );
    } catch (err) {
      this.logger.warn(`Failed to block room ${roomId} for maintenance: ${err}`);
    }
  }

  @OnEvent('booking.created')
  async onBookingCreated(payload: { bookingId: string }) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: payload.bookingId },
      relations: ['room'],
    });
    if (!booking || !booking.room_id) return;

    const task = this.tasksRepo.create({
      property_id: booking.property_id,
      room_id: booking.room_id,
      booking_id: booking.id,
      task_type: TaskType.CHECKIN_PREP,
      title: `Check-in prep — ${booking.room?.name || 'Room'}`,
      due_date: booking.check_in,
      priority: TaskPriority.NORMAL,
      status: TaskStatus.PENDING,
    });
    await this.tasksRepo.save(task);
  }
}
