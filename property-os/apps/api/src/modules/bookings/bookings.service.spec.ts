import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { BookingsService } from './bookings.service';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Guest } from './entities/guest.entity';
import { RoomAvailability } from '../inventory/entities/room-availability.entity';
import { Room } from '../inventory/entities/room.entity';
import { RoomType } from '../inventory/entities/room-type.entity';
import { Property } from '../properties/entities/property.entity';
import { BOOKING_EVENTS } from './events/booking.events';

const mockBooking = {
  id: 'booking-1',
  property_id: 'prop-1',
  room_id: 'room-1',
  guest_id: 'guest-1',
  reference_number: 'POS-2026-0001',
  check_in: '2026-06-01',
  check_out: '2026-06-03',
  nights: 2,
  total_price: 2000,
  nightly_rate: 1000,
  status: BookingStatus.CONFIRMED,
  guest_count: 2,
  special_requests: null,
  internal_notes: null,
  guest: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
  room: { id: 'room-1', room_type: { id: 'rt-1', name: 'Deluxe', base_price: 1000 } },
  property: { id: 'prop-1', name: 'Test Property' },
};

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  })),
});

const mockEventEmitter = {
  emit: jest.fn(),
};

const mockManager = {
  query: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((_, data) => data),
  save: jest.fn((data) => ({ id: 'new-id', ...data })),
};

const mockDataSource = {
  transaction: jest.fn((_, cb) => cb(mockManager)),
};

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingsRepo: ReturnType<typeof mockRepo>;
  let propertiesRepo: ReturnType<typeof mockRepo>;
  let roomTypesRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    bookingsRepo = mockRepo();
    propertiesRepo = mockRepo();
    roomTypesRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: bookingsRepo },
        { provide: getRepositoryToken(Guest), useValue: mockRepo() },
        { provide: getRepositoryToken(RoomAvailability), useValue: mockRepo() },
        { provide: getRepositoryToken(Room), useValue: mockRepo() },
        { provide: getRepositoryToken(RoomType), useValue: roomTypesRepo },
        { provide: getRepositoryToken(Property), useValue: propertiesRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    it('should create a booking when dates are available', async () => {
      mockManager.query
        .mockResolvedValueOnce([ // availability rows (SELECT FOR UPDATE)
          { room_id: 'room-1', date: new Date('2026-06-01'), status: 'available' },
          { room_id: 'room-1', date: new Date('2026-06-02'), status: 'available' },
        ])
        .mockResolvedValueOnce([{ cnt: '5' }]) // count for ref number
        .mockResolvedValueOnce(undefined); // update availability

      mockManager.findOne.mockImplementation((entity: any, opts: any) => {
        const entityName = typeof entity === 'function' ? entity.name : entity;
        if (entityName === 'Room') return Promise.resolve({ id: 'room-1', room_type: { base_price: 1000 } });
        if (entityName === 'Booking') return Promise.resolve({ ...mockBooking, id: 'new-booking' });
        return Promise.resolve(null); // Guest lookups return null (not found → create)
      });

      const result = await service.createBooking({
        propertyId: 'prop-1',
        roomId: 'room-1',
        checkIn: '2026-06-01',
        checkOut: '2026-06-03',
        guest: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
      });

      expect(result).toBeDefined();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        BOOKING_EVENTS.CREATED,
        expect.anything(),
      );
    });

    it('should throw BadRequestException for invalid dates', async () => {
      await expect(
        service.createBooking({
          propertyId: 'prop-1',
          roomId: 'room-1',
          checkIn: '2026-06-03',
          checkOut: '2026-06-01',
          guest: { firstName: 'John', lastName: 'Doe' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when dates are not available', async () => {
      mockManager.query.mockResolvedValueOnce([
        { room_id: 'room-1', date: new Date('2026-06-01'), status: 'booked' },
      ]);

      await expect(
        service.createBooking({
          propertyId: 'prop-1',
          roomId: 'room-1',
          checkIn: '2026-06-01',
          checkOut: '2026-06-03',
          guest: { firstName: 'John', lastName: 'Doe' },
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateStatus', () => {
    it('should allow valid status transition (confirmed → checked_in)', async () => {
      bookingsRepo.findOne.mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
      bookingsRepo.save.mockResolvedValue({ ...mockBooking, status: BookingStatus.CHECKED_IN });

      const result = await service.updateStatus('booking-1', { status: BookingStatus.CHECKED_IN });

      expect(result.status).toBe(BookingStatus.CHECKED_IN);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        BOOKING_EVENTS.MODIFIED,
        expect.objectContaining({
          changes: { status: { old: BookingStatus.CONFIRMED, new: BookingStatus.CHECKED_IN } },
        }),
      );
    });

    it('should reject invalid status transition (pending → checked_in)', async () => {
      bookingsRepo.findOne.mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });

      await expect(
        service.updateStatus('booking-1', { status: BookingStatus.CHECKED_IN }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition from terminal state (cancelled)', async () => {
      bookingsRepo.findOne.mockResolvedValue({ ...mockBooking, status: BookingStatus.CANCELLED });

      await expect(
        service.updateStatus('booking-1', { status: BookingStatus.CONFIRMED }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a confirmed booking and release availability', async () => {
      bookingsRepo.findOne.mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
      mockManager.save.mockResolvedValue({ ...mockBooking, status: BookingStatus.CANCELLED });
      mockManager.query.mockResolvedValue(undefined);
      mockDataSource.transaction.mockImplementation((cb) => cb(mockManager));

      const result = await service.cancelBooking('booking-1', { reason: 'Guest request' });

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        BOOKING_EVENTS.CANCELLED,
        expect.objectContaining({ bookingId: 'booking-1' }),
      );
    });

    it('should reject cancellation of checked_in booking', async () => {
      bookingsRepo.findOne.mockResolvedValue({ ...mockBooking, status: BookingStatus.CHECKED_IN });

      await expect(
        service.cancelBooking('booking-1', { reason: 'Too late' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBooking', () => {
    it('should return a booking with relations', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);

      const result = await service.getBooking('booking-1');
      expect(result.reference_number).toBe('POS-2026-0001');
    });

    it('should throw NotFoundException when booking not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(service.getBooking('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPublicProperty', () => {
    it('should return formatted property info', async () => {
      propertiesRepo.findOne.mockResolvedValue({
        id: 'prop-1',
        name: 'Test Property',
        description: 'A nice place',
        cover_image_url: null,
        photos: [],
        city: 'Cape Town',
        province: 'Western Cape',
        check_in_time: '14:00',
        check_out_time: '10:00',
        is_active: true,
      });
      roomTypesRepo.find.mockResolvedValue([
        {
          id: 'rt-1',
          name: 'Standard',
          description: 'Comfy',
          base_price: 800,
          max_occupancy: 2,
          photos: [],
          amenities: [{ amenity: 'WiFi' }],
        },
      ]);

      const result = await service.getPublicProperty('test-property');

      expect(result.name).toBe('Test Property');
      expect(result.location).toBe('Cape Town, Western Cape');
      expect(result.roomTypes).toHaveLength(1);
      expect(result.roomTypes[0].amenities).toContain('WiFi');
    });

    it('should throw NotFoundException for missing property', async () => {
      propertiesRepo.findOne.mockResolvedValue(null);

      await expect(service.getPublicProperty('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
