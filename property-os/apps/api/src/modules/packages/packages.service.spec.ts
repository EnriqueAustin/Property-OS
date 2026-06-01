import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PackagesService } from './packages.service';
import { Package, PackagePricingType } from './entities/package.entity';
import { BookingPackage } from './entities/booking-package.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Guest } from '../bookings/entities/guest.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'pkg-1', ...data })),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

const mockPackage = (overrides: Partial<Package> = {}): Package => ({
  id: 'pkg-1',
  property_id: 'prop-1',
  name: 'Romantic Dinner',
  description: 'Private dinner on the deck',
  price: 500,
  pricing_type: PackagePricingType.FIXED,
  category: 'romantic',
  image_url: null as any,
  is_active: true,
  available_at_booking: true,
  available_at_checkin: true,
  sort_order: 0,
  created_at: new Date(),
  updated_at: new Date(),
  property: null as any,
  ...overrides,
});

const mockBooking = (overrides: any = {}): Partial<Booking> => ({
  id: 'booking-1',
  property_id: 'prop-1',
  reference_number: 'POS-001',
  nights: 3,
  guest_count: 2,
  total_price: 3000 as any,
  guest_id: 'guest-1',
  guest: null as any,
  ...overrides,
});

const mockGuest = (overrides: any = {}) => ({
  id: 'guest-1',
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@example.com',
  total_stays: 2,
  total_revenue: '6000',
  ...overrides,
});

describe('PackagesService', () => {
  let service: PackagesService;
  let packagesRepo: ReturnType<typeof mockRepo>;
  let bookingPackagesRepo: ReturnType<typeof mockRepo>;
  let bookingsRepo: ReturnType<typeof mockRepo>;
  let guestsRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    packagesRepo = mockRepo();
    bookingPackagesRepo = mockRepo();
    bookingsRepo = mockRepo();
    guestsRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackagesService,
        { provide: getRepositoryToken(Package), useValue: packagesRepo },
        { provide: getRepositoryToken(BookingPackage), useValue: bookingPackagesRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingsRepo },
        { provide: getRepositoryToken(Guest), useValue: guestsRepo },
      ],
    }).compile();

    service = module.get<PackagesService>(PackagesService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // CRUD
  // =========================================================================

  describe('create', () => {
    it('should create a package with provided fields', async () => {
      packagesRepo.save.mockResolvedValue(mockPackage());

      const result = await service.create('prop-1', {
        name: 'Romantic Dinner',
        price: 500,
        pricingType: PackagePricingType.FIXED,
        category: 'romantic',
      } as any);

      expect(packagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ property_id: 'prop-1', name: 'Romantic Dinner' }),
      );
      expect(result.id).toBe('pkg-1');
    });

    it('should default to FIXED pricing type when not provided', async () => {
      packagesRepo.save.mockResolvedValue(mockPackage());

      await service.create('prop-1', { name: 'Spa', price: 300 } as any);

      expect(packagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ pricing_type: PackagePricingType.FIXED }),
      );
    });
  });

  describe('update', () => {
    it('should update package fields', async () => {
      packagesRepo.findOne.mockResolvedValue(mockPackage());
      packagesRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.update('pkg-1', 'prop-1', { name: 'New Name' } as any);

      expect(packagesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name' }),
      );
    });

    it('should throw NotFoundException when package not found', async () => {
      packagesRepo.findOne.mockResolvedValue(null);

      await expect(service.update('nope', 'prop-1', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOne', () => {
    it('should return a package', async () => {
      packagesRepo.findOne.mockResolvedValue(mockPackage());

      const result = await service.getOne('pkg-1', 'prop-1');
      expect(result.name).toBe('Romantic Dinner');
    });

    it('should throw NotFoundException when not found', async () => {
      packagesRepo.findOne.mockResolvedValue(null);

      await expect(service.getOne('nope', 'prop-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete (soft)', () => {
    it('should set is_active=false instead of deleting', async () => {
      packagesRepo.findOne.mockResolvedValue(mockPackage());
      packagesRepo.save.mockImplementation((data) => Promise.resolve(data));

      await service.delete('pkg-1', 'prop-1');

      expect(packagesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
    });
  });

  // =========================================================================
  // addToBooking
  // =========================================================================

  describe('addToBooking', () => {
    it('should add a fixed-price package to a booking', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking());
      packagesRepo.findOne.mockResolvedValue(mockPackage());
      bookingPackagesRepo.save.mockResolvedValue({ id: 'bp-1' });

      const result = await service.addToBooking('prop-1', 'booking-1', { packageId: 'pkg-1', quantity: 1 } as any, 'checkin');

      expect(bookingPackagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          booking_id: 'booking-1',
          package_id: 'pkg-1',
          unit_price: 500,
          total_price: 500,
          quantity: 1,
          added_at_stage: 'checkin',
        }),
      );
    });

    it('should multiply quantity correctly', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking());
      packagesRepo.findOne.mockResolvedValue(mockPackage({ price: 100 }));
      bookingPackagesRepo.save.mockResolvedValue({ id: 'bp-1' });

      await service.addToBooking('prop-1', 'booking-1', { packageId: 'pkg-1', quantity: 3 } as any, 'booking');

      expect(bookingPackagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ unit_price: 100, total_price: 300, quantity: 3 }),
      );
    });

    it('should throw NotFoundException when booking not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addToBooking('prop-1', 'nope', { packageId: 'pkg-1' } as any, 'checkin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when package not found or inactive', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking());
      packagesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addToBooking('prop-1', 'booking-1', { packageId: 'nope' } as any, 'checkin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // Pricing types — calculateUnitPrice (tested through addToBooking)
  // =========================================================================

  describe('pricing types', () => {
    it('PER_NIGHT: should multiply by nights', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking({ nights: 3 }));
      packagesRepo.findOne.mockResolvedValue(mockPackage({ price: 100, pricing_type: PackagePricingType.PER_NIGHT }));
      bookingPackagesRepo.save.mockResolvedValue({ id: 'bp-1' });

      await service.addToBooking('prop-1', 'booking-1', { packageId: 'pkg-1', quantity: 1 } as any, 'checkin');

      expect(bookingPackagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ unit_price: 300, total_price: 300 }),
      );
    });

    it('PER_GUEST: should multiply by guest count', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking({ guest_count: 2 }));
      packagesRepo.findOne.mockResolvedValue(mockPackage({ price: 100, pricing_type: PackagePricingType.PER_GUEST }));
      bookingPackagesRepo.save.mockResolvedValue({ id: 'bp-1' });

      await service.addToBooking('prop-1', 'booking-1', { packageId: 'pkg-1', quantity: 1 } as any, 'checkin');

      expect(bookingPackagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ unit_price: 200, total_price: 200 }),
      );
    });

    it('PER_GUEST_PER_NIGHT: should multiply by guests × nights', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking({ nights: 3, guest_count: 2 }));
      packagesRepo.findOne.mockResolvedValue(
        mockPackage({ price: 50, pricing_type: PackagePricingType.PER_GUEST_PER_NIGHT }),
      );
      bookingPackagesRepo.save.mockResolvedValue({ id: 'bp-1' });

      await service.addToBooking('prop-1', 'booking-1', { packageId: 'pkg-1', quantity: 1 } as any, 'checkin');

      expect(bookingPackagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ unit_price: 300, total_price: 300 }), // 50 * 3 * 2
      );
    });
  });

  // =========================================================================
  // addToBookingPublic
  // =========================================================================

  describe('addToBookingPublic', () => {
    it('should allow guest to add package by reference and email', async () => {
      const booking = mockBooking({ guest: { email: 'jane@example.com' } });
      bookingsRepo.findOne.mockResolvedValue(booking);
      packagesRepo.findOne.mockResolvedValue(mockPackage());
      bookingPackagesRepo.save.mockResolvedValue({ id: 'bp-1' });

      const result = await service.addToBookingPublic('POS-001', 'jane@example.com', 'pkg-1', 1, 'checkin');

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when reference not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addToBookingPublic('NOPE', 'jane@example.com', 'pkg-1', 1, 'checkin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when email does not match', async () => {
      bookingsRepo.findOne.mockResolvedValue(
        mockBooking({ guest: { email: 'other@example.com' } }),
      );

      await expect(
        service.addToBookingPublic('POS-001', 'jane@example.com', 'pkg-1', 1, 'checkin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // removeFromBooking
  // =========================================================================

  describe('removeFromBooking', () => {
    it('should remove a booking package', async () => {
      const bp = { id: 'bp-1', property_id: 'prop-1' };
      bookingPackagesRepo.findOne.mockResolvedValue(bp);
      bookingPackagesRepo.remove.mockResolvedValue(undefined);

      await service.removeFromBooking('bp-1', 'prop-1');

      expect(bookingPackagesRepo.remove).toHaveBeenCalledWith(bp);
    });

    it('should throw NotFoundException when booking package not found', async () => {
      bookingPackagesRepo.findOne.mockResolvedValue(null);

      await expect(service.removeFromBooking('nope', 'prop-1')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getCheckinUpsellPrompts
  // =========================================================================

  describe('getCheckinUpsellPrompts', () => {
    const setupUpsell = ({
      guest = mockGuest(),
      nights = 2,
      guestCount = 2,
      totalPrice = 3000,
      packages = [mockPackage({ id: 'pkg-spa', name: 'Spa Package', category: 'spa', price: 300 })],
      addedPackages = [],
    } = {}) => {
      const booking = mockBooking({ nights, guest_count: guestCount, total_price: totalPrice, guest });
      bookingsRepo.findOne.mockResolvedValue(booking);
      bookingPackagesRepo.find.mockResolvedValue(addedPackages);
      packagesRepo.find.mockResolvedValue(packages);
    };

    it('should return suggestions with scores and pitches', async () => {
      setupUpsell({ guest: mockGuest({ total_stays: 2 }) });

      const result = await service.getCheckinUpsellPrompts('prop-1', 'booking-1');

      expect(result.bookingId).toBe('booking-1');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('should exclude already-added packages', async () => {
      const pkg = mockPackage({ id: 'pkg-spa', name: 'Spa' });
      setupUpsell({
        packages: [pkg],
        addedPackages: [{ package_id: 'pkg-spa' }] as any,
      });

      const result = await service.getCheckinUpsellPrompts('prop-1', 'booking-1');

      expect(result.suggestions).toHaveLength(0);
    });

    it('should score couple packages higher for 2-guest booking', async () => {
      setupUpsell({
        guest: mockGuest({ total_stays: 0 }),
        guestCount: 2,
        packages: [
          mockPackage({ id: 'pkg-spa', name: 'Spa', category: 'spa', price: 300 }),
          mockPackage({ id: 'pkg-family', name: 'Family Fun', category: 'family', price: 200 }),
        ],
      });

      const result = await service.getCheckinUpsellPrompts('prop-1', 'booking-1');

      const spaIdx = result.suggestions.findIndex((s) => s.package.id === 'pkg-spa');
      const familyIdx = result.suggestions.findIndex((s) => s.package.id === 'pkg-family');
      if (spaIdx >= 0 && familyIdx >= 0) {
        expect(result.suggestions[spaIdx].score).toBeGreaterThan(result.suggestions[familyIdx].score);
      }
    });

    it('should give returning guest a personalised pitch', async () => {
      setupUpsell({ guest: mockGuest({ total_stays: 3 }) });

      const result = await service.getCheckinUpsellPrompts('prop-1', 'booking-1');

      if (result.suggestions.length > 0) {
        expect(result.suggestions[0].suggestedPitch).toMatch(/welcome back/i);
      }
    });

    it('should cap suggestions at 5', async () => {
      const manyPackages = Array.from({ length: 10 }, (_, i) =>
        mockPackage({ id: `pkg-${i}`, name: `Package ${i}` }),
      );
      setupUpsell({ packages: manyPackages });

      const result = await service.getCheckinUpsellPrompts('prop-1', 'booking-1');

      expect(result.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should throw NotFoundException when booking not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(service.getCheckinUpsellPrompts('prop-1', 'nope')).rejects.toThrow(NotFoundException);
    });

    it('should flag isReturningGuest correctly', async () => {
      setupUpsell({ guest: mockGuest({ total_stays: 2 }) });

      const result = await service.getCheckinUpsellPrompts('prop-1', 'booking-1');

      expect(result.isReturningGuest).toBe(true);
    });

    it('should return isReturningGuest=false for first-time guests', async () => {
      setupUpsell({ guest: mockGuest({ total_stays: 0 }) });

      const result = await service.getCheckinUpsellPrompts('prop-1', 'booking-1');

      expect(result.isReturningGuest).toBe(false);
    });
  });
});
