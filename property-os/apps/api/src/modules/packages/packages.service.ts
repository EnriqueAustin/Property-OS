import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Package, PackagePricingType } from './entities/package.entity';
import { BookingPackage } from './entities/booking-package.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Guest } from '../bookings/entities/guest.entity';
import {
  AddPackageToBookingDto,
  CreatePackageDto,
  UpdatePackageDto,
} from './dto/package.dto';

@Injectable()
export class PackagesService {
  constructor(
    @InjectRepository(Package)
    private packagesRepo: Repository<Package>,
    @InjectRepository(BookingPackage)
    private bookingPackagesRepo: Repository<BookingPackage>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    @InjectRepository(Guest)
    private guestsRepo: Repository<Guest>,
  ) {}

  async create(propertyId: string, dto: CreatePackageDto) {
    const pkg = this.packagesRepo.create({
      property_id: propertyId,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      pricing_type: (dto.pricingType as PackagePricingType) ?? PackagePricingType.FIXED,
      category: dto.category,
      image_url: dto.imageUrl,
      available_at_booking: dto.availableAtBooking ?? true,
      available_at_checkin: dto.availableAtCheckin ?? true,
      sort_order: dto.sortOrder ?? 0,
    });
    return this.packagesRepo.save(pkg);
  }

  async update(packageId: string, propertyId: string, dto: UpdatePackageDto) {
    const pkg = await this.packagesRepo.findOne({
      where: { id: packageId, property_id: propertyId },
    });
    if (!pkg) throw new NotFoundException('Package not found');

    if (dto.name !== undefined) pkg.name = dto.name;
    if (dto.description !== undefined) pkg.description = dto.description;
    if (dto.price !== undefined) pkg.price = dto.price;
    if (dto.pricingType !== undefined) pkg.pricing_type = dto.pricingType as PackagePricingType;
    if (dto.category !== undefined) pkg.category = dto.category;
    if (dto.imageUrl !== undefined) pkg.image_url = dto.imageUrl;
    if (dto.isActive !== undefined) pkg.is_active = dto.isActive;
    if (dto.availableAtBooking !== undefined) pkg.available_at_booking = dto.availableAtBooking;
    if (dto.availableAtCheckin !== undefined) pkg.available_at_checkin = dto.availableAtCheckin;
    if (dto.sortOrder !== undefined) pkg.sort_order = dto.sortOrder;

    return this.packagesRepo.save(pkg);
  }

  async list(propertyId: string, query?: { activeOnly?: boolean }) {
    const qb = this.packagesRepo
      .createQueryBuilder('p')
      .where('p.property_id = :propertyId', { propertyId });

    if (query?.activeOnly) {
      qb.andWhere('p.is_active = true');
    }

    return qb.orderBy('p.sort_order', 'ASC').addOrderBy('p.name', 'ASC').getMany();
  }

  async getOne(packageId: string, propertyId: string) {
    const pkg = await this.packagesRepo.findOne({
      where: { id: packageId, property_id: propertyId },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async delete(packageId: string, propertyId: string) {
    const pkg = await this.getOne(packageId, propertyId);
    pkg.is_active = false;
    return this.packagesRepo.save(pkg);
  }

  async getPublicPackages(propertySlug: string, stage: 'booking' | 'checkin') {
    const qb = this.packagesRepo
      .createQueryBuilder('pkg')
      .leftJoin('pkg.property', 'p')
      .where('p.slug = :slug', { slug: propertySlug })
      .andWhere('pkg.is_active = true');

    if (stage === 'booking') {
      qb.andWhere('pkg.available_at_booking = true');
    } else {
      qb.andWhere('pkg.available_at_checkin = true');
    }

    return qb.orderBy('pkg.sort_order', 'ASC').getMany();
  }

  async addToBooking(
    propertyId: string,
    bookingId: string,
    dto: AddPackageToBookingDto,
    stage: 'booking' | 'checkin' | 'during_stay',
  ) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId, property_id: propertyId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const pkg = await this.packagesRepo.findOne({
      where: { id: dto.packageId, property_id: propertyId, is_active: true },
    });
    if (!pkg) throw new NotFoundException('Package not found');

    const quantity = dto.quantity ?? 1;
    const unitPrice = this.calculateUnitPrice(pkg, booking);
    const totalPrice = unitPrice * quantity;

    const bp = this.bookingPackagesRepo.create({
      booking_id: bookingId,
      package_id: dto.packageId,
      property_id: propertyId,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      added_at_stage: stage,
    });

    return this.bookingPackagesRepo.save(bp);
  }

  async removeFromBooking(bookingPackageId: string, propertyId: string) {
    const bp = await this.bookingPackagesRepo.findOne({
      where: { id: bookingPackageId, property_id: propertyId },
    });
    if (!bp) throw new NotFoundException('Booking package not found');
    return this.bookingPackagesRepo.remove(bp);
  }

  async getBookingPackages(bookingId: string, propertyId: string) {
    return this.bookingPackagesRepo.find({
      where: { booking_id: bookingId, property_id: propertyId },
      relations: ['package'],
      order: { created_at: 'ASC' },
    });
  }

  async addToBookingPublic(
    referenceNumber: string,
    email: string,
    packageId: string,
    quantity: number,
    stage: 'booking' | 'checkin',
  ) {
    const booking = await this.bookingsRepo.findOne({
      where: { reference_number: referenceNumber },
      relations: ['guest'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.guest?.email?.toLowerCase() !== email.toLowerCase()) {
      throw new NotFoundException('Booking not found');
    }

    return this.addToBooking(
      booking.property_id,
      booking.id,
      { packageId, quantity },
      stage,
    );
  }

  async getCheckinUpsellPrompts(propertyId: string, bookingId: string) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId, property_id: propertyId },
      relations: ['guest'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const alreadyAdded = await this.bookingPackagesRepo.find({
      where: { booking_id: bookingId },
    });
    const addedPackageIds = new Set(alreadyAdded.map((bp) => bp.package_id));

    const availablePackages = await this.packagesRepo.find({
      where: {
        property_id: propertyId,
        is_active: true,
        available_at_checkin: true,
      },
      order: { sort_order: 'ASC' },
    });

    const notYetAdded = availablePackages.filter(
      (pkg) => !addedPackageIds.has(pkg.id),
    );

    const guest = booking.guest;
    const isReturning = guest && guest.total_stays > 0;
    const isHighValue = guest && Number(guest.total_revenue) > 5000;
    const isLongStay = booking.nights >= 3;
    const isCouple = booking.guest_count === 2;
    const isFamily = booking.guest_count >= 3;

    const scored = notYetAdded.map((pkg) => {
      let score = 0;
      const reasons: string[] = [];
      const unitPrice = this.calculateUnitPrice(pkg, booking);
      const category = (pkg.category || '').toLowerCase();

      if (isReturning) {
        score += 10;
        reasons.push('Returning guest — personal touch');
      }
      if (isHighValue) {
        score += 5;
        reasons.push('High-value guest');
      }
      if (isLongStay && pkg.pricing_type === PackagePricingType.PER_NIGHT) {
        score += 8;
        reasons.push(`${booking.nights}-night stay — great value per night`);
      }
      if (isCouple && (category.includes('romantic') || category.includes('spa') || category.includes('wine'))) {
        score += 15;
        reasons.push('Couple — romance/spa packages');
      }
      if (isFamily && (category.includes('family') || category.includes('kids') || category.includes('adventure'))) {
        score += 15;
        reasons.push('Family — kid-friendly packages');
      }

      if (unitPrice <= Number(booking.total_price) * 0.15) {
        score += 5;
        reasons.push('Easy upsell — under 15% of room cost');
      }

      return {
        package: {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          category: pkg.category,
          imageUrl: pkg.image_url,
          pricingType: pkg.pricing_type,
          basePrice: Number(pkg.price),
          calculatedPrice: unitPrice,
        },
        score,
        reasons,
        suggestedPitch: this.generatePitch(pkg, booking, isReturning, reasons),
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return {
      bookingId,
      guestName: guest ? `${guest.first_name} ${guest.last_name}` : undefined,
      isReturningGuest: isReturning,
      totalStays: guest?.total_stays ?? 0,
      suggestions: scored.slice(0, 5),
    };
  }

  private generatePitch(
    pkg: Package,
    booking: Booking,
    isReturning: boolean,
    reasons: string[],
  ): string {
    const name = pkg.name;
    if (isReturning) {
      return `Welcome back! Since you've stayed with us before, we'd love to offer you our ${name} to make this visit even more special.`;
    }
    if (booking.guest_count === 2) {
      return `For your stay, you might enjoy our ${name} — perfect for two.`;
    }
    if (booking.nights >= 3) {
      return `With a ${booking.nights}-night stay, our ${name} is great value and will enhance your visit.`;
    }
    return `We'd like to offer you our ${name} to make your stay more comfortable.`;
  }

  private calculateUnitPrice(pkg: Package, booking: Booking): number {
    const price = Number(pkg.price);
    switch (pkg.pricing_type) {
      case PackagePricingType.PER_NIGHT:
        return price * booking.nights;
      case PackagePricingType.PER_GUEST:
        return price * booking.guest_count;
      case PackagePricingType.PER_GUEST_PER_NIGHT:
        return price * booking.guest_count * booking.nights;
      case PackagePricingType.FIXED:
      default:
        return price;
    }
  }
}
