import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookingsCleanupService } from './bookings-cleanup.service';
import { Booking, BookingStatus, BookingSource } from './entities/booking.entity';
import { RoomAvailability } from '../inventory/entities/room-availability.entity';

const mockBookingsRepo = {
  find: jest.fn(),
  save: jest.fn(),
};

const mockAvailabilityRepo = {
  createQueryBuilder: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 2 }),
  })),
};

const expiredBooking = (overrides: any = {}) => ({
  id: 'booking-1',
  property_id: 'prop-1',
  room_id: 'room-1',
  status: BookingStatus.PENDING,
  source: BookingSource.DIRECT,
  booked_at: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
  group_id: null,
  ...overrides,
});

describe('BookingsCleanupService', () => {
  let service: BookingsCleanupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsCleanupService,
        { provide: getRepositoryToken(Booking), useValue: mockBookingsRepo },
        { provide: getRepositoryToken(RoomAvailability), useValue: mockAvailabilityRepo },
      ],
    }).compile();

    service = module.get<BookingsCleanupService>(BookingsCleanupService);
    jest.clearAllMocks();
  });

  describe('cancelExpiredPendingBookings', () => {
    it('should do nothing when no expired bookings exist', async () => {
      mockBookingsRepo.find.mockResolvedValue([]);

      await service.cancelExpiredPendingBookings();

      expect(mockBookingsRepo.save).not.toHaveBeenCalled();
    });

    it('should cancel expired pending bookings and release availability', async () => {
      const booking = expiredBooking();
      mockBookingsRepo.find.mockResolvedValueOnce([booking]);
      mockBookingsRepo.save.mockImplementation((data) => Promise.resolve(data));

      await service.cancelExpiredPendingBookings();

      expect(mockBookingsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'booking-1',
          status: BookingStatus.CANCELLED,
          cancelled_at: expect.any(Date),
          cancellation_reason: expect.stringContaining('Auto-cancelled'),
        }),
      );
      expect(mockAvailabilityRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should cancel all siblings in a multi-room group', async () => {
      const booking1 = expiredBooking({ id: 'b-1', group_id: 'grp-1' });
      const booking2 = expiredBooking({ id: 'b-2', group_id: 'grp-1' });
      const sibling = expiredBooking({ id: 'b-3', group_id: 'grp-1' });

      // First call: expired bookings, second call: group siblings
      mockBookingsRepo.find
        .mockResolvedValueOnce([booking1])
        .mockResolvedValueOnce([booking1, booking2, sibling]);
      mockBookingsRepo.save.mockImplementation((data) => Promise.resolve(data));

      await service.cancelExpiredPendingBookings();

      // Should cancel all 3 (deduplicated)
      expect(mockBookingsRepo.save).toHaveBeenCalledTimes(3);
    });

    it('should deduplicate bookings that appear in both expired and sibling lists', async () => {
      const booking = expiredBooking({ id: 'b-1', group_id: 'grp-1' });

      mockBookingsRepo.find
        .mockResolvedValueOnce([booking])
        .mockResolvedValueOnce([booking]); // same booking as sibling
      mockBookingsRepo.save.mockImplementation((data) => Promise.resolve(data));

      await service.cancelExpiredPendingBookings();

      expect(mockBookingsRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should not fetch group siblings when no group_ids exist', async () => {
      const booking = expiredBooking({ group_id: null });
      mockBookingsRepo.find.mockResolvedValueOnce([booking]);
      mockBookingsRepo.save.mockImplementation((data) => Promise.resolve(data));

      await service.cancelExpiredPendingBookings();

      // Only one find call (initial expired query)
      expect(mockBookingsRepo.find).toHaveBeenCalledTimes(1);
      expect(mockBookingsRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});
