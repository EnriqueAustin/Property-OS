import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GuestsService } from './guests.service';
import { Guest } from './entities/guest.entity';
import { Booking } from './entities/booking.entity';

const mockGuest = {
  id: 'guest-1',
  property_id: 'prop-1',
  first_name: 'Sarah',
  last_name: 'Jones',
  email: 'sarah@example.com',
  phone: '+27821111111',
  country: 'ZA',
  total_stays: 3,
  total_revenue: 12000,
};

const mockBooking = {
  id: 'booking-1',
  guest_id: 'guest-1',
  reference_number: 'POS-2026-0001',
  check_in: '2026-06-01',
  check_out: '2026-06-04',
  nights: 3,
  total_price: 6600,
  status: 'confirmed',
  source: 'direct',
  room: { name: 'Ocean View 1', room_type: { name: 'Deluxe Sea View Double' } },
};

const mockGuestsRepo = {
  createQueryBuilder: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockBookingsRepo = {
  find: jest.fn(),
};

describe('GuestsService', () => {
  let service: GuestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuestsService,
        { provide: getRepositoryToken(Guest), useValue: mockGuestsRepo },
        { provide: getRepositoryToken(Booking), useValue: mockBookingsRepo },
      ],
    }).compile();

    service = module.get<GuestsService>(GuestsService);
    jest.clearAllMocks();
  });

  describe('listGuests', () => {
    it('should return paginated guests', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockGuest], 1]),
      };
      mockGuestsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listGuests('prop-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should apply search filter', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockGuestsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listGuests('prop-1', { search: 'sarah', page: 1, limit: 20 });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        { s: '%sarah%' },
      );
    });

    it('should cap limit at 100', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockGuestsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listGuests('prop-1', { page: 1, limit: 500 });

      expect(qb.take).toHaveBeenCalledWith(100);
    });
  });

  describe('getGuest', () => {
    it('should return guest with booking history', async () => {
      mockGuestsRepo.findOne.mockResolvedValue(mockGuest);
      mockBookingsRepo.find.mockResolvedValue([mockBooking]);

      const result = await service.getGuest('guest-1');

      expect(result.id).toBe('guest-1');
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0].referenceNumber).toBe('POS-2026-0001');
      expect(result.bookings[0].roomName).toBe('Ocean View 1');
    });

    it('should throw NotFoundException for unknown guest', async () => {
      mockGuestsRepo.findOne.mockResolvedValue(null);

      await expect(service.getGuest('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateGuest', () => {
    it('should update and return the guest', async () => {
      const updated = { ...mockGuest, phone: '+27829999999' };
      mockGuestsRepo.findOne.mockResolvedValue({ ...mockGuest });
      mockGuestsRepo.save.mockResolvedValue(updated);

      const result = await service.updateGuest('guest-1', { phone: '+27829999999' });

      expect(result.phone).toBe('+27829999999');
    });

    it('should throw NotFoundException for unknown guest', async () => {
      mockGuestsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateGuest('unknown', { phone: '+27829999999' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
