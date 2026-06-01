import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewStatus } from './entities/review.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import {
  CreateReviewDto,
  OwnerResponseDto,
  SubmitPublicReviewDto,
  UpdateReviewStatusDto,
} from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewsRepo: Repository<Review>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
  ) {}

  async submitPublicReview(dto: SubmitPublicReviewDto) {
    const booking = await this.bookingsRepo.findOne({
      where: { reference_number: dto.referenceNumber },
      relations: ['guest'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.guest?.email?.toLowerCase() !== dto.email.toLowerCase()) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status !== BookingStatus.CHECKED_OUT) {
      throw new BadRequestException('Reviews can only be submitted after checkout');
    }

    const existing = await this.reviewsRepo.findOne({
      where: { booking_id: booking.id },
    });
    if (existing) {
      throw new ConflictException('A review has already been submitted for this booking');
    }

    const review = this.reviewsRepo.create({
      property_id: booking.property_id,
      booking_id: booking.id,
      guest_id: booking.guest_id,
      overall_rating: dto.overallRating,
      cleanliness_rating: dto.cleanlinessRating,
      comfort_rating: dto.comfortRating,
      location_rating: dto.locationRating,
      value_rating: dto.valueRating,
      service_rating: dto.serviceRating,
      comment: dto.comment,
      status: ReviewStatus.PENDING,
    });

    return this.reviewsRepo.save(review);
  }

  async createReview(propertyId: string, dto: CreateReviewDto) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: dto.bookingId, property_id: propertyId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const existing = await this.reviewsRepo.findOne({
      where: { booking_id: booking.id },
    });
    if (existing) {
      throw new ConflictException('A review already exists for this booking');
    }

    const review = this.reviewsRepo.create({
      property_id: propertyId,
      booking_id: booking.id,
      guest_id: booking.guest_id,
      overall_rating: dto.overallRating,
      cleanliness_rating: dto.cleanlinessRating,
      comfort_rating: dto.comfortRating,
      location_rating: dto.locationRating,
      value_rating: dto.valueRating,
      service_rating: dto.serviceRating,
      comment: dto.comment,
      status: ReviewStatus.PUBLISHED,
    });

    return this.reviewsRepo.save(review);
  }

  async listReviews(
    propertyId: string,
    query: { status?: string; page?: number; limit?: number },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.reviewsRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.guest', 'g')
      .leftJoinAndSelect('r.booking', 'b')
      .where('r.property_id = :propertyId', { propertyId });

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    qb.orderBy('r.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPublicReviews(propertySlug: string) {
    const reviews = await this.reviewsRepo
      .createQueryBuilder('r')
      .leftJoin('r.property', 'p')
      .leftJoinAndSelect('r.guest', 'g')
      .where('p.slug = :slug', { slug: propertySlug })
      .andWhere('r.status = :status', { status: ReviewStatus.PUBLISHED })
      .orderBy('r.created_at', 'DESC')
      .take(50)
      .getMany();

    const avgRating =
      reviews.length > 0
        ? Math.round(
            (reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length) * 10,
          ) / 10
        : 0;

    return {
      averageRating: avgRating,
      totalReviews: reviews.length,
      reviews: reviews.map((r) => ({
        id: r.id,
        overallRating: r.overall_rating,
        cleanlinessRating: r.cleanliness_rating,
        comfortRating: r.comfort_rating,
        locationRating: r.location_rating,
        valueRating: r.value_rating,
        serviceRating: r.service_rating,
        comment: r.comment,
        ownerResponse: r.owner_response,
        respondedAt: r.responded_at,
        guestName: r.guest ? `${r.guest.first_name} ${r.guest.last_name?.charAt(0)}.` : 'Guest',
        createdAt: r.created_at,
      })),
    };
  }

  async respondToReview(reviewId: string, propertyId: string, dto: OwnerResponseDto) {
    const review = await this.reviewsRepo.findOne({
      where: { id: reviewId, property_id: propertyId },
    });
    if (!review) throw new NotFoundException('Review not found');

    review.owner_response = dto.response;
    review.responded_at = new Date();
    return this.reviewsRepo.save(review);
  }

  async updateStatus(reviewId: string, propertyId: string, dto: UpdateReviewStatusDto) {
    const review = await this.reviewsRepo.findOne({
      where: { id: reviewId, property_id: propertyId },
    });
    if (!review) throw new NotFoundException('Review not found');

    review.status = dto.status as ReviewStatus;
    return this.reviewsRepo.save(review);
  }

  async getReviewSummary(propertyId: string) {
    const result = await this.reviewsRepo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'total')
      .addSelect('AVG(r.overall_rating)', 'avgOverall')
      .addSelect('AVG(r.cleanliness_rating)', 'avgCleanliness')
      .addSelect('AVG(r.comfort_rating)', 'avgComfort')
      .addSelect('AVG(r.location_rating)', 'avgLocation')
      .addSelect('AVG(r.value_rating)', 'avgValue')
      .addSelect('AVG(r.service_rating)', 'avgService')
      .where('r.property_id = :propertyId', { propertyId })
      .andWhere('r.status = :status', { status: ReviewStatus.PUBLISHED })
      .getRawOne();

    const distribution = await this.reviewsRepo
      .createQueryBuilder('r')
      .select('r.overall_rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('r.property_id = :propertyId', { propertyId })
      .andWhere('r.status = :status', { status: ReviewStatus.PUBLISHED })
      .groupBy('r.overall_rating')
      .orderBy('r.overall_rating', 'DESC')
      .getRawMany();

    const round = (v: any) => (v ? Math.round(parseFloat(v) * 10) / 10 : 0);

    return {
      totalReviews: parseInt(result?.total || '0', 10),
      averageOverall: round(result?.avgOverall),
      averageCleanliness: round(result?.avgCleanliness),
      averageComfort: round(result?.avgComfort),
      averageLocation: round(result?.avgLocation),
      averageValue: round(result?.avgValue),
      averageService: round(result?.avgService),
      distribution: distribution.map((d: any) => ({
        rating: parseInt(d.rating, 10),
        count: parseInt(d.count, 10),
      })),
    };
  }
}
