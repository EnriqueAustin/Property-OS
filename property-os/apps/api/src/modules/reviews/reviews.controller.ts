import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReviewsService } from './reviews.service';
import { PropertyGuard } from '../../common/guards/property.guard';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/permissions/permissions.enum';
import {
  CreateReviewDto,
  OwnerResponseDto,
  SubmitPublicReviewDto,
  UpdateReviewStatusDto,
} from './dto/create-review.dto';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // --- Public endpoints ---

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('public/reviews')
  submitReview(@Body() dto: SubmitPublicReviewDto) {
    return this.reviews.submitPublicReview(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('public/properties/:slug/reviews')
  publicReviews(@Param('slug') slug: string) {
    return this.reviews.getPublicReviews(slug);
  }

  // --- Admin endpoints ---

  @Post('properties/:propertyId/reviews')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_MANAGE)
  create(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.createReview(propertyId, dto);
  }

  @Get('properties/:propertyId/reviews')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_VIEW)
  list(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Query() query: any,
  ) {
    return this.reviews.listReviews(propertyId, query);
  }

  @Get('properties/:propertyId/reviews/summary')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_VIEW)
  summary(@Param('propertyId', new ParseUUIDPipe()) propertyId: string) {
    return this.reviews.getReviewSummary(propertyId);
  }

  @Patch('properties/:propertyId/reviews/:reviewId/respond')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_MANAGE)
  respond(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @Body() dto: OwnerResponseDto,
  ) {
    return this.reviews.respondToReview(reviewId, propertyId, dto);
  }

  @Patch('properties/:propertyId/reviews/:reviewId/status')
  @UseGuards(PropertyGuard)
  @RequirePermission(Permission.BOOKINGS_MANAGE)
  updateStatus(
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviews.updateStatus(reviewId, propertyId, dto);
  }
}
