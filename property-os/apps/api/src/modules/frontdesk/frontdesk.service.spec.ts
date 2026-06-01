import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FrontdeskService } from './frontdesk.service';
import { FolioItem, FolioCategory } from './entities/folio-item.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'item-1', ...data })),
  remove: jest.fn(),
});

const mockDataSource = {
  query: jest.fn(),
};

const mockBooking = (overrides: any = {}) => ({
  id: 'booking-1',
  property_id: 'prop-1',
  reference_number: 'POS-001',
  check_in: '2026-06-01',
  check_out: '2026-06-03',
  nights: 2,
  guest_count: 2,
  total_price: '2000',
  nightly_rate: '1000',
  currency: 'ZAR',
  status: BookingStatus.CONFIRMED,
  guest: { first_name: 'John', last_name: 'Doe', phone: '+27821234567' },
  room: { name: 'Room 1', room_type: { name: 'Deluxe' } },
  expected_arrival_time: '14:00',
  online_check_in_completed: false,
  special_requests: null,
  ...overrides,
});

const mockFolioItem = (overrides: Partial<FolioItem> = {}): FolioItem => ({
  id: 'item-1',
  booking_id: 'booking-1',
  property_id: 'prop-1',
  category: FolioCategory.ROOM_CHARGE,
  description: 'Deluxe - 2 night(s)',
  amount: 1000,
  quantity: 2,
  total: 2000,
  is_credit: false,
  posted_by: 'system',
  notes: null as any,
  created_at: new Date(),
  updated_at: new Date(),
  booking: null as any,
  property: null as any,
  ...overrides,
});

describe('FrontdeskService', () => {
  let service: FrontdeskService;
  let folioRepo: ReturnType<typeof mockRepo>;
  let bookingsRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    folioRepo = mockRepo();
    bookingsRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FrontdeskService,
        { provide: getRepositoryToken(FolioItem), useValue: folioRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingsRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<FrontdeskService>(FrontdeskService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // getTodayBoard
  // =========================================================================

  describe('getTodayBoard', () => {
    it('should return arrivals, departures and in-house boards with summaries', async () => {
      const arrival = mockBooking({ status: BookingStatus.CONFIRMED });
      const departure = mockBooking({ id: 'booking-2', status: BookingStatus.CHECKED_IN });
      const inHouse = mockBooking({ id: 'booking-3', status: BookingStatus.CHECKED_IN });

      bookingsRepo.find
        .mockResolvedValueOnce([arrival])    // arrivals
        .mockResolvedValueOnce([departure])  // departures
        .mockResolvedValueOnce([inHouse]);   // in-house

      mockDataSource.query.mockResolvedValue([
        { booking_id: 'booking-1', charges: '2000', credits: '0' },
        { booking_id: 'booking-2', charges: '1500', credits: '500' },
      ]);

      const result = await service.getTodayBoard('prop-1');

      expect(result.arrivals).toHaveLength(1);
      expect(result.departures).toHaveLength(1);
      expect(result.inHouse).toHaveLength(1);
      expect(result.summary.arrivalsCount).toBe(1);
      expect(result.summary.departuresCount).toBe(1);
      expect(result.summary.inHouseCount).toBe(1);
    });

    it('should include folio balance per booking', async () => {
      const arrival = mockBooking();
      bookingsRepo.find
        .mockResolvedValueOnce([arrival])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockDataSource.query.mockResolvedValue([
        { booking_id: 'booking-1', charges: '2500', credits: '500' },
      ]);

      const result = await service.getTodayBoard('prop-1');

      expect(result.arrivals[0].balance).toBe(2000); // 2500 - 500
    });

    it('should return balance=0 when no folio items', async () => {
      const arrival = mockBooking();
      bookingsRepo.find
        .mockResolvedValueOnce([arrival])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getTodayBoard('prop-1');

      expect(result.arrivals[0].balance).toBe(0);
    });

    it('should skip the folio query when board is empty', async () => {
      bookingsRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getTodayBoard('prop-1');

      expect(mockDataSource.query).not.toHaveBeenCalled();
      expect(result.arrivals).toHaveLength(0);
    });

    it('should map guest name correctly', async () => {
      bookingsRepo.find
        .mockResolvedValueOnce([mockBooking()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getTodayBoard('prop-1');

      expect(result.arrivals[0].guestName).toBe('John Doe');
    });
  });

  // =========================================================================
  // getBookingFolio
  // =========================================================================

  describe('getBookingFolio', () => {
    it('should calculate charges, credits and balance', async () => {
      folioRepo.find.mockResolvedValue([
        mockFolioItem({ amount: 1000, quantity: 2, total: 2000, is_credit: false }),
        mockFolioItem({ id: 'item-2', category: FolioCategory.PAYMENT, total: 500, is_credit: true }),
      ]);

      const result = await service.getBookingFolio('booking-1');

      expect(result.summary.totalCharges).toBe(2000);
      expect(result.summary.totalCredits).toBe(500);
      expect(result.summary.balance).toBe(1500);
    });

    it('should return zero summary when no folio items', async () => {
      folioRepo.find.mockResolvedValue([]);

      const result = await service.getBookingFolio('booking-1');

      expect(result.items).toHaveLength(0);
      expect(result.summary.balance).toBe(0);
    });
  });

  // =========================================================================
  // addFolioItem
  // =========================================================================

  describe('addFolioItem', () => {
    it('should create a charge folio item (room_charge)', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking());
      folioRepo.save.mockResolvedValue(
        mockFolioItem({ category: FolioCategory.ROOM_CHARGE, is_credit: false }),
      );

      const result = await service.addFolioItem('prop-1', {
        bookingId: 'booking-1',
        category: FolioCategory.ROOM_CHARGE,
        description: 'Deluxe room',
        amount: 1000,
        quantity: 2,
      } as any);

      expect(result.is_credit).toBe(false);
    });

    it('should create a credit folio item for payment category', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking());
      folioRepo.save.mockImplementation((data) => Promise.resolve({ id: 'item-1', ...data }));

      const result = await service.addFolioItem('prop-1', {
        bookingId: 'booking-1',
        category: FolioCategory.PAYMENT,
        description: 'EFT payment',
        amount: 500,
      } as any);

      expect(folioRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_credit: true }),
      );
    });

    it('should create a credit folio item for deposit category', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking());
      folioRepo.save.mockImplementation((data) => Promise.resolve({ id: 'item-1', ...data }));

      await service.addFolioItem('prop-1', {
        bookingId: 'booking-1',
        category: FolioCategory.DEPOSIT,
        description: 'Deposit received',
        amount: 200,
      } as any);

      expect(folioRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_credit: true }),
      );
    });

    it('should create a credit folio item for refund category', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking());
      folioRepo.save.mockImplementation((data) => Promise.resolve({ id: 'item-1', ...data }));

      await service.addFolioItem('prop-1', {
        bookingId: 'booking-1',
        category: FolioCategory.REFUND,
        description: 'Refund',
        amount: 100,
      } as any);

      expect(folioRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_credit: true }),
      );
    });

    it('should calculate total from amount * quantity', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking());
      folioRepo.save.mockImplementation((data) => Promise.resolve({ id: 'item-1', ...data }));

      await service.addFolioItem('prop-1', {
        bookingId: 'booking-1',
        category: FolioCategory.MINIBAR,
        description: 'Minibar',
        amount: 50,
        quantity: 3,
      } as any);

      expect(folioRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ total: 150, quantity: 3 }),
      );
    });

    it('should default quantity to 1 when not provided', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking());
      folioRepo.save.mockImplementation((data) => Promise.resolve({ id: 'item-1', ...data }));

      await service.addFolioItem('prop-1', {
        bookingId: 'booking-1',
        category: FolioCategory.MINIBAR,
        description: 'Water',
        amount: 30,
      } as any);

      expect(folioRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 1, total: 30 }),
      );
    });

    it('should throw NotFoundException when booking not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addFolioItem('prop-1', {
          bookingId: 'nope',
          category: FolioCategory.ROOM_CHARGE,
          description: 'x',
          amount: 100,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should record posted_by when provided', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking());
      folioRepo.save.mockImplementation((data) => Promise.resolve({ id: 'item-1', ...data }));

      await service.addFolioItem(
        'prop-1',
        { bookingId: 'booking-1', category: FolioCategory.ROOM_CHARGE, description: 'Room', amount: 1000 } as any,
        'user-1',
      );

      expect(folioRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ posted_by: 'user-1' }),
      );
    });
  });

  // =========================================================================
  // deleteFolioItem
  // =========================================================================

  describe('deleteFolioItem', () => {
    it('should remove an existing folio item', async () => {
      const existing = mockFolioItem();
      folioRepo.findOne.mockResolvedValue(existing);
      folioRepo.remove.mockResolvedValue(undefined);

      await service.deleteFolioItem('item-1');

      expect(folioRepo.remove).toHaveBeenCalledWith(existing);
    });

    it('should throw NotFoundException when item not found', async () => {
      folioRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteFolioItem('nope')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // autoPostRoomCharges
  // =========================================================================

  describe('autoPostRoomCharges', () => {
    it('should auto-post room charge when none exists', async () => {
      bookingsRepo.findOne.mockResolvedValue(
        mockBooking({ room: { name: 'Room 1', room_type: { name: 'Deluxe' } }, nights: 2, nightly_rate: '1000', total_price: '2000' }),
      );
      folioRepo.findOne.mockResolvedValue(null); // no existing charge

      await service.autoPostRoomCharges('booking-1', 'prop-1');

      expect(folioRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: FolioCategory.ROOM_CHARGE,
          is_credit: false,
          posted_by: 'system',
        }),
      );
      expect(folioRepo.save).toHaveBeenCalled();
    });

    it('should NOT create duplicate room charge', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking());
      folioRepo.findOne.mockResolvedValue(mockFolioItem()); // existing charge

      await service.autoPostRoomCharges('booking-1', 'prop-1');

      expect(folioRepo.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when booking not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(service.autoPostRoomCharges('nope', 'prop-1')).rejects.toThrow(NotFoundException);
    });
  });
});
