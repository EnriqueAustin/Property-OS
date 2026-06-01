import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HousekeepingService } from './housekeeping.service';
import {
  HousekeepingTask,
  TaskStatus,
  TaskType,
  TaskPriority,
} from './entities/housekeeping-task.entity';
import { Booking } from '../bookings/entities/booking.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'task-1', ...data })),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
  })),
});

const mockDataSource = {
  query: jest.fn(),
};

const mockTask = (overrides: Partial<HousekeepingTask> = {}): HousekeepingTask => ({
  id: 'task-1',
  property_id: 'prop-1',
  room_id: 'room-1',
  booking_id: null as any,
  task_type: TaskType.CHECKOUT_CLEAN,
  status: TaskStatus.PENDING,
  priority: TaskPriority.HIGH,
  title: 'Checkout clean — Room 1',
  notes: null as any,
  due_date: '2026-06-01',
  assigned_to: null as any,
  completed_at: null as any,
  estimated_cost: null as any,
  actual_cost: null as any,
  vendor: null as any,
  vendor_phone: null as any,
  resolution_notes: null as any,
  blocks_room: false,
  created_at: new Date(),
  updated_at: new Date(),
  property: null as any,
  room: null as any,
  booking: null as any,
  ...overrides,
});

const mockBooking = {
  id: 'booking-1',
  property_id: 'prop-1',
  room_id: 'room-1',
  check_in: '2026-06-05',
  check_out: '2026-06-07',
  room: { id: 'room-1', name: 'Room 1' },
};

describe('HousekeepingService', () => {
  let service: HousekeepingService;
  let tasksRepo: ReturnType<typeof mockRepo>;
  let bookingsRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    tasksRepo = mockRepo();
    bookingsRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HousekeepingService,
        { provide: getRepositoryToken(HousekeepingTask), useValue: tasksRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingsRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<HousekeepingService>(HousekeepingService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // CRUD
  // =========================================================================

  describe('create', () => {
    it('should create a housekeeping task', async () => {
      tasksRepo.save.mockResolvedValue(mockTask());
      mockDataSource.query.mockResolvedValue(undefined);

      const result = await service.create('prop-1', {
        task_type: TaskType.CHECKOUT_CLEAN,
        title: 'Checkout clean — Room 1',
        due_date: '2026-06-01',
        priority: TaskPriority.HIGH,
        blocks_room: false,
      } as any);

      expect(tasksRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ property_id: 'prop-1' }),
      );
      expect(result.id).toBe('task-1');
    });

    it('should block room availability when task is maintenance and blocks_room=true', async () => {
      tasksRepo.save.mockResolvedValue(mockTask({ task_type: TaskType.MAINTENANCE, blocks_room: true }));
      mockDataSource.query.mockResolvedValue(undefined);

      await service.create('prop-1', {
        task_type: TaskType.MAINTENANCE,
        title: 'Fix AC',
        due_date: '2026-06-01',
        priority: TaskPriority.HIGH,
        blocks_room: true,
        room_id: 'room-1',
      } as any);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'maintenance'"),
        ['room-1', '2026-06-01'],
      );
    });

    it('should NOT block room when blocks_room=false', async () => {
      tasksRepo.save.mockResolvedValue(mockTask());

      await service.create('prop-1', {
        task_type: TaskType.CHECKOUT_CLEAN,
        title: 'Clean',
        due_date: '2026-06-01',
        blocks_room: false,
      } as any);

      expect(mockDataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should return tasks for a property', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTask()]),
      };
      tasksRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.list('prop-1');

      expect(qb.where).toHaveBeenCalledWith('t.property_id = :propertyId', { propertyId: 'prop-1' });
      expect(result).toHaveLength(1);
    });

    it('should apply status filter when provided', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      tasksRepo.createQueryBuilder.mockReturnValue(qb);

      await service.list('prop-1', { status: TaskStatus.PENDING });

      expect(qb.andWhere).toHaveBeenCalledWith('t.status = :status', { status: TaskStatus.PENDING });
    });

    it('should apply date filter when provided', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      tasksRepo.createQueryBuilder.mockReturnValue(qb);

      await service.list('prop-1', { date: '2026-06-01' });

      expect(qb.andWhere).toHaveBeenCalledWith('t.due_date = :date', { date: '2026-06-01' });
    });
  });

  describe('update', () => {
    it('should update task status', async () => {
      tasksRepo.findOne.mockResolvedValue(mockTask());
      tasksRepo.save.mockImplementation((data) => Promise.resolve({ ...data }));

      const result = await service.update('task-1', { status: TaskStatus.IN_PROGRESS } as any);

      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should set completed_at when status transitions to completed', async () => {
      tasksRepo.findOne.mockResolvedValue(mockTask({ status: TaskStatus.IN_PROGRESS }));
      tasksRepo.save.mockImplementation((data) => Promise.resolve({ ...data }));

      await service.update('task-1', { status: TaskStatus.COMPLETED } as any);

      expect(tasksRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ completed_at: expect.any(Date) }),
      );
    });

    it('should NOT update completed_at when already completed', async () => {
      const alreadyCompleted = mockTask({ status: TaskStatus.COMPLETED, completed_at: new Date('2026-01-01') });
      tasksRepo.findOne.mockResolvedValue(alreadyCompleted);
      tasksRepo.save.mockImplementation((data) => Promise.resolve({ ...data }));

      await service.update('task-1', { status: TaskStatus.COMPLETED } as any);

      expect(tasksRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ completed_at: alreadyCompleted.completed_at }),
      );
    });

    it('should throw NotFoundException when task does not exist', async () => {
      tasksRepo.findOne.mockResolvedValue(null);

      await expect(service.update('nope', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an existing task', async () => {
      const existing = mockTask();
      tasksRepo.findOne.mockResolvedValue(existing);
      tasksRepo.remove.mockResolvedValue(undefined);

      await service.remove('task-1');

      expect(tasksRepo.remove).toHaveBeenCalledWith(existing);
    });

    it('should throw NotFoundException when task not found', async () => {
      tasksRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getStats
  // =========================================================================

  describe('getStats', () => {
    it('should return status counts as numbers', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'pending', count: '3' },
          { status: 'in_progress', count: '1' },
          { status: 'completed', count: '5' },
        ]),
      };
      tasksRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStats('prop-1');

      expect(result.pending).toBe(3);
      expect(result.in_progress).toBe(1);
      expect(result.completed).toBe(5);
      expect(result.skipped).toBe(0);
    });

    it('should return zeros when no tasks exist', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      tasksRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStats('prop-1');

      expect(result.pending).toBe(0);
      expect(result.in_progress).toBe(0);
      expect(result.completed).toBe(0);
    });
  });

  // =========================================================================
  // Event listeners
  // =========================================================================

  describe('onCheckout (event: booking.checked_out)', () => {
    it('should create a checkout_clean task when booking exists with a room', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      tasksRepo.findOne.mockResolvedValue(null); // no existing task
      tasksRepo.save.mockResolvedValue(mockTask({ task_type: TaskType.CHECKOUT_CLEAN }));

      await service.onCheckout({ bookingId: 'booking-1' });

      expect(tasksRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          task_type: TaskType.CHECKOUT_CLEAN,
          booking_id: 'booking-1',
          property_id: 'prop-1',
        }),
      );
      expect(tasksRepo.save).toHaveBeenCalled();
    });

    it('should NOT create duplicate task if one already exists', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      tasksRepo.findOne.mockResolvedValue(mockTask({ task_type: TaskType.CHECKOUT_CLEAN }));

      await service.onCheckout({ bookingId: 'booking-1' });

      expect(tasksRepo.save).not.toHaveBeenCalled();
    });

    it('should do nothing when booking not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await service.onCheckout({ bookingId: 'nope' });

      expect(tasksRepo.save).not.toHaveBeenCalled();
    });

    it('should do nothing when booking has no room_id', async () => {
      bookingsRepo.findOne.mockResolvedValue({ ...mockBooking, room_id: null });

      await service.onCheckout({ bookingId: 'booking-1' });

      expect(tasksRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('onBookingCreated (event: booking.created)', () => {
    it('should create a checkin_prep task when booking is created', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      tasksRepo.save.mockResolvedValue(mockTask({ task_type: TaskType.CHECKIN_PREP }));

      await service.onBookingCreated({ bookingId: 'booking-1' });

      expect(tasksRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          task_type: TaskType.CHECKIN_PREP,
          booking_id: 'booking-1',
          due_date: mockBooking.check_in,
        }),
      );
    });

    it('should do nothing when booking not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await service.onBookingCreated({ bookingId: 'nope' });

      expect(tasksRepo.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // getMaintenanceSummary
  // =========================================================================

  describe('getMaintenanceSummary', () => {
    it('should return maintenance cost summary', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'pending', count: '2', total_cost: '0.00' },
          { status: 'completed', count: '3', total_cost: '4500.00' },
        ]),
      };
      tasksRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getMaintenanceSummary('prop-1');

      expect(result.totalMaintenanceCost).toBe(4500);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[1].totalCost).toBe(4500);
    });
  });
});
