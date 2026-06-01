import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReviewsService } from './reviews.service';
import { Review, ReviewStatus } from './entities/review.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'review-1', ...data })),
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
  })),
});

const mockGuest = {
  id: 'guest-1',
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@example.com',
  total_stays: 2,
  total_revenue: '3000',
};

const mockCheckedOutBooking = {
  id: 'booking-1',
  property_id: 'prop-1',
  guest_id: 'guest-1',
  reference_number: 'POS-001',
  status: BookingStatus.CHECKED_OUT,
  guest: mockGuest,
};

const mockReview = (overrides: Partial<Review> = {}): Partial<Review> => ({
  id: 'review-1',
  property_id: 'prop-1',
  booking_id: 'booking-1',
  guest_id: 'guest-1',
  overall_rating: 4,
  cleanliness_rating: 5,
  comfort_rating: 4,
  location_rating: 4,
  value_rating: 3,
  service_rating: 5,
  comment: 'Great stay!',
  status: ReviewStatus.PENDING,
  owner_response: null as any,
  responded_at: null as any,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewsRepo: ReturnType<typeof mockRepo>;
  let bookingsRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    reviewsRepo = mockRepo();
    bookingsRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: reviewsRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingsRepo },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // submitPublicReview
  // =========================================================================

  describe('submitPublicReview', () => {
    const validDto = {
      referenceNumber: 'POS-001',
      email: 'jane@example.com',
      overallRating: 4,
      cleanlinessRating: 5,
      comfortRating: 4,
      locationRating: 4,
      valueRating: 3,
      serviceRating: 5,
      comment: 'Great stay!',
    };

    it('should create a review in PENDING status on valid submission', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockCheckedOutBooking);
      reviewsRepo.findOne.mockResolvedValue(null);
      reviewsRepo.save.mockResolvedValue(mockReview());

      const result = await service.submitPublicReview(validDto as any);

      expect(reviewsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReviewStatus.PENDING, overall_rating: 4 }),
      );
    });

    it('should throw NotFoundException when booking not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(service.submitPublicReview(validDto as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when email does not match booking guest', async () => {
      bookingsRepo.findOne.mockResolvedValue({
        ...mockCheckedOutBooking,
        guest: { ...mockGuest, email: 'other@example.com' },
      });

      await expect(service.submitPublicReview(validDto as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when booking is not checked_out', async () => {
      bookingsRepo.findOne.mockResolvedValue({
        ...mockCheckedOutBooking,
        status: BookingStatus.CONFIRMED,
      });

      await expect(service.submitPublicReview(validDto as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when review already exists for booking', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockCheckedOutBooking);
      reviewsRepo.findOne.mockResolvedValue(mockReview());

      await expect(service.submitPublicReview(validDto as any)).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // createReview (admin)
  // =========================================================================

  describe('createReview', () => {
    it('should create a review in PUBLISHED status via admin', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockCheckedOutBooking);
      reviewsRepo.findOne.mockResolvedValue(null);
      reviewsRepo.save.mockResolvedValue(mockReview({ status: ReviewStatus.PUBLISHED }));

      const result = await service.createReview('prop-1', {
        bookingId: 'booking-1',
        overallRating: 4,
      } as any);

      expect(reviewsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReviewStatus.PUBLISHED }),
      );
    });

    it('should throw NotFoundException when booking not found for property', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createReview('prop-1', { bookingId: 'nope', overallRating: 4 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when review already exists', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockCheckedOutBooking);
      reviewsRepo.findOne.mockResolvedValue(mockReview());

      await expect(
        service.createReview('prop-1', { bookingId: 'booking-1', overallRating: 4 } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // listReviews
  // =========================================================================

  describe('listReviews', () => {
    it('should return paginated reviews with meta', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockReview()], 1]),
      };
      reviewsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listReviews('prop-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should apply status filter when provided', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      reviewsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listReviews('prop-1', { status: 'pending' });

      expect(qb.andWhere).toHaveBeenCalledWith('r.status = :status', { status: 'pending' });
    });

    it('should cap limit at 100', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      reviewsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listReviews('prop-1', { limit: 500 });

      expect(qb.take).toHaveBeenCalledWith(100);
    });
  });

  // =========================================================================
  // getPublicReviews
  // =========================================================================

  describe('getPublicReviews', () => {
    it('should return average rating and reviews for a property', async () => {
      const reviews = [
        { ...mockReview({ overall_rating: 5 }), guest: mockGuest },
        { ...mockReview({ id: 'review-2', overall_rating: 3 }), guest: mockGuest },
      ];
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(reviews),
      };
      reviewsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getPublicReviews('my-property');

      expect(result.totalReviews).toBe(2);
      expect(result.averageRating).toBe(4); // (5+3)/2
      expect(result.reviews[0].guestName).toContain('Jane');
    });

    it('should return averageRating=0 when no reviews', async () => {
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      reviewsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getPublicReviews('my-property');

      expect(result.averageRating).toBe(0);
      expect(result.totalReviews).toBe(0);
    });

    it('should truncate guest last name to initial', async () => {
      const reviews = [
        { ...mockReview(), guest: { first_name: 'Jane', last_name: 'Smith' } },
      ];
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(reviews),
      };
      reviewsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getPublicReviews('my-property');

      expect(result.reviews[0].guestName).toBe('Jane S.');
    });
  });

  // =========================================================================
  // respondToReview
  // =========================================================================

  describe('respondToReview', () => {
    it('should set owner response and responded_at', async () => {
      reviewsRepo.findOne.mockResolvedValue(mockReview());
      reviewsRepo.save.mockImplementation((data) => Promise.resolve(data));

      await service.respondToReview('review-1', 'prop-1', { response: 'Thank you!' } as any);

      expect(reviewsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          owner_response: 'Thank you!',
          responded_at: expect.any(Date),
        }),
      );
    });

    it('should throw NotFoundException when review not found', async () => {
      reviewsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.respondToReview('nope', 'prop-1', { response: 'x' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // updateStatus
  // =========================================================================

  describe('updateStatus', () => {
    it('should update review status', async () => {
      reviewsRepo.findOne.mockResolvedValue(mockReview());
      reviewsRepo.save.mockImplementation((data) => Promise.resolve(data));

      await service.updateStatus('review-1', 'prop-1', { status: 'published' } as any);

      expect(reviewsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReviewStatus.PUBLISHED }),
      );
    });

    it('should throw NotFoundException when review not found', async () => {
      reviewsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('nope', 'prop-1', { status: 'published' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getReviewSummary
  // =========================================================================

  describe('getReviewSummary', () => {
    it('should return aggregated ratings', async () => {
      const qb1 = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          total: '10',
          avgOverall: '4.2',
          avgCleanliness: '4.5',
          avgComfort: '4.0',
          avgLocation: '4.3',
          avgValue: '3.8',
          avgService: '4.6',
        }),
      };
      const qb2 = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { rating: '5', count: '3' },
          { rating: '4', count: '5' },
          { rating: '3', count: '2' },
        ]),
      };

      reviewsRepo.createQueryBuilder
        .mockReturnValueOnce(qb1)
        .mockReturnValueOnce(qb2);

      const result = await service.getReviewSummary('prop-1');

      expect(result.totalReviews).toBe(10);
      expect(result.averageOverall).toBe(4.2);
      expect(result.distribution).toHaveLength(3);
      expect(result.distribution[0].rating).toBe(5);
      expect(result.distribution[0].count).toBe(3);
    });

    it('should return zeros when no published reviews', async () => {
      const qb1 = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };
      const qb2 = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      reviewsRepo.createQueryBuilder
        .mockReturnValueOnce(qb1)
        .mockReturnValueOnce(qb2);

      const result = await service.getReviewSummary('prop-1');

      expect(result.totalReviews).toBe(0);
      expect(result.averageOverall).toBe(0);
    });
  });
});
