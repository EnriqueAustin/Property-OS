import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { User, UserRole } from './modules/users/entities/user.entity';
import { Property } from './modules/properties/entities/property.entity';
import { PropertyUser, PropertyUserRole } from './modules/properties/entities/property-user.entity';
import { RoomType } from './modules/inventory/entities/room-type.entity';
import { Room } from './modules/inventory/entities/room.entity';
import { RoomAvailability, AvailabilityStatus } from './modules/inventory/entities/room-availability.entity';
import { RoomAmenity } from './modules/inventory/entities/room-amenity.entity';
import { RatePeriod } from './modules/inventory/entities/rate-period.entity';
import { RatePlan, CancellationPolicy } from './modules/inventory/entities/rate-plan.entity';
import { Guest } from './modules/bookings/entities/guest.entity';
import { Booking, BookingStatus, BookingSource } from './modules/bookings/entities/booking.entity';
import { Payment } from './modules/payments/entities/payment.entity';
import { PaymentSettings } from './modules/payments/entities/payment-settings.entity';
import { Notification } from './modules/notifications/entities/notification.entity';
import { NotificationSettings } from './modules/notifications/entities/notification-settings.entity';
import { EmailTemplate } from './modules/notifications/entities/email-template.entity';
import { AuditLog } from './modules/audit/entities/audit-log.entity';
import { Channel, ChannelType, ChannelStatus } from './modules/channels/entities/channel.entity';
import { ChannelMapping } from './modules/channels/entities/channel-mapping.entity';
import { SyncLog, SyncDirection, SyncStatus } from './modules/channels/entities/sync-log.entity';
import { PricingRule, PricingRuleType } from './modules/pricing/entities/pricing-rule.entity';
import { Refund, RefundStatus, RefundReason } from './modules/payments/entities/refund.entity';
import { Invoice, InvoiceStatus, InvoiceType } from './modules/payments/entities/invoice.entity';
import { GuestConsent, ConsentType, ConsentStatus } from './modules/guests/entities/guest-consent.entity';
import { DataRetentionSettings } from './modules/guests/entities/data-retention-settings.entity';
import { SmartAlert, AlertType, AlertSeverity, AlertStatus } from './modules/alerts/entities/smart-alert.entity';
import { AlertSettings } from './modules/alerts/entities/alert-settings.entity';
import { FolioItem, FolioCategory } from './modules/frontdesk/entities/folio-item.entity';
import { HousekeepingTask, TaskStatus, TaskType, TaskPriority } from './modules/housekeeping/entities/housekeeping-task.entity';
import { PromoCode, DiscountType } from './modules/promos/entities/promo-code.entity';
import { Package, PackagePricingType } from './modules/packages/entities/package.entity';
import { BookingPackage } from './modules/packages/entities/booking-package.entity';
import { Review, ReviewStatus } from './modules/reviews/entities/review.entity';
import { TourismLevySettings, LevyType } from './modules/tourism-levy/entities/tourism-levy-settings.entity';
import { TourismLevyRecord } from './modules/tourism-levy/entities/tourism-levy-record.entity';
import { AccountingConnection, AccountingProviderType, AccountingConnectionStatus } from './modules/accounting/entities/accounting-connection.entity';
import { AccountingMapping, AccountingEntityType, AccountingSyncStatus } from './modules/accounting/entities/accounting-mapping.entity';

dotenv.config();

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'property_os',
  entities: [
    User, Property, PropertyUser, RoomType, RoomAmenity, Room,
    RoomAvailability, RatePeriod, RatePlan, Guest, Booking, Payment,
    PaymentSettings, Notification, NotificationSettings, EmailTemplate, AuditLog,
    Channel, ChannelMapping, SyncLog, PricingRule, Refund, Invoice,
    GuestConsent, DataRetentionSettings, SmartAlert, AlertSettings,
    FolioItem, HousekeepingTask, PromoCode,
    Package, BookingPackage, Review,
    TourismLevySettings, TourismLevyRecord,
    AccountingConnection, AccountingMapping,
  ],
  synchronize: true,
});

async function clearDatabase() {
  const rows = await ds.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('migrations', 'typeorm_metadata')
  `);

  const tableNames = rows.map((row: { tablename: string }) => `"public"."${row.tablename.replace(/"/g, '""')}"`);
  if (tableNames.length === 0) return;

  await ds.query(`TRUNCATE TABLE ${tableNames.join(', ')} RESTART IDENTITY CASCADE`);
  console.log(`Cleared ${tableNames.length} database tables`);
}

function makeDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function makeTimestamp(daysFromNow: number, hoursOffset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(d.getHours() + hoursOffset);
  return d;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}


async function seed() {
  await ds.initialize();
  console.log('Connected to database');
  const shouldReset = process.env.RESEED === 'true' || process.argv.includes('--reset');

  if (shouldReset) {
    await clearDatabase();
  }

  const userRepo = ds.getRepository(User);
  const propertyRepo = ds.getRepository(Property);
  const puRepo = ds.getRepository(PropertyUser);
  const rtRepo = ds.getRepository(RoomType);
  const roomRepo = ds.getRepository(Room);
  const availRepo = ds.getRepository(RoomAvailability);
  const amenityRepo = ds.getRepository(RoomAmenity);
  const rateRepo = ds.getRepository(RatePeriod);
  const guestRepo = ds.getRepository(Guest);
  const bookingRepo = ds.getRepository(Booking);
  const paymentRepo = ds.getRepository(Payment);
  const psRepo = ds.getRepository(PaymentSettings);
  const notifRepo = ds.getRepository(Notification);
  const nsRepo = ds.getRepository(NotificationSettings);
  const auditRepo = ds.getRepository(AuditLog);
  const channelRepo = ds.getRepository(Channel);
  const mappingRepo = ds.getRepository(ChannelMapping);
  const syncLogRepo = ds.getRepository(SyncLog);
  const pricingRuleRepo = ds.getRepository(PricingRule);
  const refundRepo = ds.getRepository(Refund);
  const invoiceRepo = ds.getRepository(Invoice);
  const consentRepo = ds.getRepository(GuestConsent);
  const retentionRepo = ds.getRepository(DataRetentionSettings);
  const alertRepo = ds.getRepository(SmartAlert);
  const alertSettingsRepo = ds.getRepository(AlertSettings);
  const folioRepo = ds.getRepository(FolioItem);
  const hkTaskRepo = ds.getRepository(HousekeepingTask);
  const ratePlanRepo = ds.getRepository(RatePlan);
  const promoCodeRepo = ds.getRepository(PromoCode);
  const packageRepo = ds.getRepository(Package);
  const bookingPackageRepo = ds.getRepository(BookingPackage);
  const reviewRepo = ds.getRepository(Review);
  const levySettingsRepo = ds.getRepository(TourismLevySettings);
  const levyRecordRepo = ds.getRepository(TourismLevyRecord);
  const accountingConnRepo = ds.getRepository(AccountingConnection);
  const accountingMappingRepo = ds.getRepository(AccountingMapping);

  const existingUsers = await userRepo.count();
  if (existingUsers > 0 && !shouldReset) {
    console.log('Database already has data, skipping seed. Use --reset or RESEED=true to reseed.');
    await ds.destroy();
    return;
  }

  // ─── 0. UPLOADS DIRECTORY ───
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  // Real images from Pexels (free to use)
  const propertyPhotos = [
    'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg?auto=compress&cs=tinysrgb&w=1200',
    'https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=1200',
    'https://images.pexels.com/photos/1268871/pexels-photo-1268871.jpeg?auto=compress&cs=tinysrgb&w=1200',
    'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=1200',
    'https://images.pexels.com/photos/1579739/pexels-photo-1579739.jpeg?auto=compress&cs=tinysrgb&w=1200',
  ];
  const roomTypePhotos: Record<string, string[]> = {
    deluxe: [
      'https://images.pexels.com/photos/1743231/pexels-photo-1743231.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/2869215/pexels-photo-2869215.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1910472/pexels-photo-1910472.jpeg?auto=compress&cs=tinysrgb&w=800',
    ],
    suite: [
      'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1648776/pexels-photo-1648776.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/2062426/pexels-photo-2062426.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1350789/pexels-photo-1350789.jpeg?auto=compress&cs=tinysrgb&w=800',
    ],
    standard: [
      'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1454806/pexels-photo-1454806.jpeg?auto=compress&cs=tinysrgb&w=800',
    ],
    family: [
      'https://images.pexels.com/photos/1457847/pexels-photo-1457847.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/279746/pexels-photo-279746.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3659683/pexels-photo-3659683.jpeg?auto=compress&cs=tinysrgb&w=800',
    ],
    single: [
      'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800',
    ],
  };

  console.log('Using Pexels image URLs for property and room photos');

  // ─── 1. USERS ───
  const password = await bcrypt.hash('Demo1234!', 12);

  const owner = await userRepo.save(userRepo.create({
    email: 'demo@propertyos.co.za',
    password_hash: password,
    first_name: 'Demo',
    last_name: 'Owner',
    phone: '+27821234567',
    role: UserRole.OWNER,
    email_verified: true,
    last_login_at: makeTimestamp(-1),
  }));

  const manager = await userRepo.save(userRepo.create({
    email: 'manager@propertyos.co.za',
    password_hash: password,
    first_name: 'Thandi',
    last_name: 'Nkosi',
    phone: '+27829876543',
    role: UserRole.MANAGER,
    email_verified: true,
    last_login_at: makeTimestamp(0, -3),
  }));

  const staff1 = await userRepo.save(userRepo.create({
    email: 'front.desk@propertyos.co.za',
    password_hash: password,
    first_name: 'Pieter',
    last_name: 'Van der Berg',
    phone: '+27835551234',
    role: UserRole.STAFF,
    email_verified: true,
    last_login_at: makeTimestamp(0, -1),
  }));

  const staff2 = await userRepo.save(userRepo.create({
    email: 'housekeeping@propertyos.co.za',
    password_hash: password,
    first_name: 'Nomsa',
    last_name: 'Dlamini',
    phone: '+27845554321',
    role: UserRole.STAFF,
    email_verified: true,
  }));

  console.log('Created 4 users (owner, manager, 2 staff)');

  // Shared test data for IP / user-agent fields
  const ipAddresses = ['41.13.24.102', '105.224.56.78', '196.25.180.44', '102.68.34.12', '41.185.20.200'];
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
  ];

  // ─── 2. PROPERTY ───
  const property = await propertyRepo.save(propertyRepo.create({
    name: 'Seaside Guesthouse',
    slug: 'seaside-guesthouse',
    description: 'A charming 12-room boutique guesthouse perched above the Atlantic Ocean in Camps Bay, Cape Town. With panoramic sea views, a sparkling pool, and warm South African hospitality, we offer the perfect coastal escape for local and international travellers.',
    property_type: 'guesthouse',
    address_line1: '42 Ocean View Drive',
    address_line2: 'Camps Bay',
    city: 'Cape Town',
    province: 'Western Cape',
    postal_code: '8005',
    country: 'ZA',
    latitude: -33.9510,
    longitude: 18.3780,
    email: 'info@seasideguesthouse.co.za',
    phone: '+27211234567',
    website: 'https://seasideguesthouse.co.za',
    timezone: 'Africa/Johannesburg',
    currency: 'ZAR',
    check_in_time: '14:00',
    check_out_time: '10:00',
    min_stay_nights: 1,
    max_stay_nights: 21,
    advance_booking_days: 365,
    deposit_required: true,
    deposit_percentage: 50,
    cancellation_policy: 'Free cancellation up to 48 hours before check-in. After that, the deposit is non-refundable. No-shows are charged the full first night.',
    is_active: true,
    is_published: true,
    cover_image_url: 'https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg?auto=compress&cs=tinysrgb&w=1200',
    photos: propertyPhotos,
  }));

  await puRepo.save([
    puRepo.create({ property_id: property.id, user_id: owner.id, role: PropertyUserRole.OWNER, is_active: true }),
    puRepo.create({ property_id: property.id, user_id: manager.id, role: PropertyUserRole.MANAGER, is_active: true }),
    puRepo.create({ property_id: property.id, user_id: staff1.id, role: PropertyUserRole.STAFF, is_active: true }),
    puRepo.create({ property_id: property.id, user_id: staff2.id, role: PropertyUserRole.STAFF, is_active: true }),
  ]);
  console.log('Created property with 4 linked users + Pexels photos');

  // ─── 3. ROOM TYPES ───
  const deluxeDouble = await rtRepo.save(rtRepo.create({
    property_id: property.id,
    name: 'Deluxe Sea View Double',
    description: 'Spacious room with queen bed, balcony, and panoramic Atlantic Ocean views. Includes mini-bar and complimentary welcome drinks.',
    base_price: 2200,
    max_occupancy: 2,
    bed_type: 'Queen',
    size_sqm: 28,
    is_active: true,
    sort_order: 1,
    photos: roomTypePhotos.deluxe,
  }));

  const gardenSuite = await rtRepo.save(rtRepo.create({
    property_id: property.id,
    name: 'Garden Suite',
    description: 'Private ground-floor suite with king bed, kitchenette, separate lounge area, and direct access to the tropical garden and pool.',
    base_price: 3500,
    max_occupancy: 4,
    bed_type: 'King',
    size_sqm: 45,
    is_active: true,
    sort_order: 2,
    photos: roomTypePhotos.suite,
  }));

  const standardDouble = await rtRepo.save(rtRepo.create({
    property_id: property.id,
    name: 'Standard Double',
    description: 'Comfortable room with double bed, en-suite bathroom, and garden views. Great value for couples.',
    base_price: 1400,
    max_occupancy: 2,
    bed_type: 'Double',
    size_sqm: 22,
    is_active: true,
    sort_order: 3,
    photos: roomTypePhotos.standard,
  }));

  const familyRoom = await rtRepo.save(rtRepo.create({
    property_id: property.id,
    name: 'Family Room',
    description: 'Spacious room with one double bed and two single beds, perfect for families. Includes a small play area and child-safe bathroom.',
    base_price: 2800,
    max_occupancy: 4,
    bed_type: 'Double + 2 Singles',
    size_sqm: 38,
    is_active: true,
    sort_order: 4,
    photos: roomTypePhotos.family,
  }));

  const singleRoom = await rtRepo.save(rtRepo.create({
    property_id: property.id,
    name: 'Standard Single',
    description: 'Cozy room with single bed, ideal for solo travellers or business guests. Compact but well-equipped.',
    base_price: 950,
    max_occupancy: 1,
    bed_type: 'Single',
    size_sqm: 16,
    is_active: true,
    sort_order: 5,
    photos: roomTypePhotos.single,
  }));

  const roomTypes = [deluxeDouble, gardenSuite, standardDouble, familyRoom, singleRoom];
  console.log('Created 5 room types with photos');

  // ─── 4. ROOM AMENITIES ───
  const amenityMap: Record<string, { amenity: string; icon: string }[]> = {
    [deluxeDouble.id]: [
      { amenity: 'Free WiFi', icon: 'wifi' },
      { amenity: 'Air Conditioning', icon: 'snowflake' },
      { amenity: 'Flat-screen TV', icon: 'tv' },
      { amenity: 'Mini Bar', icon: 'wine' },
      { amenity: 'Sea View Balcony', icon: 'sunrise' },
      { amenity: 'Safe', icon: 'lock' },
      { amenity: 'Coffee Machine', icon: 'coffee' },
      { amenity: 'Hair Dryer', icon: 'wind' },
      { amenity: 'Bathrobes & Slippers', icon: 'shirt' },
    ],
    [gardenSuite.id]: [
      { amenity: 'Free WiFi', icon: 'wifi' },
      { amenity: 'Air Conditioning', icon: 'snowflake' },
      { amenity: 'Flat-screen TV', icon: 'tv' },
      { amenity: 'Kitchenette', icon: 'utensils' },
      { amenity: 'Garden Access', icon: 'leaf' },
      { amenity: 'Pool Access', icon: 'droplet' },
      { amenity: 'Safe', icon: 'lock' },
      { amenity: 'King Bed', icon: 'bed' },
      { amenity: 'Separate Lounge', icon: 'sofa' },
      { amenity: 'Coffee Machine', icon: 'coffee' },
      { amenity: 'Bathrobes & Slippers', icon: 'shirt' },
      { amenity: 'Complimentary Breakfast', icon: 'croissant' },
    ],
    [standardDouble.id]: [
      { amenity: 'Free WiFi', icon: 'wifi' },
      { amenity: 'Air Conditioning', icon: 'snowflake' },
      { amenity: 'Flat-screen TV', icon: 'tv' },
      { amenity: 'Garden View', icon: 'leaf' },
      { amenity: 'Hair Dryer', icon: 'wind' },
      { amenity: 'Safe', icon: 'lock' },
    ],
    [familyRoom.id]: [
      { amenity: 'Free WiFi', icon: 'wifi' },
      { amenity: 'Air Conditioning', icon: 'snowflake' },
      { amenity: 'Flat-screen TV', icon: 'tv' },
      { amenity: 'Mini Fridge', icon: 'box' },
      { amenity: 'Play Area', icon: 'puzzle' },
      { amenity: 'Safe', icon: 'lock' },
      { amenity: 'Hair Dryer', icon: 'wind' },
      { amenity: 'Extra Towels', icon: 'layers' },
    ],
    [singleRoom.id]: [
      { amenity: 'Free WiFi', icon: 'wifi' },
      { amenity: 'Air Conditioning', icon: 'snowflake' },
      { amenity: 'Flat-screen TV', icon: 'tv' },
      { amenity: 'Desk', icon: 'edit' },
      { amenity: 'Hair Dryer', icon: 'wind' },
    ],
  };

  let totalAmenities = 0;
  for (const [roomTypeId, amenities] of Object.entries(amenityMap)) {
    for (const a of amenities) {
      await amenityRepo.save(amenityRepo.create({ room_type_id: roomTypeId, amenity: a.amenity, icon: a.icon }));
      totalAmenities++;
    }
  }
  console.log(`Created ${totalAmenities} room amenities`);

  // ─── 5. ROOMS ───
  const rooms: Room[] = [];
  const roomDefs = [
    { type: deluxeDouble, names: ['Ocean View 1', 'Ocean View 2', 'Ocean View 3'], floor: 'First' },
    { type: gardenSuite, names: ['Garden Suite 1', 'Garden Suite 2'], floor: 'Ground' },
    { type: standardDouble, names: ['Protea Room', 'Fynbos Room', 'Strelitzia Room'], floor: 'First' },
    { type: familyRoom, names: ['Family 1', 'Family 2'], floor: 'Ground' },
    { type: singleRoom, names: ['Compact 1', 'Compact 2'], floor: 'Second' },
  ];

  for (const def of roomDefs) {
    for (let i = 0; i < def.names.length; i++) {
      const room = await roomRepo.save(roomRepo.create({
        property_id: property.id,
        room_type_id: def.type.id,
        name: def.names[i],
        floor: def.floor,
        is_active: true,
        sort_order: rooms.length + 1,
      }));
      rooms.push(room);
    }
  }
  console.log(`Created ${rooms.length} rooms`);

  // ─── 6. RATE PERIODS ───
  const currentYear = new Date().getFullYear();

  const ratePeriods = [
    { name: 'Peak Season (Dec-Jan)', start: `${currentYear}-12-01`, end: `${currentYear + 1}-01-31`, modifier: 1.40, minStay: 3 },
    { name: 'High Season (Feb-Mar)', start: `${currentYear + 1}-02-01`, end: `${currentYear + 1}-03-31`, modifier: 1.20, minStay: 2 },
    { name: 'Mid Season (Apr-Jun)', start: `${currentYear + 1}-04-01`, end: `${currentYear + 1}-06-30`, modifier: 1.00, minStay: 1 },
    { name: 'Low Season (Jul-Sep)', start: `${currentYear}-07-01`, end: `${currentYear}-09-30`, modifier: 0.80, minStay: 1 },
    { name: 'Shoulder Season (Oct-Nov)', start: `${currentYear}-10-01`, end: `${currentYear}-11-30`, modifier: 1.10, minStay: 1 },
    { name: 'Easter Special', start: `${currentYear + 1}-04-18`, end: `${currentYear + 1}-04-21`, modifier: 1.30, minStay: 2 },
  ];

  for (const rp of ratePeriods) {
    await rateRepo.save(rateRepo.create({
      property_id: property.id,
      name: rp.name,
      start_date: rp.start,
      end_date: rp.end,
      price_modifier: rp.modifier,
      min_stay: rp.minStay,
      is_active: true,
    }));
  }

  await rateRepo.save(rateRepo.create({
    property_id: property.id,
    room_type_id: gardenSuite.id,
    name: 'Suite Peak Premium',
    start_date: `${currentYear}-12-15`,
    end_date: `${currentYear + 1}-01-15`,
    price_override: 5500,
    min_stay: 4,
    is_active: true,
  }));

  console.log('Created 7 rate periods');

  // ─── 7. AVAILABILITY ───
  const today = new Date();
  for (const room of rooms) {
    const records: Partial<RoomAvailability>[] = [];
    for (let d = 0; d < 90; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      records.push({
        room_id: room.id,
        date: date.toISOString().slice(0, 10),
        status: AvailabilityStatus.AVAILABLE,
      });
    }
    await availRepo.save(records as RoomAvailability[]);
  }

  const maintenanceRoom = rooms[rooms.length - 1]; // Compact 2
  await availRepo.createQueryBuilder().update()
    .set({ status: AvailabilityStatus.MAINTENANCE, blocked_reason: 'Bathroom renovation - new tiles and fixtures' })
    .where('room_id = :roomId AND date >= :start AND date <= :end', { roomId: maintenanceRoom.id, start: makeDate(3), end: makeDate(10) })
    .execute();

  const blockedRoom = rooms[4]; // Garden Suite 2
  await availRepo.createQueryBuilder().update()
    .set({ status: AvailabilityStatus.BLOCKED, blocked_reason: 'Owner personal use' })
    .where('room_id = :roomId AND date >= :start AND date <= :end', { roomId: blockedRoom.id, start: makeDate(20), end: makeDate(25) })
    .execute();

  for (const room of rooms) {
    const rt = roomTypes.find(t => t.id === room.room_type_id);
    if (rt) {
      await availRepo.createQueryBuilder().update()
        .set({ price_override: Number(rt.base_price) * 1.25 })
        .where('room_id = :roomId AND date >= :start AND date <= :end', { roomId: room.id, start: makeDate(14), end: makeDate(16) })
        .execute();
    }
  }

  console.log('Generated 90 days of availability with maintenance, blocks, and price overrides');

  // ─── 8. GUESTS ───
  const guestData = [
    { first_name: 'Sarah', last_name: 'Jones', email: 'sarah.jones@gmail.com', phone: '+27821111111', country: 'ZA', id_number: '9001015009087', total_stays: 4, total_revenue: 18000, last_stay_date: makeDate(-15), notes: 'Regular guest. Prefers ground floor rooms.' },
    { first_name: 'Mike', last_name: 'Brown', email: 'mike.brown@outlook.com', phone: '+27822222222', country: 'ZA', id_number: '8505125001082', total_stays: 2, total_revenue: 9200, last_stay_date: makeDate(-30) },
    { first_name: 'Lisa', last_name: 'Van Wyk', email: 'lisa.vw@gmail.com', phone: '+27823333333', country: 'ZA', id_number: '9203180005088', total_stays: 1, total_revenue: 4200, last_stay_date: makeDate(-60) },
    { first_name: 'Tom', last_name: 'Harrison', email: 'tom.h@mail.co.uk', phone: '+447700900123', country: 'GB', total_stays: 1, total_revenue: 10500, last_stay_date: makeDate(-45) },
    { first_name: 'Emma', last_name: 'Müller', email: 'emma.m@web.de', phone: '+4915112345678', country: 'DE', total_stays: 1, total_revenue: 7000, last_stay_date: makeDate(-22) },
    { first_name: 'Jean-Pierre', last_name: 'Dubois', email: 'jp.dubois@orange.fr', phone: '+33612345678', country: 'FR', total_stays: 0, total_revenue: 0 },
    { first_name: 'Priya', last_name: 'Naidoo', email: 'priya.n@yahoo.com', phone: '+27824444444', country: 'ZA', id_number: '8811220005081', total_stays: 3, total_revenue: 12600, last_stay_date: makeDate(-7), notes: 'VIP guest. Always requests flowers in room.' },
    { first_name: 'James', last_name: 'O\'Connor', email: 'james.oc@gmail.com', phone: '+353871234567', country: 'IE', total_stays: 1, total_revenue: 6300, last_stay_date: makeDate(-90) },
    { first_name: 'Chen', last_name: 'Wei', email: 'chen.wei@qq.com', phone: '+8613912345678', country: 'CN', total_stays: 0, total_revenue: 0 },
    { first_name: 'Fatima', last_name: 'Al-Hassan', email: 'fatima.h@gmail.com', phone: '+966501234567', country: 'SA', total_stays: 1, total_revenue: 14000, last_stay_date: makeDate(-20) },
    { first_name: 'David', last_name: 'Botha', email: 'david.botha@telkom.co.za', phone: '+27825555555', country: 'ZA', id_number: '7706155001089', total_stays: 6, total_revenue: 28400, last_stay_date: makeDate(-5), notes: 'Loyal guest since 2022. Anniversary couple - always book Garden Suite.' },
    { first_name: 'Anna', last_name: 'Botha', email: 'anna.botha@telkom.co.za', phone: '+27825555556', country: 'ZA', id_number: '7908240005082', total_stays: 6, total_revenue: 28400, last_stay_date: makeDate(-5) },
    { first_name: 'Robert', last_name: 'Smith', email: 'rsmith@business.com', phone: '+12025551234', country: 'US', total_stays: 2, total_revenue: 11200, last_stay_date: makeDate(-35) },
    { first_name: 'Zanele', last_name: 'Mthembu', email: 'zanele.m@icloud.com', phone: '+27826666666', country: 'ZA', id_number: '9505100005085', total_stays: 1, total_revenue: 2800, last_stay_date: makeDate(-50) },
    { first_name: 'Marcus', last_name: 'Johnson', email: 'marcus.j@gmail.com', phone: '+61412345678', country: 'AU', total_stays: 1, total_revenue: 8400, last_stay_date: makeDate(-10) },
    { first_name: 'Sipho', last_name: 'Zulu', email: 'sipho.z@webmail.co.za', phone: '+27827777777', country: 'ZA', total_stays: 0, total_revenue: 0 },
    { first_name: 'Maria', last_name: 'Santos', email: 'maria.s@gmail.com', phone: '+5511987654321', country: 'BR', total_stays: 0, total_revenue: 0 },
    { first_name: 'Heinrich', last_name: 'Visser', email: 'h.visser@gmail.com', phone: '+27828888888', country: 'ZA', id_number: '6812105001083', total_stays: 8, total_revenue: 42000, last_stay_date: makeDate(-3), notes: 'Top guest. Business traveller, stays monthly. Always needs desk and strong WiFi.' },
    { first_name: 'Lerato', last_name: 'Molefe', email: 'lerato.m@gmail.com', phone: '+27829999999', country: 'ZA', id_number: '9108300005086', total_stays: 2, total_revenue: 5600, last_stay_date: makeDate(-18) },
    { first_name: 'Yuki', last_name: 'Tanaka', email: 'yuki.t@yahoo.co.jp', phone: '+819012345678', country: 'JP', total_stays: 1, total_revenue: 7700, last_stay_date: makeDate(-40) },
    { first_name: 'Ahmed', last_name: 'Patel', email: 'ahmed.p@hotmail.com', phone: '+27830001111', country: 'ZA', id_number: '8803255001080', total_stays: 3, total_revenue: 16800, last_stay_date: makeDate(-8) },
    { first_name: 'Sophie', last_name: 'Laurent', email: 'sophie.l@gmail.com', phone: '+33687654321', country: 'FR', total_stays: 0, total_revenue: 0 },
    { first_name: 'Bongani', last_name: 'Ndlovu', email: 'bongani.n@outlook.com', phone: '+27830002222', country: 'ZA', total_stays: 1, total_revenue: 4400, last_stay_date: makeDate(-25) },
    { first_name: 'Rachel', last_name: 'Green', email: 'rachel.g@mail.com', phone: '+447700900456', country: 'GB', total_stays: 2, total_revenue: 15400, last_stay_date: makeDate(-12) },
    { first_name: 'Thabo', last_name: 'Mokoena', email: 'thabo.m@gmail.com', phone: '+27830003333', country: 'ZA', id_number: '9406125001086', total_stays: 1, total_revenue: 3500, last_stay_date: makeDate(-55) },
  ];

  const guests: Guest[] = [];
  for (const g of guestData) {
    guests.push(await guestRepo.save(guestRepo.create({ property_id: property.id, ...g })));
  }
  console.log(`Created ${guests.length} guests`);

  // ─── 9. BOOKINGS ───
  let refNum = 1;
  const year = today.getFullYear();
  const allBookings: Booking[] = [];

  interface BookingDef {
    roomIdx: number; guestIdx: number; checkIn: number; checkOut: number;
    source: BookingSource; status: BookingStatus; guestCount: number;
    specialRequests?: string; internalNotes?: string;
    cancelledDaysAgo?: number; cancellationReason?: string;
  }

  const bookingDefs: BookingDef[] = [
    // Past bookings (checked out)
    { roomIdx: 0, guestIdx: 0, checkIn: -30, checkOut: -27, source: BookingSource.DIRECT, status: BookingStatus.CHECKED_OUT, guestCount: 2, specialRequests: 'Late check-out if possible' },
    { roomIdx: 1, guestIdx: 1, checkIn: -25, checkOut: -22, source: BookingSource.PHONE, status: BookingStatus.CHECKED_OUT, guestCount: 2 },
    { roomIdx: 3, guestIdx: 3, checkIn: -22, checkOut: -15, source: BookingSource.BOOKING_COM, status: BookingStatus.CHECKED_OUT, guestCount: 2, specialRequests: 'Airport transfer needed' },
    { roomIdx: 4, guestIdx: 4, checkIn: -20, checkOut: -15, source: BookingSource.AIRBNB, status: BookingStatus.CHECKED_OUT, guestCount: 3 },
    { roomIdx: 6, guestIdx: 6, checkIn: -18, checkOut: -15, source: BookingSource.DIRECT, status: BookingStatus.CHECKED_OUT, guestCount: 2, specialRequests: 'Fresh flowers please', internalNotes: 'VIP guest - comp breakfast' },
    { roomIdx: 8, guestIdx: 7, checkIn: -15, checkOut: -12, source: BookingSource.DIRECT, status: BookingStatus.CHECKED_OUT, guestCount: 1 },
    { roomIdx: 2, guestIdx: 10, checkIn: -12, checkOut: -8, source: BookingSource.PHONE, status: BookingStatus.CHECKED_OUT, guestCount: 2, specialRequests: 'Anniversary - please arrange champagne', internalNotes: 'Loyalty discount 10% applied' },
    { roomIdx: 5, guestIdx: 12, checkIn: -10, checkOut: -5, source: BookingSource.EXPEDIA, status: BookingStatus.CHECKED_OUT, guestCount: 2 },
    { roomIdx: 9, guestIdx: 14, checkIn: -8, checkOut: -5, source: BookingSource.DIRECT, status: BookingStatus.CHECKED_OUT, guestCount: 1 },
    { roomIdx: 7, guestIdx: 9, checkIn: -7, checkOut: -3, source: BookingSource.DIRECT, status: BookingStatus.CHECKED_OUT, guestCount: 3, specialRequests: 'Halal breakfast options' },
    { roomIdx: 0, guestIdx: 17, checkIn: -5, checkOut: -2, source: BookingSource.DIRECT, status: BookingStatus.CHECKED_OUT, guestCount: 1, internalNotes: 'Business traveller - regular monthly guest' },
    { roomIdx: 3, guestIdx: 20, checkIn: -5, checkOut: -2, source: BookingSource.PHONE, status: BookingStatus.CHECKED_OUT, guestCount: 2 },
    { roomIdx: 6, guestIdx: 23, checkIn: -4, checkOut: -1, source: BookingSource.BOOKING_COM, status: BookingStatus.CHECKED_OUT, guestCount: 2, specialRequests: 'Extra pillows' },

    // Currently checked in
    { roomIdx: 0, guestIdx: 0, checkIn: -1, checkOut: 3, source: BookingSource.DIRECT, status: BookingStatus.CHECKED_IN, guestCount: 2, specialRequests: 'Sea-facing room please', internalNotes: 'Returning guest - 5th stay' },
    { roomIdx: 1, guestIdx: 14, checkIn: -2, checkOut: 2, source: BookingSource.AIRBNB, status: BookingStatus.CHECKED_IN, guestCount: 1 },
    { roomIdx: 3, guestIdx: 6, checkIn: -1, checkOut: 4, source: BookingSource.DIRECT, status: BookingStatus.CHECKED_IN, guestCount: 2, specialRequests: 'Fresh flowers and chocolates', internalNotes: 'VIP - complimentary breakfast' },
    { roomIdx: 5, guestIdx: 10, checkIn: 0, checkOut: 5, source: BookingSource.PHONE, status: BookingStatus.CHECKED_IN, guestCount: 2, specialRequests: 'Anniversary celebration - cake at check-in' },
    { roomIdx: 7, guestIdx: 18, checkIn: -1, checkOut: 2, source: BookingSource.WALK_IN, status: BookingStatus.CHECKED_IN, guestCount: 2 },
    { roomIdx: 10, guestIdx: 17, checkIn: 0, checkOut: 3, source: BookingSource.DIRECT, status: BookingStatus.CHECKED_IN, guestCount: 1, internalNotes: 'Monthly business guest' },

    // Confirmed future bookings
    { roomIdx: 0, guestIdx: 5, checkIn: 5, checkOut: 10, source: BookingSource.BOOKING_COM, status: BookingStatus.CONFIRMED, guestCount: 2 },
    { roomIdx: 2, guestIdx: 8, checkIn: 4, checkOut: 8, source: BookingSource.DIRECT, status: BookingStatus.CONFIRMED, guestCount: 2, specialRequests: 'Mandarin-speaking guide recommendation' },
    { roomIdx: 3, guestIdx: 9, checkIn: 7, checkOut: 14, source: BookingSource.DIRECT, status: BookingStatus.CONFIRMED, guestCount: 3, specialRequests: 'Halal catering for entire stay' },
    { roomIdx: 4, guestIdx: 21, checkIn: 6, checkOut: 12, source: BookingSource.AIRBNB, status: BookingStatus.CONFIRMED, guestCount: 2 },
    { roomIdx: 6, guestIdx: 1, checkIn: 8, checkOut: 11, source: BookingSource.PHONE, status: BookingStatus.CONFIRMED, guestCount: 2 },
    { roomIdx: 7, guestIdx: 22, checkIn: 10, checkOut: 14, source: BookingSource.DIRECT, status: BookingStatus.CONFIRMED, guestCount: 1, specialRequests: 'Ground floor preferred' },
    { roomIdx: 8, guestIdx: 13, checkIn: 5, checkOut: 7, source: BookingSource.WALK_IN, status: BookingStatus.CONFIRMED, guestCount: 1 },
    { roomIdx: 9, guestIdx: 24, checkIn: 12, checkOut: 15, source: BookingSource.DIRECT, status: BookingStatus.CONFIRMED, guestCount: 1 },
    { roomIdx: 1, guestIdx: 23, checkIn: 15, checkOut: 20, source: BookingSource.BOOKING_COM, status: BookingStatus.CONFIRMED, guestCount: 2 },
    { roomIdx: 5, guestIdx: 19, checkIn: 18, checkOut: 22, source: BookingSource.DIRECT, status: BookingStatus.CONFIRMED, guestCount: 2, specialRequests: 'Early check-in if possible' },
    { roomIdx: 0, guestIdx: 17, checkIn: 25, checkOut: 28, source: BookingSource.DIRECT, status: BookingStatus.CONFIRMED, guestCount: 1, internalNotes: 'Regular monthly stay' },

    // Pending bookings
    { roomIdx: 2, guestIdx: 15, checkIn: 10, checkOut: 13, source: BookingSource.DIRECT, status: BookingStatus.PENDING, guestCount: 1 },
    { roomIdx: 10, guestIdx: 16, checkIn: 14, checkOut: 18, source: BookingSource.DIRECT, status: BookingStatus.PENDING, guestCount: 1 },
    { roomIdx: 6, guestIdx: 5, checkIn: 20, checkOut: 25, source: BookingSource.EXPEDIA, status: BookingStatus.PENDING, guestCount: 2 },

    // Cancelled bookings
    { roomIdx: 0, guestIdx: 2, checkIn: -8, checkOut: -5, source: BookingSource.DIRECT, status: BookingStatus.CANCELLED, guestCount: 2, cancelledDaysAgo: 10, cancellationReason: 'Change of travel plans' },
    { roomIdx: 4, guestIdx: 19, checkIn: 8, checkOut: 12, source: BookingSource.BOOKING_COM, status: BookingStatus.CANCELLED, guestCount: 2, cancelledDaysAgo: 3, cancellationReason: 'Found alternative accommodation' },
    { roomIdx: 9, guestIdx: 3, checkIn: 3, checkOut: 7, source: BookingSource.AIRBNB, status: BookingStatus.CANCELLED, guestCount: 2, cancelledDaysAgo: 5, cancellationReason: 'Flight cancelled due to weather' },

    // No-shows
    { roomIdx: 8, guestIdx: 13, checkIn: -3, checkOut: -1, source: BookingSource.DIRECT, status: BookingStatus.NO_SHOW, guestCount: 1, internalNotes: 'Guest did not arrive, could not reach by phone' },
    { roomIdx: 10, guestIdx: 22, checkIn: -1, checkOut: 1, source: BookingSource.BOOKING_COM, status: BookingStatus.NO_SHOW, guestCount: 1 },
  ];

  for (const b of bookingDefs) {
    const room = rooms[b.roomIdx];
    const guest = guests[b.guestIdx];
    const rt = roomTypes.find(t => t.id === room.room_type_id);
    const rate = Number(rt?.base_price || 1500);
    const nights = b.checkOut - b.checkIn;

    const booking = await bookingRepo.save({
      property_id: property.id,
      room_id: room.id,
      guest_id: guest.id,
      reference_number: `POS-${year}-${String(refNum++).padStart(4, '0')}`,
      check_in: makeDate(b.checkIn),
      check_out: makeDate(b.checkOut),
      nights,
      total_price: rate * nights,
      nightly_rate: rate,
      currency: 'ZAR',
      status: b.status,
      source: b.source,
      guest_count: b.guestCount,
      special_requests: b.specialRequests || null,
      internal_notes: b.internalNotes || null,
      cancelled_at: b.cancelledDaysAgo ? makeTimestamp(-b.cancelledDaysAgo) : undefined,
      cancellation_reason: b.cancellationReason || null,
    } as any) as Booking;

    allBookings.push(booking);

    if ([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT].includes(b.status)) {
      await availRepo.createQueryBuilder().update()
        .set({ status: AvailabilityStatus.BOOKED, booking_id: booking.id })
        .where('room_id = :roomId AND date >= :start AND date < :end', { roomId: room.id, start: makeDate(b.checkIn), end: makeDate(b.checkOut) })
        .execute();
    }
  }
  console.log(`Created ${allBookings.length} bookings`);

  // ─── 10. PAYMENTS ───
  const paymentDefs: { bookingIdx: number; type: string; status: string; provider: string; paidDaysAgo?: number; notes?: string }[] = [];
  let payIdx = 0;

  for (const _b of allBookings) {
    const bDef = bookingDefs[payIdx];

    if (bDef.status === BookingStatus.CHECKED_OUT) {
      paymentDefs.push({ bookingIdx: payIdx, type: 'DEPOSIT', status: 'COMPLETED', provider: pick(['PAYFAST', 'EFT', 'CARD_MANUAL']), paidDaysAgo: Math.abs(bDef.checkIn) + 5, notes: 'Deposit paid at time of booking' });
      paymentDefs.push({ bookingIdx: payIdx, type: 'BALANCE', status: 'COMPLETED', provider: pick(['PAYFAST', 'EFT', 'CASH', 'CARD_MANUAL']), paidDaysAgo: Math.abs(bDef.checkIn), notes: 'Balance paid at check-in' });
    } else if (bDef.status === BookingStatus.CHECKED_IN) {
      paymentDefs.push({ bookingIdx: payIdx, type: 'DEPOSIT', status: 'COMPLETED', provider: pick(['PAYFAST', 'EFT']), paidDaysAgo: Math.abs(bDef.checkIn) + 3 });
      paymentDefs.push({ bookingIdx: payIdx, type: 'BALANCE', status: 'PENDING', provider: 'PAYFAST' });
    } else if (bDef.status === BookingStatus.CONFIRMED) {
      if (payIdx % 2 === 0) {
        paymentDefs.push({ bookingIdx: payIdx, type: 'DEPOSIT', status: 'COMPLETED', provider: 'PAYFAST', paidDaysAgo: 2 });
      } else {
        paymentDefs.push({ bookingIdx: payIdx, type: 'DEPOSIT', status: 'PENDING', provider: 'PAYFAST' });
      }
    } else if (bDef.status === BookingStatus.PENDING) {
      paymentDefs.push({ bookingIdx: payIdx, type: 'FULL', status: 'PENDING', provider: 'PAYFAST' });
    } else if (bDef.status === BookingStatus.CANCELLED && bDef.cancelledDaysAgo && bDef.cancelledDaysAgo > 4) {
      paymentDefs.push({ bookingIdx: payIdx, type: 'DEPOSIT', status: 'COMPLETED', provider: 'PAYFAST', paidDaysAgo: Math.abs(bDef.checkIn) + 10 });
      paymentDefs.push({ bookingIdx: payIdx, type: 'REFUND', status: 'COMPLETED', provider: 'PAYFAST', paidDaysAgo: bDef.cancelledDaysAgo - 1, notes: 'Refund processed - cancelled within policy window' });
    } else if (bDef.status === BookingStatus.NO_SHOW) {
      paymentDefs.push({ bookingIdx: payIdx, type: 'DEPOSIT', status: 'COMPLETED', provider: pick(['PAYFAST', 'EFT']), paidDaysAgo: Math.abs(bDef.checkIn) + 5, notes: 'Deposit forfeited - no show' });
    }

    payIdx++;
  }

  let eftCounter = 1;
  for (const pd of paymentDefs) {
    const booking = allBookings[pd.bookingIdx];
    const totalPrice = Number(booking.total_price);
    let amount = totalPrice;
    if (pd.type === 'DEPOSIT') amount = totalPrice * 0.5;
    if (pd.type === 'BALANCE') amount = totalPrice * 0.5;
    if (pd.type === 'REFUND') amount = totalPrice * 0.5;

    await paymentRepo.save(paymentRepo.create({
      booking_id: booking.id,
      property_id: property.id,
      amount: Math.round(amount * 100) / 100,
      currency: 'ZAR',
      payment_type: pd.type as any,
      status: pd.status as any,
      provider: pd.provider as any,
      provider_ref: pd.status === 'COMPLETED' ? `PF-${Date.now()}-${randomInt(1000, 9999)}` : undefined,
      eft_reference: pd.provider === 'EFT' ? `EFT-POS-${String(eftCounter++).padStart(3, '0')}` : undefined,
      eft_confirmed_by: pd.provider === 'EFT' && pd.status === 'COMPLETED' ? manager.id : undefined,
      paid_at: pd.paidDaysAgo && pd.status === 'COMPLETED' ? makeTimestamp(-pd.paidDaysAgo, randomInt(8, 18)) : undefined,
      refunded_at: pd.type === 'REFUND' && pd.status === 'COMPLETED' ? makeTimestamp(-(pd.paidDaysAgo || 1)) : undefined,
      notes: pd.notes || null,
    } as any));
  }
  console.log(`Created ${paymentDefs.length} payments`);

  // ─── 11. PAYMENT SETTINGS ───
  await psRepo.save(psRepo.create({
    property_id: property.id,
    payfast_merchant_id: '10000100',
    payfast_merchant_key: '46f0cd694581a',
    payfast_passphrase: 'jt7NOE43FZPn',
    payfast_sandbox: true,
    payfast_enabled: true,
    eft_enabled: true,
    eft_bank_name: 'FNB',
    eft_account_holder: 'Seaside GH (Pty) Ltd',
    eft_account_number: '62012345678',
    eft_branch_code: '250655',
    eft_account_type: 'cheque',
  }));
  console.log('Created payment settings');

  // ─── 12. NOTIFICATION SETTINGS (with automation config) ───
  await nsRepo.save(nsRepo.create({
    property_id: property.id,
    email_booking_confirmation: true,
    email_cancellation: true,
    email_payment_received: true,
    email_owner_new_booking: true,
    whatsapp_booking_confirmation: true,
    whatsapp_owner_new_booking: true,
    email_pre_arrival: true,
    pre_arrival_days_before: 1,
    email_post_stay_review: true,
    post_stay_days_after: 1,
    whatsapp_check_in_info: true,
    wifi_name: 'SeasideGuest',
    wifi_password: 'Welcome2Cape!',
    directions: 'From N1: Take the M3 south toward Muizenberg. Exit at Camps Bay Drive. Turn right onto Victoria Road, then left onto Ocean View Drive. We are number 42 on your right.',
  }));
  console.log('Created notification settings (with automation + WiFi + directions)');

  // ─── 13. NOTIFICATIONS ───
  const notifTemplates = [
    { template: 'BOOKING_CONFIRMATION', channel: 'EMAIL', recipientType: 'GUEST', subject: 'Booking Confirmed - Seaside Guesthouse' },
    { template: 'NEW_BOOKING_ALERT', channel: 'EMAIL', recipientType: 'OWNER', subject: 'New Booking Alert' },
    { template: 'PAYMENT_RECEIVED', channel: 'EMAIL', recipientType: 'GUEST', subject: 'Payment Received - Thank You' },
    { template: 'BOOKING_CANCELLATION', channel: 'EMAIL', recipientType: 'GUEST', subject: 'Booking Cancellation Confirmation' },
    { template: 'PRE_ARRIVAL', channel: 'EMAIL', recipientType: 'GUEST', subject: 'Your Stay is Coming Up - Seaside Guesthouse' },
    { template: 'CHECK_IN_INSTRUCTIONS', channel: 'EMAIL', recipientType: 'GUEST', subject: 'Check-in Instructions - Seaside Guesthouse' },
    { template: 'POST_STAY_REVIEW', channel: 'EMAIL', recipientType: 'GUEST', subject: 'How Was Your Stay? - Seaside Guesthouse' },
    { template: 'PAYMENT_REMINDER', channel: 'EMAIL', recipientType: 'GUEST', subject: 'Payment Reminder - Seaside Guesthouse' },
  ];

  let notifCount = 0;
  for (let i = 0; i < Math.min(allBookings.length, 20); i++) {
    const booking = allBookings[i];
    const bDef = bookingDefs[i];
    const guest = guests[bDef.guestIdx];

    await notifRepo.save(notifRepo.create({
      property_id: property.id, booking_id: booking.id, channel: 'EMAIL' as any,
      template: 'BOOKING_CONFIRMATION' as any, recipient_type: 'GUEST' as any,
      recipient_email: guest.email,
      subject: 'Booking Confirmed - Seaside Guesthouse',
      body: `Dear ${guest.first_name}, your booking at Seaside Guesthouse has been confirmed. Reference: ${booking.reference_number}. Check-in: ${booking.check_in}, Check-out: ${booking.check_out}.`,
      status: 'SENT' as any, sent_at: makeTimestamp(bDef.checkIn - 3, 10), provider: 'sendgrid',
    } as any));
    notifCount++;

    await notifRepo.save(notifRepo.create({
      property_id: property.id, booking_id: booking.id, channel: 'EMAIL' as any,
      template: 'NEW_BOOKING_ALERT' as any, recipient_type: 'OWNER' as any,
      recipient_email: 'info@seasideguesthouse.co.za',
      subject: `New Booking: ${guest.first_name} ${guest.last_name} - ${booking.reference_number}`,
      body: `New booking received. Guest: ${guest.first_name} ${guest.last_name}. Room: ${rooms[bDef.roomIdx].name}. Dates: ${booking.check_in} to ${booking.check_out}. Total: R${booking.total_price}.`,
      status: 'DELIVERED' as any, sent_at: makeTimestamp(bDef.checkIn - 3, 10), provider: 'sendgrid',
    }));
    notifCount++;

    if (guest.phone && i % 3 === 0) {
      await notifRepo.save(notifRepo.create({
        property_id: property.id, booking_id: booking.id, channel: 'WHATSAPP' as any,
        template: 'BOOKING_CONFIRMATION' as any, recipient_type: 'GUEST' as any,
        recipient_phone: guest.phone,
        body: `Hi ${guest.first_name}! Your booking at Seaside Guesthouse is confirmed. Ref: ${booking.reference_number}. See you on ${booking.check_in}!`,
        status: 'DELIVERED' as any, sent_at: makeTimestamp(bDef.checkIn - 3, 10), provider: 'twilio',
      }));
      notifCount++;
    }

    if ([BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT].includes(bDef.status)) {
      await notifRepo.save(notifRepo.create({
        property_id: property.id, booking_id: booking.id, channel: 'EMAIL' as any,
        template: 'PRE_ARRIVAL' as any, recipient_type: 'GUEST' as any,
        recipient_email: guest.email,
        subject: 'Your Stay is Coming Up - Seaside Guesthouse',
        body: `Dear ${guest.first_name}, we're looking forward to welcoming you on ${booking.check_in}. Check-in is from 14:00. WiFi: SeasideGuest / Welcome2Cape!`,
        status: 'DELIVERED' as any, sent_at: makeTimestamp(bDef.checkIn - 1, 9), provider: 'sendgrid',
      }));
      notifCount++;
    }

    if (bDef.status === BookingStatus.CHECKED_OUT) {
      await notifRepo.save(notifRepo.create({
        property_id: property.id, booking_id: booking.id, channel: 'EMAIL' as any,
        template: 'PAYMENT_RECEIVED' as any, recipient_type: 'GUEST' as any,
        recipient_email: guest.email, subject: 'Payment Received - Thank You',
        body: `Dear ${guest.first_name}, we've received your payment of R${booking.total_price} for booking ${booking.reference_number}. Thank you!`,
        status: 'SENT' as any, sent_at: makeTimestamp(bDef.checkIn, 15), provider: 'sendgrid',
      }));
      notifCount++;

      await notifRepo.save(notifRepo.create({
        property_id: property.id, booking_id: booking.id, channel: 'EMAIL' as any,
        template: 'POST_STAY_REVIEW' as any, recipient_type: 'GUEST' as any,
        recipient_email: guest.email, subject: 'How Was Your Stay? - Seaside Guesthouse',
        body: `Dear ${guest.first_name}, thank you for staying with us! We'd love to hear about your experience. Please take a moment to leave a review.`,
        status: Math.abs(bDef.checkOut) > 5 ? 'DELIVERED' as any : 'SENT' as any,
        sent_at: makeTimestamp(bDef.checkOut + 1, 10), provider: 'sendgrid',
      }));
      notifCount++;
    }

    if (bDef.status === BookingStatus.CANCELLED) {
      await notifRepo.save(notifRepo.create({
        property_id: property.id, booking_id: booking.id, channel: 'EMAIL' as any,
        template: 'BOOKING_CANCELLATION' as any, recipient_type: 'GUEST' as any,
        recipient_email: guest.email, subject: 'Booking Cancellation Confirmation',
        body: `Dear ${guest.first_name}, your booking ${booking.reference_number} has been cancelled as requested.`,
        status: 'DELIVERED' as any, sent_at: makeTimestamp(-(bDef.cancelledDaysAgo || 1), 12), provider: 'sendgrid',
      }));
      notifCount++;
    }

    if (bDef.status === BookingStatus.PENDING) {
      await notifRepo.save(notifRepo.create({
        property_id: property.id, booking_id: booking.id, channel: 'EMAIL' as any,
        template: 'PAYMENT_REMINDER' as any, recipient_type: 'GUEST' as any,
        recipient_email: guest.email, subject: 'Payment Reminder - Seaside Guesthouse',
        body: `Dear ${guest.first_name}, this is a friendly reminder that payment for your upcoming stay (Ref: ${booking.reference_number}) is still outstanding.`,
        status: 'SENT' as any, sent_at: makeTimestamp(-1, 9), provider: 'sendgrid',
      }));
      notifCount++;
    }

    if (i === 5) {
      await notifRepo.save(notifRepo.create({
        property_id: property.id, booking_id: booking.id, channel: 'WHATSAPP' as any,
        template: 'BOOKING_CONFIRMATION' as any, recipient_type: 'GUEST' as any,
        recipient_phone: guest.phone, body: `Hi ${guest.first_name}! Your booking is confirmed.`,
        status: 'FAILED' as any, error_message: 'WhatsApp API error: recipient phone number not registered on WhatsApp',
        provider: 'twilio',
      }));
      notifCount++;
    }
  }
  console.log(`Created ${notifCount} notifications`);

  // ─── 14. CHANNELS + MAPPINGS + SYNC LOGS ───
  const airbnbChannel = await channelRepo.save(channelRepo.create({
    property_id: property.id,
    type: ChannelType.AIRBNB,
    name: 'Airbnb - Seaside',
    status: ChannelStatus.ACTIVE,
    ical_import_url: 'https://www.airbnb.com/calendar/ical/12345678.ics?s=abc123',
    ical_export_token: randomBytes(32).toString('hex'),
    commission_percent: 15,
    rate_markup_percent: 10,
    sync_interval_minutes: 15,
    last_sync_at: makeTimestamp(-1, 2),
  }));

  const bookingComChannel = await channelRepo.save(channelRepo.create({
    property_id: property.id,
    type: ChannelType.BOOKING_COM,
    name: 'Booking.com - Main',
    status: ChannelStatus.ACTIVE,
    ical_import_url: 'https://admin.booking.com/hotel/ical/12345.ics',
    ical_export_token: randomBytes(32).toString('hex'),
    commission_percent: 18,
    rate_markup_percent: 15,
    sync_interval_minutes: 10,
    last_sync_at: makeTimestamp(0, -2),
  }));

  const expediaChannel = await channelRepo.save(channelRepo.create({
    property_id: property.id,
    type: ChannelType.EXPEDIA,
    name: 'Expedia',
    status: ChannelStatus.PAUSED,
    ical_export_token: randomBytes(32).toString('hex'),
    commission_percent: 20,
    rate_markup_percent: 12,
    sync_interval_minutes: 30,
  }));

  const directIcal = await channelRepo.save(channelRepo.create({
    property_id: property.id,
    type: ChannelType.ICAL,
    name: 'Google Calendar Sync',
    status: ChannelStatus.ACTIVE,
    ical_import_url: 'https://calendar.google.com/calendar/ical/example/basic.ics',
    ical_export_token: randomBytes(32).toString('hex'),
    commission_percent: 0,
    rate_markup_percent: 0,
    sync_interval_minutes: 60,
    last_sync_at: makeTimestamp(0, -5),
  }));

  console.log('Created 4 channels (Airbnb, Booking.com, Expedia, iCal)');

  // Channel mappings
  const mappings = [
    { channel: airbnbChannel, roomType: deluxeDouble, extListing: 'ab-12345', rateOverride: null },
    { channel: airbnbChannel, roomType: gardenSuite, extListing: 'ab-12346', rateOverride: 4200 },
    { channel: airbnbChannel, roomType: standardDouble, extListing: 'ab-12347', rateOverride: null },
    { channel: bookingComChannel, roomType: deluxeDouble, extListing: 'bc-room-101', rateOverride: null },
    { channel: bookingComChannel, roomType: gardenSuite, extListing: 'bc-room-201', rateOverride: 4500 },
    { channel: bookingComChannel, roomType: familyRoom, extListing: 'bc-room-301', rateOverride: null },
    { channel: bookingComChannel, roomType: singleRoom, extListing: 'bc-room-401', rateOverride: null },
    { channel: expediaChannel, roomType: deluxeDouble, extListing: 'exp-55001', rateOverride: null },
    { channel: directIcal, roomType: deluxeDouble, extListing: null, rateOverride: null },
  ];

  for (const m of mappings) {
    const mapping = mappingRepo.create({
      channel: m.channel,
      room_type: m.roomType,
      external_listing_id: m.extListing,
      rate_override: m.rateOverride,
      sync_availability: true,
      sync_rates: true,
      is_active: true,
    } as any);
    await mappingRepo.save(mapping);
  }
  console.log(`Created ${mappings.length} channel mappings`);

  // Sync logs
  const syncLogData = [
    { channel: airbnbChannel, dir: SyncDirection.IMPORT, status: SyncStatus.SUCCESS, imported: 2, avail: 12, dur: 1850, daysAgo: 0 },
    { channel: airbnbChannel, dir: SyncDirection.IMPORT, status: SyncStatus.SUCCESS, imported: 0, avail: 8, dur: 920, daysAgo: 1 },
    { channel: airbnbChannel, dir: SyncDirection.IMPORT, status: SyncStatus.SUCCESS, imported: 1, avail: 10, conflicts: 1, resolved: 1, dur: 2340, daysAgo: 2 },
    { channel: airbnbChannel, dir: SyncDirection.EXPORT, status: SyncStatus.SUCCESS, exported: 5, dur: 450, daysAgo: 0 },
    { channel: bookingComChannel, dir: SyncDirection.IMPORT, status: SyncStatus.SUCCESS, imported: 3, avail: 15, dur: 3200, daysAgo: 0 },
    { channel: bookingComChannel, dir: SyncDirection.IMPORT, status: SyncStatus.PARTIAL, imported: 1, avail: 10, conflicts: 2, resolved: 1, dur: 4500, daysAgo: 1, error: 'Rate update failed for room type bc-room-301' },
    { channel: bookingComChannel, dir: SyncDirection.IMPORT, status: SyncStatus.FAILED, dur: 890, daysAgo: 3, error: 'HTTP 503: Service temporarily unavailable' },
    { channel: bookingComChannel, dir: SyncDirection.EXPORT, status: SyncStatus.SUCCESS, exported: 8, dur: 620, daysAgo: 0 },
    { channel: directIcal, dir: SyncDirection.IMPORT, status: SyncStatus.SUCCESS, imported: 0, avail: 5, dur: 340, daysAgo: 0 },
    { channel: directIcal, dir: SyncDirection.IMPORT, status: SyncStatus.SUCCESS, imported: 1, avail: 3, dur: 280, daysAgo: 2 },
  ];

  for (const sl of syncLogData) {
    const log = syncLogRepo.create({
      channel: sl.channel,
      direction: sl.dir,
      status: sl.status,
      bookings_imported: sl.imported || 0,
      bookings_exported: (sl as any).exported || 0,
      availability_updates: sl.avail || 0,
      conflicts_found: sl.conflicts || 0,
      conflicts_resolved: sl.resolved || 0,
      error_message: sl.error || undefined,
      duration_ms: sl.dur,
      created_at: makeTimestamp(-sl.daysAgo, randomInt(6, 22)),
    } as any);
    await syncLogRepo.save(log);
  }
  console.log(`Created ${syncLogData.length} sync logs`);

  // ─── 15. PRICING RULES ───
  const pricingRules = [
    { name: 'Weekend Surcharge', rule_type: PricingRuleType.WEEKEND, modifier_percent: 15, priority: 1 },
    { name: 'Weekday Discount', rule_type: PricingRuleType.WEEKDAY, modifier_percent: -10, priority: 1 },
    { name: 'Last Minute Deal (3 days)', rule_type: PricingRuleType.LAST_MINUTE, modifier_percent: -20, days_before_checkin: 3, priority: 2 },
    { name: 'Early Bird (30+ days)', rule_type: PricingRuleType.EARLY_BIRD, modifier_percent: -12, days_before_checkin: 30, priority: 2 },
    { name: 'Long Stay 7+ nights', rule_type: PricingRuleType.LENGTH_OF_STAY, modifier_percent: -15, min_nights: 7, priority: 3 },
    { name: 'Long Stay 14+ nights', rule_type: PricingRuleType.LENGTH_OF_STAY, modifier_percent: -22, min_nights: 14, priority: 4 },
    { name: 'High Occupancy Surge', rule_type: PricingRuleType.OCCUPANCY, modifier_percent: 20, occupancy_threshold_percent: 85, priority: 5 },
    { name: 'Suite Weekend Premium', rule_type: PricingRuleType.WEEKEND, modifier_percent: 25, priority: 6, room_type_id: gardenSuite.id },
  ];
  for (const pr of pricingRules) {
    await pricingRuleRepo.save(pricingRuleRepo.create({
      property_id: property.id,
      room_type_id: (pr as any).room_type_id || undefined,
      name: pr.name,
      rule_type: pr.rule_type,
      modifier_percent: pr.modifier_percent,
      days_before_checkin: pr.days_before_checkin || undefined,
      min_nights: pr.min_nights || undefined,
      occupancy_threshold_percent: pr.occupancy_threshold_percent || undefined,
      priority: pr.priority,
      is_active: true,
    } as any));
  }
  console.log(`Created ${pricingRules.length} pricing rules`);

  // ─── 16. INVOICES ───
  let invoiceNum = 1;
  const allInvoices: Invoice[] = [];
  // Generate invoices for checked-out and checked-in bookings
  for (let i = 0; i < allBookings.length; i++) {
    const bDef = bookingDefs[i];
    const booking = allBookings[i];
    const guest = guests[bDef.guestIdx];
    if (![BookingStatus.CHECKED_OUT, BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED].includes(bDef.status)) continue;

    const totalPrice = Number(booking.total_price);
    const nights = bDef.checkOut - bDef.checkIn;
    const nightlyRate = Number(booking.nightly_rate);
    const subtotal = +(totalPrice / 1.15).toFixed(2);
    const vatAmount = +(totalPrice - subtotal).toFixed(2);

    let status: InvoiceStatus;
    let amountPaid: number;
    let invoiceType: InvoiceType;
    if (bDef.status === BookingStatus.CHECKED_OUT) {
      status = InvoiceStatus.PAID;
      amountPaid = totalPrice;
      invoiceType = InvoiceType.TAX_INVOICE;
    } else if (bDef.status === BookingStatus.CHECKED_IN) {
      status = InvoiceStatus.PARTIALLY_PAID;
      amountPaid = totalPrice * 0.5;
      invoiceType = InvoiceType.TAX_INVOICE;
    } else {
      status = InvoiceStatus.ISSUED;
      amountPaid = i % 2 === 0 ? totalPrice * 0.5 : 0;
      invoiceType = InvoiceType.PROFORMA;
    }

    const inv = await invoiceRepo.save(invoiceRepo.create({
      invoice_number: `INV-${year}-${String(invoiceNum++).padStart(4, '0')}`,
      booking_id: booking.id,
      property_id: property.id,
      invoice_type: invoiceType,
      status,
      issue_date: makeDate(bDef.checkIn),
      due_date: makeDate(bDef.checkIn + 7),
      subtotal,
      vat_rate: 15,
      vat_amount: vatAmount,
      total: totalPrice,
      currency: 'ZAR',
      amount_paid: amountPaid,
      line_items: [
        { description: `Accommodation – ${rooms[bDef.roomIdx].name} (${nights} nights)`, quantity: nights, unit_price: nightlyRate, total: totalPrice },
      ],
      guest_details: {
        name: `${guest.first_name} ${guest.last_name}`,
        email: guest.email,
        phone: guest.phone || undefined,
      },
      property_details: {
        name: 'Seaside Guesthouse',
        address: '42 Ocean View Drive, Camps Bay, Cape Town, 8005',
        email: 'info@seasideguesthouse.co.za',
        phone: '+27211234567',
        vat_number: '4123456789',
      },
      notes: bDef.status === BookingStatus.CHECKED_OUT ? 'Paid in full. Thank you for staying with us!' : null,
    } as any)) as unknown as Invoice;
    allInvoices.push(inv);
  }
  console.log(`Created ${allInvoices.length} invoices`);

  // ─── 17. REFUNDS ───
  // Create refunds for the cancelled bookings that had deposits paid
  const cancelledBookingIndices = bookingDefs
    .map((b, i) => ({ ...b, idx: i }))
    .filter(b => b.status === BookingStatus.CANCELLED && b.cancelledDaysAgo && b.cancelledDaysAgo > 4);

  let refundCount = 0;
  for (const cb of cancelledBookingIndices) {
    const booking = allBookings[cb.idx];
    // Find the deposit payment for this booking
    const depositPayment = await paymentRepo.findOne({
      where: { booking_id: booking.id, payment_type: 'DEPOSIT' as any, status: 'COMPLETED' as any },
    });
    if (!depositPayment) continue;

    await refundRepo.save(refundRepo.create({
      booking_id: booking.id,
      property_id: property.id,
      original_payment_id: depositPayment.id,
      amount: Number(depositPayment.amount),
      currency: 'ZAR',
      status: RefundStatus.COMPLETED,
      reason: RefundReason.GUEST_CANCELLATION,
      reason_details: cb.cancellationReason || 'Guest requested cancellation within policy window',
      requested_by: staff1.id,
      approved_by: manager.id,
      processed_by: manager.id,
      provider_ref: `RF-${Date.now()}-${randomInt(1000, 9999)}`,
      approved_at: makeTimestamp(-(cb.cancelledDaysAgo! - 1), 10),
      processed_at: makeTimestamp(-(cb.cancelledDaysAgo! - 1), 14),
      completed_at: makeTimestamp(-(cb.cancelledDaysAgo! - 1), 14),
      notes: 'Refund processed – cancelled within policy window',
    }));
    refundCount++;
  }

  // Add a pending refund for a service issue
  const serviceRefundBooking = allBookings[9]; // checked-out booking
  const servicePayment = await paymentRepo.findOne({
    where: { booking_id: serviceRefundBooking.id, payment_type: 'DEPOSIT' as any, status: 'COMPLETED' as any },
  });
  if (servicePayment) {
    await refundRepo.save(refundRepo.create({
      booking_id: serviceRefundBooking.id,
      property_id: property.id,
      original_payment_id: servicePayment.id,
      amount: 500,
      currency: 'ZAR',
      status: RefundStatus.APPROVED,
      reason: RefundReason.SERVICE_ISSUE,
      reason_details: 'Air conditioning was broken for one night. Partial refund approved.',
      requested_by: staff1.id,
      approved_by: owner.id,
      approved_at: makeTimestamp(-2, 11),
      notes: 'Guest reported A/C issue on night 2. Partial comp approved by owner.',
    }));
    refundCount++;
  }

  // Add a rejected refund for a no-show booking
  const noShowIdx = bookingDefs.findIndex(b => b.status === BookingStatus.NO_SHOW);
  const noShowBooking = noShowIdx >= 0 ? allBookings[noShowIdx] : undefined;
  const noShowPayment = noShowBooking ? await paymentRepo.findOne({
    where: { booking_id: noShowBooking.id, status: 'COMPLETED' as any },
  }) : null;
  if (noShowBooking && noShowPayment) {
    await refundRepo.save(refundRepo.create({
      booking_id: noShowBooking.id,
      property_id: property.id,
      original_payment_id: noShowPayment.id,
      amount: Number(noShowPayment.amount),
      currency: 'ZAR',
      status: RefundStatus.REJECTED,
      reason: RefundReason.GUEST_CANCELLATION,
      reason_details: 'Guest did not show up and requests deposit back',
      requested_by: staff1.id,
      notes: 'Rejected – no-show policy applies. Deposit forfeited.',
    }));
    refundCount++;
  }
  console.log(`Created ${refundCount} refunds`);

  // ─── 18. GUEST CONSENTS (POPIA) ───
  let consentCount = 0;
  const consentGuests = [0, 1, 3, 6, 10, 11, 14, 17, 18, 20, 23, 24]; // subset of guests
  for (const gi of consentGuests) {
    const guest = guests[gi];
    // Data processing consent – all have it
    await consentRepo.save(consentRepo.create({
      guest_id: guest.id,
      property_id: property.id,
      consent_type: ConsentType.DATA_PROCESSING,
      status: ConsentStatus.GRANTED,
      purpose: 'Processing booking and stay information for accommodation services',
      ip_address: pick(ipAddresses),
      user_agent: pick(userAgents),
      granted_at: makeTimestamp(-randomInt(5, 60), randomInt(8, 20)),
    }));
    consentCount++;

    // Marketing email – most have it
    if (gi % 3 !== 2) {
      await consentRepo.save(consentRepo.create({
        guest_id: guest.id,
        property_id: property.id,
        consent_type: ConsentType.MARKETING_EMAIL,
        status: ConsentStatus.GRANTED,
        purpose: 'Receiving promotional offers, seasonal deals, and newsletter',
        ip_address: pick(ipAddresses),
        user_agent: pick(userAgents),
        granted_at: makeTimestamp(-randomInt(5, 60), randomInt(8, 20)),
      }));
      consentCount++;
    }

    // WhatsApp marketing – some have it
    if (gi % 4 === 0) {
      await consentRepo.save(consentRepo.create({
        guest_id: guest.id,
        property_id: property.id,
        consent_type: ConsentType.MARKETING_WHATSAPP,
        status: ConsentStatus.GRANTED,
        purpose: 'Receiving booking updates and promotions via WhatsApp',
        ip_address: pick(ipAddresses),
        user_agent: pick(userAgents),
        granted_at: makeTimestamp(-randomInt(5, 60), randomInt(8, 20)),
      }));
      consentCount++;
    }
  }

  // Add some withdrawn consents
  await consentRepo.save(consentRepo.create({
    guest_id: guests[7].id,
    property_id: property.id,
    consent_type: ConsentType.MARKETING_EMAIL,
    status: ConsentStatus.WITHDRAWN,
    purpose: 'Receiving promotional offers',
    ip_address: pick(ipAddresses),
    user_agent: pick(userAgents),
    granted_at: makeTimestamp(-90, 10),
    withdrawn_at: makeTimestamp(-30, 14),
  }));
  consentCount++;

  await consentRepo.save(consentRepo.create({
    guest_id: guests[12].id,
    property_id: property.id,
    consent_type: ConsentType.THIRD_PARTY_SHARING,
    status: ConsentStatus.WITHDRAWN,
    purpose: 'Sharing data with partner travel agencies',
    ip_address: pick(ipAddresses),
    user_agent: pick(userAgents),
    granted_at: makeTimestamp(-60, 9),
    withdrawn_at: makeTimestamp(-15, 16),
  }));
  consentCount++;
  console.log(`Created ${consentCount} guest consent records`);

  // ─── 19. DATA RETENTION SETTINGS ───
  await retentionRepo.save(retentionRepo.create({
    property_id: property.id,
    guest_data_retention_days: 365,
    booking_data_retention_days: 2555,
    payment_data_retention_days: 2555,
    auto_anonymize_expired: true,
    privacy_policy_url: 'https://seasideguesthouse.co.za/privacy-policy',
    data_officer_email: 'privacy@seasideguesthouse.co.za',
  }));
  console.log('Created data retention settings');

  // ─── 20. ALERT SETTINGS ───
  await alertSettingsRepo.save(alertSettingsRepo.create({
    property_id: property.id,
    enabled: true,
    low_occupancy_threshold: 30,
    low_occupancy_lookahead_days: 7,
    no_bookings_days: 14,
    high_cancellation_threshold: 20,
    revenue_drop_threshold: 15,
    email_alerts: true,
  }));
  console.log('Created alert settings');

  // ─── 21. SMART ALERTS ───
  const alertDefs = [
    {
      alert_type: AlertType.LOW_OCCUPANCY,
      severity: AlertSeverity.WARNING,
      status: AlertStatus.ACTIVE,
      title: 'Low occupancy next week',
      message: 'Occupancy for the next 7 days is at 25% (3 of 12 rooms booked). Consider running a last-minute promotion or adjusting rates.',
      suggested_action: 'Enable the "Last Minute Deal" pricing rule or create a flash sale on your direct booking page.',
      metadata: { occupancy_percent: 25, period_start: makeDate(1), period_end: makeDate(7), booked_rooms: 3, total_rooms: 12 },
    },
    {
      alert_type: AlertType.PRICING_SUGGESTION,
      severity: AlertSeverity.INFO,
      status: AlertStatus.ACTIVE,
      title: 'Weekend rates could be higher',
      message: 'Your weekend rates are 15% above weekday rates, but competitor analysis suggests the local market supports a 25% premium for Camps Bay properties this time of year.',
      suggested_action: 'Increase the Weekend Surcharge pricing rule from 15% to 25%.',
      metadata: { current_premium: 15, suggested_premium: 25, market_average: 22 },
    },
    {
      alert_type: AlertType.HIGH_CANCELLATION,
      severity: AlertSeverity.WARNING,
      status: AlertStatus.ACKNOWLEDGED,
      title: 'Cancellation rate above threshold',
      message: 'Your cancellation rate over the past 30 days is 22%, which exceeds the 20% threshold. 3 bookings were cancelled, mostly from OTA channels.',
      suggested_action: 'Review your cancellation policy. Consider requiring non-refundable deposits for OTA bookings.',
      metadata: { cancellation_rate: 22, threshold: 20, cancelled_count: 3, total_bookings: 14, period_days: 30 },
      acknowledged_at: makeTimestamp(-1, 9),
    },
    {
      alert_type: AlertType.REVENUE_DROP,
      severity: AlertSeverity.CRITICAL,
      status: AlertStatus.ACTIVE,
      title: 'Revenue down 18% vs last month',
      message: 'This month\'s revenue is R42,300 compared to R51,600 last month – an 18% decrease. The drop is mainly due to fewer Booking.com reservations and 2 cancellations.',
      suggested_action: 'Check your Booking.com listing ranking and consider increasing your rate markup to offset commission costs.',
      metadata: { current_revenue: 42300, previous_revenue: 51600, drop_percent: 18, currency: 'ZAR' },
    },
    {
      alert_type: AlertType.NO_BOOKINGS,
      severity: AlertSeverity.INFO,
      status: AlertStatus.DISMISSED,
      title: 'No new bookings in 5 days',
      message: 'No new bookings have been received in the last 5 days. This is unusual for this time of year.',
      suggested_action: 'Verify your channel connections are syncing correctly and check your listing visibility.',
      metadata: { days_without_booking: 5 },
    },
    {
      alert_type: AlertType.LOW_OCCUPANCY,
      severity: AlertSeverity.CRITICAL,
      status: AlertStatus.ACTIVE,
      title: 'Zero bookings for next Tuesday-Thursday',
      message: 'There are no bookings at all for Tuesday through Thursday next week. All 12 rooms are empty for 3 consecutive nights.',
      suggested_action: 'Consider a midweek special: offer 30% off for 2+ night stays. Push via WhatsApp to past guests.',
      metadata: { occupancy_percent: 0, period_start: makeDate(5), period_end: makeDate(8), booked_rooms: 0, total_rooms: 12 },
    },
  ];

  for (const a of alertDefs) {
    await alertRepo.save(alertRepo.create({
      property_id: property.id,
      alert_type: a.alert_type,
      severity: a.severity,
      status: a.status,
      title: a.title,
      message: a.message,
      suggested_action: a.suggested_action,
      metadata: a.metadata,
      acknowledged_at: a.acknowledged_at || undefined,
      created_at: a.status === AlertStatus.DISMISSED ? makeTimestamp(-3, 8) : makeTimestamp(-randomInt(0, 2), randomInt(6, 18)),
    }));
  }
  console.log(`Created ${alertDefs.length} smart alerts`);

  // ─── 22. FOLIO ITEMS ───
  let folioCount = 0;

  // Add folio items for checked-in bookings (active stays get charges)
  const checkedInIndices = bookingDefs
    .map((b, i) => ({ ...b, idx: i }))
    .filter(b => b.status === BookingStatus.CHECKED_IN);

  for (const ci of checkedInIndices) {
    const booking = allBookings[ci.idx];
    const room = rooms[ci.roomIdx];
    const nights = ci.checkOut - ci.checkIn;
    const nightlyRate = Number(booking.nightly_rate);

    // Room charge
    await folioRepo.save(folioRepo.create({
      booking_id: booking.id,
      property_id: property.id,
      category: FolioCategory.ROOM_CHARGE,
      description: `${room.name} – ${nights} night(s) @ R${nightlyRate}/night`,
      amount: nightlyRate,
      quantity: nights,
      total: nightlyRate * nights,
      is_credit: false,
      posted_by: 'System',
    }));
    folioCount++;

    // Deposit payment (credit)
    await folioRepo.save(folioRepo.create({
      booking_id: booking.id,
      property_id: property.id,
      category: FolioCategory.DEPOSIT,
      description: 'Deposit received',
      amount: nightlyRate * nights * 0.5,
      quantity: 1,
      total: nightlyRate * nights * 0.5,
      is_credit: true,
      posted_by: 'System',
    }));
    folioCount++;
  }

  // Extra charges for some checked-in guests
  const activeBooking1 = allBookings[13]; // Sarah Jones checked-in
  await folioRepo.save(folioRepo.create({
    booking_id: activeBooking1.id,
    property_id: property.id,
    category: FolioCategory.MINIBAR,
    description: '2x Craft beer, 1x Sauvignon Blanc (187ml)',
    amount: 65,
    quantity: 3,
    total: 195,
    is_credit: false,
    posted_by: staff1.first_name + ' ' + staff1.last_name,
    notes: 'Consumed evening of check-in',
  }));
  folioCount++;

  await folioRepo.save(folioRepo.create({
    booking_id: activeBooking1.id,
    property_id: property.id,
    category: FolioCategory.LAUNDRY,
    description: 'Express laundry service – 4 items',
    amount: 180,
    quantity: 1,
    total: 180,
    is_credit: false,
    posted_by: staff1.first_name + ' ' + staff1.last_name,
  }));
  folioCount++;

  const activeBooking2 = allBookings[15]; // Priya checked-in
  await folioRepo.save(folioRepo.create({
    booking_id: activeBooking2.id,
    property_id: property.id,
    category: FolioCategory.RESTAURANT,
    description: 'In-room dining – breakfast for 2',
    amount: 320,
    quantity: 1,
    total: 320,
    is_credit: false,
    posted_by: staff1.first_name + ' ' + staff1.last_name,
  }));
  folioCount++;

  await folioRepo.save(folioRepo.create({
    booking_id: activeBooking2.id,
    property_id: property.id,
    category: FolioCategory.PARKING,
    description: 'Secure parking – per night',
    amount: 100,
    quantity: 5,
    total: 500,
    is_credit: false,
    posted_by: 'System',
  }));
  folioCount++;

  const activeBooking3 = allBookings[16]; // David Botha checked-in
  await folioRepo.save(folioRepo.create({
    booking_id: activeBooking3.id,
    property_id: property.id,
    category: FolioCategory.MINIBAR,
    description: 'Champagne bottle (Moët & Chandon)',
    amount: 850,
    quantity: 1,
    total: 850,
    is_credit: false,
    posted_by: manager.first_name + ' ' + manager.last_name,
    notes: 'Anniversary celebration – ordered at check-in',
  }));
  folioCount++;

  await folioRepo.save(folioRepo.create({
    booking_id: activeBooking3.id,
    property_id: property.id,
    category: FolioCategory.LATE_CHECKOUT,
    description: 'Late checkout (until 14:00) – pre-approved',
    amount: 350,
    quantity: 1,
    total: 350,
    is_credit: false,
    posted_by: manager.first_name + ' ' + manager.last_name,
  }));
  folioCount++;

  // Add folio items for some checked-out bookings
  const checkedOutBooking = allBookings[6]; // David Botha past stay
  await folioRepo.save(folioRepo.create({
    booking_id: checkedOutBooking.id,
    property_id: property.id,
    category: FolioCategory.ROOM_CHARGE,
    description: `${rooms[2].name} – 4 night(s)`,
    amount: Number(checkedOutBooking.nightly_rate),
    quantity: 4,
    total: Number(checkedOutBooking.total_price),
    is_credit: false,
    posted_by: 'System',
  }));
  folioCount++;

  await folioRepo.save(folioRepo.create({
    booking_id: checkedOutBooking.id,
    property_id: property.id,
    category: FolioCategory.PAYMENT,
    description: 'Full payment received – EFT',
    amount: Number(checkedOutBooking.total_price),
    quantity: 1,
    total: Number(checkedOutBooking.total_price),
    is_credit: true,
    posted_by: 'System',
  }));
  folioCount++;

  console.log(`Created ${folioCount} folio items`);

  // ─── 23. HOUSEKEEPING TASKS ───
  const hkTasks: any[] = [];

  // Checkout cleans for recently checked-out rooms
  const checkoutRoomIndices = [0, 1, 3, 4, 6, 5, 9, 7, 8]; // rooms from checked-out bookings
  for (let i = 0; i < Math.min(checkoutRoomIndices.length, 5); i++) {
    const room = rooms[checkoutRoomIndices[i]];
    hkTasks.push({
      room_id: room.id,
      booking_id: allBookings[i].id,
      task_type: TaskType.CHECKOUT_CLEAN,
      status: i < 3 ? TaskStatus.COMPLETED : (i < 4 ? TaskStatus.IN_PROGRESS : TaskStatus.PENDING),
      priority: TaskPriority.HIGH,
      title: `Checkout clean – ${room.name}`,
      due_date: makeDate(-Math.max(0, 3 - i)),
      assigned_to: staff2.first_name + ' ' + staff2.last_name,
      completed_at: i < 3 ? makeTimestamp(-Math.max(0, 3 - i), 12) : undefined,
      notes: i === 0 ? 'Deep clean requested – guest had pet (with approval)' : null,
    });
  }

  // Check-in preps for upcoming arrivals
  const futureBookingIndices = bookingDefs
    .map((b, i) => ({ ...b, idx: i }))
    .filter(b => b.status === BookingStatus.CONFIRMED)
    .slice(0, 4);

  for (const fb of futureBookingIndices) {
    const room = rooms[fb.roomIdx];
    hkTasks.push({
      room_id: room.id,
      booking_id: allBookings[fb.idx].id,
      task_type: TaskType.CHECKIN_PREP,
      status: TaskStatus.PENDING,
      priority: TaskPriority.NORMAL,
      title: `Check-in prep – ${room.name}`,
      due_date: makeDate(fb.checkIn),
      assigned_to: staff2.first_name + ' ' + staff2.last_name,
      notes: fb.specialRequests ? `Guest request: ${fb.specialRequests}` : null,
    });
  }

  // Maintenance tasks
  hkTasks.push({
    room_id: rooms[rooms.length - 1].id, // Compact 2 – the maintenance room
    task_type: TaskType.MAINTENANCE,
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.URGENT,
    title: 'Bathroom renovation – Compact 2',
    due_date: makeDate(3),
    assigned_to: 'External Contractor',
    notes: 'Full bathroom renovation: new tiles, fixtures, and waterproofing. Room blocked from ' + makeDate(3) + ' to ' + makeDate(10),
    blocks_room: true,
    estimated_cost: 45000,
    vendor: 'Cape Renovations (Pty) Ltd',
    vendor_phone: '+27214567890',
  });

  hkTasks.push({
    room_id: rooms[2].id, // Protea Room
    task_type: TaskType.MAINTENANCE,
    status: TaskStatus.PENDING,
    priority: TaskPriority.NORMAL,
    title: 'Fix dripping tap – Protea Room',
    due_date: makeDate(2),
    assigned_to: staff2.first_name + ' ' + staff2.last_name,
    notes: 'Guest reported dripping hot water tap in bathroom. Washer likely needs replacing.',
    blocks_room: false,
    estimated_cost: 150,
  });

  hkTasks.push({
    room_id: rooms[0].id, // Ocean View 1
    task_type: TaskType.MAINTENANCE,
    status: TaskStatus.COMPLETED,
    priority: TaskPriority.HIGH,
    title: 'A/C repair – Ocean View 1',
    due_date: makeDate(-5),
    assigned_to: 'AirCon Pros',
    completed_at: makeTimestamp(-4, 16),
    notes: 'Compressor replaced. Unit fully operational.',
    blocks_room: false,
    estimated_cost: 3500,
    actual_cost: 4200,
    vendor: 'AirCon Pros Cape Town',
    vendor_phone: '+27219876543',
    resolution_notes: 'Compressor had failed. Replaced with new unit under partial warranty. R4200 total (R700 excess).',
  });

  // Inspections
  hkTasks.push({
    room_id: rooms[3].id, // Garden Suite 1
    task_type: TaskType.INSPECTION,
    status: TaskStatus.PENDING,
    priority: TaskPriority.LOW,
    title: 'Monthly inspection – Garden Suite 1',
    due_date: makeDate(5),
    assigned_to: manager.first_name + ' ' + manager.last_name,
    notes: 'Routine monthly check – furniture, fixtures, linens, mini bar inventory.',
  });

  hkTasks.push({
    room_id: rooms[7].id, // Family 1
    task_type: TaskType.INSPECTION,
    status: TaskStatus.COMPLETED,
    priority: TaskPriority.LOW,
    title: 'Safety inspection – Family 1',
    due_date: makeDate(-7),
    assigned_to: manager.first_name + ' ' + manager.last_name,
    completed_at: makeTimestamp(-7, 10),
    notes: 'Annual child safety inspection.',
    resolution_notes: 'All child-proofing in place. Outlet covers checked. Window locks functional. Play area equipment safe.',
  });

  // Custom task
  hkTasks.push({
    task_type: TaskType.CUSTOM,
    status: TaskStatus.PENDING,
    priority: TaskPriority.NORMAL,
    title: 'Restock poolside towels and sunscreen',
    due_date: makeDate(1),
    assigned_to: staff2.first_name + ' ' + staff2.last_name,
    notes: 'Running low on pool towels. Also restock SPF50 sunscreen dispenser by the pool.',
  });

  for (const task of hkTasks) {
    await hkTaskRepo.save(hkTaskRepo.create({
      property_id: property.id,
      room_id: task.room_id || null,
      booking_id: task.booking_id || null,
      task_type: task.task_type,
      status: task.status,
      priority: task.priority,
      title: task.title,
      due_date: task.due_date,
      assigned_to: task.assigned_to || null,
      completed_at: task.completed_at || null,
      notes: task.notes || null,
      blocks_room: task.blocks_room || false,
      estimated_cost: task.estimated_cost || null,
      actual_cost: task.actual_cost || null,
      vendor: task.vendor || null,
      vendor_phone: task.vendor_phone || null,
      resolution_notes: task.resolution_notes || null,
    }));
  }
  console.log(`Created ${hkTasks.length} housekeeping tasks`);

  // ─── 24. AUDIT LOG ───
  const auditActions = [
    { action: 'user.login', entity_type: 'User', user: owner, daysAgo: 0 },
    { action: 'user.login', entity_type: 'User', user: manager, daysAgo: 0 },
    { action: 'user.login', entity_type: 'User', user: staff1, daysAgo: 0 },
    { action: 'user.login', entity_type: 'User', user: owner, daysAgo: 1 },
    { action: 'user.login', entity_type: 'User', user: manager, daysAgo: 1 },
    { action: 'user.login', entity_type: 'User', user: staff1, daysAgo: 1 },
    { action: 'user.login', entity_type: 'User', user: owner, daysAgo: 2 },
    { action: 'booking.create', entity_type: 'Booking', user: staff1, daysAgo: 3, entityIdx: 19 },
    { action: 'booking.create', entity_type: 'Booking', user: manager, daysAgo: 2, entityIdx: 20 },
    { action: 'booking.create', entity_type: 'Booking', user: staff1, daysAgo: 2, entityIdx: 21 },
    { action: 'booking.update', entity_type: 'Booking', user: manager, daysAgo: 1, entityIdx: 13, oldValues: { status: 'CONFIRMED' }, newValues: { status: 'CHECKED_IN' } },
    { action: 'booking.update', entity_type: 'Booking', user: staff1, daysAgo: 1, entityIdx: 14, oldValues: { status: 'CONFIRMED' }, newValues: { status: 'CHECKED_IN' } },
    { action: 'booking.update', entity_type: 'Booking', user: staff1, daysAgo: 0, entityIdx: 15, oldValues: { status: 'CONFIRMED' }, newValues: { status: 'CHECKED_IN' } },
    { action: 'booking.update', entity_type: 'Booking', user: manager, daysAgo: 0, entityIdx: 16, oldValues: { status: 'CONFIRMED' }, newValues: { status: 'CHECKED_IN' } },
    { action: 'booking.cancel', entity_type: 'Booking', user: owner, daysAgo: 10, entityIdx: 35, oldValues: { status: 'CONFIRMED' }, newValues: { status: 'CANCELLED', cancellation_reason: 'Change of travel plans' } },
    { action: 'booking.cancel', entity_type: 'Booking', user: manager, daysAgo: 3, entityIdx: 36, oldValues: { status: 'CONFIRMED' }, newValues: { status: 'CANCELLED', cancellation_reason: 'Found alternative accommodation' } },
    { action: 'booking.cancel', entity_type: 'Booking', user: staff1, daysAgo: 5, entityIdx: 37, oldValues: { status: 'CONFIRMED' }, newValues: { status: 'CANCELLED', cancellation_reason: 'Flight cancelled due to weather' } },
    { action: 'booking.noshow', entity_type: 'Booking', user: staff1, daysAgo: 2, entityIdx: 38, oldValues: { status: 'CONFIRMED' }, newValues: { status: 'NO_SHOW' } },
    { action: 'payment.confirm_eft', entity_type: 'Payment', user: manager, daysAgo: 5 },
    { action: 'payment.confirm_eft', entity_type: 'Payment', user: manager, daysAgo: 3 },
    { action: 'payment.refund', entity_type: 'Payment', user: owner, daysAgo: 9 },
    { action: 'guest.create', entity_type: 'Guest', user: staff1, daysAgo: 10 },
    { action: 'guest.create', entity_type: 'Guest', user: staff1, daysAgo: 8 },
    { action: 'guest.create', entity_type: 'Guest', user: manager, daysAgo: 5 },
    { action: 'guest.update', entity_type: 'Guest', user: staff1, daysAgo: 3, oldValues: { notes: null }, newValues: { notes: 'VIP guest. Always requests flowers in room.' } },
    { action: 'room.update', entity_type: 'Room', user: owner, daysAgo: 7, oldValues: { is_active: true }, newValues: { is_active: false } },
    { action: 'room.update', entity_type: 'Room', user: owner, daysAgo: 5, oldValues: { is_active: false }, newValues: { is_active: true } },
    { action: 'availability.block', entity_type: 'RoomAvailability', user: owner, daysAgo: 4, newValues: { status: 'BLOCKED', blocked_reason: 'Owner personal use' } },
    { action: 'availability.maintenance', entity_type: 'RoomAvailability', user: manager, daysAgo: 6, newValues: { status: 'MAINTENANCE', blocked_reason: 'Bathroom renovation' } },
    { action: 'property.update', entity_type: 'Property', user: owner, daysAgo: 14, oldValues: { max_stay_nights: 14 }, newValues: { max_stay_nights: 21 } },
    { action: 'property.update', entity_type: 'Property', user: owner, daysAgo: 12, oldValues: { cancellation_policy: 'Free cancellation up to 24 hours.' }, newValues: { cancellation_policy: 'Free cancellation up to 48 hours before check-in.' } },
    { action: 'settings.update', entity_type: 'PaymentSettings', user: owner, daysAgo: 20, newValues: { payfast_enabled: true, eft_enabled: true } },
    { action: 'settings.update', entity_type: 'NotificationSettings', user: owner, daysAgo: 18, newValues: { whatsapp_booking_confirmation: true, whatsapp_owner_new_booking: true } },
    { action: 'rate_period.create', entity_type: 'RatePeriod', user: owner, daysAgo: 15, newValues: { name: 'Peak Season (Dec-Jan)', price_modifier: 1.40 } },
    { action: 'rate_period.create', entity_type: 'RatePeriod', user: owner, daysAgo: 15, newValues: { name: 'Low Season (Jul-Sep)', price_modifier: 0.80 } },
    { action: 'channel.create', entity_type: 'Channel', user: owner, daysAgo: 10, newValues: { type: 'airbnb', name: 'Airbnb - Seaside' } },
    { action: 'channel.create', entity_type: 'Channel', user: owner, daysAgo: 8, newValues: { type: 'booking_com', name: 'Booking.com - Main' } },
    { action: 'channel.sync', entity_type: 'Channel', user: manager, daysAgo: 1, newValues: { channel: 'Airbnb - Seaside', result: 'success', imported: 2 } },
    { action: 'channel.sync', entity_type: 'Channel', user: manager, daysAgo: 0, newValues: { channel: 'Booking.com - Main', result: 'success', imported: 3 } },
    { action: 'user.create', entity_type: 'User', user: owner, daysAgo: 30, newValues: { email: 'front.desk@propertyos.co.za', role: 'STAFF' } },
    { action: 'user.create', entity_type: 'User', user: owner, daysAgo: 30, newValues: { email: 'housekeeping@propertyos.co.za', role: 'STAFF' } },
    { action: 'booking.checkout', entity_type: 'Booking', user: staff1, daysAgo: 2, entityIdx: 9, oldValues: { status: 'CHECKED_IN' }, newValues: { status: 'CHECKED_OUT' } },
    { action: 'booking.checkout', entity_type: 'Booking', user: staff1, daysAgo: 1, entityIdx: 10, oldValues: { status: 'CHECKED_IN' }, newValues: { status: 'CHECKED_OUT' } },
    { action: 'booking.checkout', entity_type: 'Booking', user: manager, daysAgo: 5, entityIdx: 0, oldValues: { status: 'CHECKED_IN' }, newValues: { status: 'CHECKED_OUT' } },
  ];

  for (const a of auditActions) {
    await auditRepo.save(auditRepo.create({
      property_id: property.id,
      user_id: a.user.id,
      action: a.action,
      entity_type: a.entity_type,
      entity_id: (a as any).entityIdx !== undefined && allBookings[(a as any).entityIdx] ? allBookings[(a as any).entityIdx].id : undefined,
      old_values: (a as any).oldValues || null,
      new_values: (a as any).newValues || null,
      ip_address: pick(ipAddresses),
      user_agent: pick(userAgents),
      created_at: makeTimestamp(-a.daysAgo, randomInt(7, 20)),
    }));
  }
  console.log(`Created ${auditActions.length} audit log entries`);

  // ─── 25. RATE PLANS ───
  const ratePlanDefs = [
    // Deluxe Sea View Double
    {
      room_type_id: deluxeDouble.id,
      name: 'Flexible Rate',
      description: 'Best rate with free cancellation up to 48 hours before check-in.',
      price_modifier_percent: 0,
      cancellation_policy: CancellationPolicy.FLEXIBLE,
      free_cancellation_days: 2,
      includes_breakfast: false,
      includes_parking: false,
      includes_wifi: true,
      inclusions: [],
      sort_order: 1,
    },
    {
      room_type_id: deluxeDouble.id,
      name: 'Breakfast Included',
      description: 'Daily breakfast for 2 guests included. Free cancellation up to 3 days.',
      price_modifier_percent: 12,
      cancellation_policy: CancellationPolicy.MODERATE,
      free_cancellation_days: 3,
      includes_breakfast: true,
      includes_parking: false,
      includes_wifi: true,
      inclusions: ['Full breakfast for 2 daily', 'Coffee/tea facilities'],
      sort_order: 2,
    },
    {
      room_type_id: deluxeDouble.id,
      name: 'Non-Refundable Saver',
      description: 'Save 10% by paying upfront. No refunds on cancellation.',
      price_modifier_percent: -10,
      cancellation_policy: CancellationPolicy.NON_REFUNDABLE,
      free_cancellation_days: 0,
      includes_breakfast: false,
      includes_parking: false,
      includes_wifi: true,
      inclusions: [],
      sort_order: 3,
    },
    // Garden Suite
    {
      room_type_id: gardenSuite.id,
      name: 'Suite Flexible',
      description: 'Our best flexible rate for the Garden Suite – cancel up to 48 hours prior.',
      price_modifier_percent: 0,
      cancellation_policy: CancellationPolicy.FLEXIBLE,
      free_cancellation_days: 2,
      includes_breakfast: true,
      includes_parking: true,
      includes_wifi: true,
      inclusions: ['Full breakfast daily', 'One complimentary bottle of wine', 'Secure parking'],
      sort_order: 1,
    },
    {
      room_type_id: gardenSuite.id,
      name: 'Suite Romance Package',
      description: 'Romantic getaway rate: breakfast, wine, chocolates and late checkout included.',
      price_modifier_percent: 20,
      cancellation_policy: CancellationPolicy.MODERATE,
      free_cancellation_days: 5,
      includes_breakfast: true,
      includes_parking: true,
      includes_wifi: true,
      inclusions: [
        'Full breakfast daily',
        'Bottle of MCC on arrival',
        'Chocolates & fresh flowers',
        'Late checkout until 12:00',
        'Secure parking',
      ],
      sort_order: 2,
    },
    {
      room_type_id: gardenSuite.id,
      name: 'Suite Non-Refundable',
      description: 'Save 8% on the Garden Suite. No cancellation refund.',
      price_modifier_percent: -8,
      cancellation_policy: CancellationPolicy.NON_REFUNDABLE,
      free_cancellation_days: 0,
      includes_breakfast: true,
      includes_parking: false,
      includes_wifi: true,
      inclusions: ['Full breakfast daily'],
      sort_order: 3,
    },
    // Standard Double
    {
      room_type_id: standardDouble.id,
      name: 'Standard Flexible',
      description: 'Free cancellation up to 24 hours before check-in.',
      price_modifier_percent: 0,
      cancellation_policy: CancellationPolicy.FLEXIBLE,
      free_cancellation_days: 1,
      includes_breakfast: false,
      includes_parking: false,
      includes_wifi: true,
      inclusions: [],
      sort_order: 1,
    },
    {
      room_type_id: standardDouble.id,
      name: 'Bed & Breakfast',
      description: 'Standard Double with breakfast for 2 included.',
      price_modifier_percent: 15,
      cancellation_policy: CancellationPolicy.MODERATE,
      free_cancellation_days: 3,
      includes_breakfast: true,
      includes_parking: false,
      includes_wifi: true,
      inclusions: ['Continental breakfast for 2'],
      sort_order: 2,
    },
    // Family Room
    {
      room_type_id: familyRoom.id,
      name: 'Family Flexible',
      description: 'Family room with flexible cancellation up to 48 hours prior.',
      price_modifier_percent: 0,
      cancellation_policy: CancellationPolicy.FLEXIBLE,
      free_cancellation_days: 2,
      includes_breakfast: false,
      includes_parking: false,
      includes_wifi: true,
      inclusions: [],
      sort_order: 1,
    },
    {
      room_type_id: familyRoom.id,
      name: 'Family All-In',
      description: 'Breakfast for the whole family, parking and early check-in from 12:00.',
      price_modifier_percent: 18,
      cancellation_policy: CancellationPolicy.MODERATE,
      free_cancellation_days: 3,
      includes_breakfast: true,
      includes_parking: true,
      includes_wifi: true,
      inclusions: ['Breakfast for all guests', 'Secure parking', 'Early check-in from 12:00'],
      sort_order: 2,
    },
    // Standard Single
    {
      room_type_id: singleRoom.id,
      name: 'Standard Flexible',
      description: 'Compact room for solo travellers. Free cancellation up to 24 hours.',
      price_modifier_percent: 0,
      cancellation_policy: CancellationPolicy.FLEXIBLE,
      free_cancellation_days: 1,
      includes_breakfast: false,
      includes_parking: false,
      includes_wifi: true,
      inclusions: [],
      sort_order: 1,
    },
    {
      room_type_id: singleRoom.id,
      name: 'Business Saver',
      description: 'Non-refundable rate for business travellers. Save 12% – book in advance.',
      price_modifier_percent: -12,
      cancellation_policy: CancellationPolicy.NON_REFUNDABLE,
      free_cancellation_days: 0,
      includes_breakfast: false,
      includes_parking: false,
      includes_wifi: true,
      inclusions: ['High-speed WiFi priority access', 'Early check-in from 12:00 (subject to availability)'],
      sort_order: 2,
    },
  ];

  for (const rp of ratePlanDefs) {
    await ratePlanRepo.save(ratePlanRepo.create({
      property_id: property.id,
      room_type_id: rp.room_type_id,
      name: rp.name,
      description: rp.description,
      price_modifier_percent: rp.price_modifier_percent,
      cancellation_policy: rp.cancellation_policy,
      free_cancellation_days: rp.free_cancellation_days,
      includes_breakfast: rp.includes_breakfast,
      includes_parking: rp.includes_parking,
      includes_wifi: rp.includes_wifi,
      inclusions: rp.inclusions,
      is_active: true,
      sort_order: rp.sort_order,
    } as any));
  }
  console.log(`Created ${ratePlanDefs.length} rate plans`);

  // ─── 26. PROMO CODES ───
  const promoCodeDefs = [
    {
      code: 'WELCOME10',
      description: '10% off your first stay at Seaside Guesthouse',
      discount_type: DiscountType.PERCENTAGE,
      discount_value: 10,
      valid_from: makeDate(-60),
      valid_to: makeDate(90),
      usage_limit: 50,
      usage_count: 12,
      min_nights: 2,
      min_amount: null,
      is_active: true,
    },
    {
      code: 'SUMMER25',
      description: 'Summer special – R250 off stays of 3 or more nights',
      discount_type: DiscountType.FIXED,
      discount_value: 250,
      valid_from: makeDate(-30),
      valid_to: makeDate(60),
      usage_limit: 20,
      usage_count: 7,
      min_nights: 3,
      min_amount: null,
      is_active: true,
    },
    {
      code: 'LOYALTY15',
      description: '15% loyalty discount for returning guests',
      discount_type: DiscountType.PERCENTAGE,
      discount_value: 15,
      valid_from: makeDate(-90),
      valid_to: makeDate(180),
      usage_limit: null,
      usage_count: 8,
      min_nights: null,
      min_amount: null,
      is_active: true,
    },
    {
      code: 'HONEYMOON',
      description: 'R500 off honeymoon stays in the Garden Suite',
      discount_type: DiscountType.FIXED,
      discount_value: 500,
      valid_from: makeDate(-120),
      valid_to: makeDate(120),
      usage_limit: 10,
      usage_count: 3,
      min_nights: 3,
      min_amount: 7000,
      is_active: true,
    },
    {
      code: 'FLASH20',
      description: 'Flash sale – 20% off any room for this weekend only',
      discount_type: DiscountType.PERCENTAGE,
      discount_value: 20,
      valid_from: makeDate(-2),
      valid_to: makeDate(5),
      usage_limit: 8,
      usage_count: 5,
      min_nights: 1,
      min_amount: null,
      is_active: true,
    },
    {
      code: 'EARLYBIRD12',
      description: '12% off when you book 30+ days in advance',
      discount_type: DiscountType.PERCENTAGE,
      discount_value: 12,
      valid_from: makeDate(-180),
      valid_to: makeDate(365),
      usage_limit: 30,
      usage_count: 9,
      min_nights: 2,
      min_amount: null,
      is_active: true,
    },
    {
      code: 'EXPIRED50',
      description: 'Old Black Friday special (expired)',
      discount_type: DiscountType.FIXED,
      discount_value: 500,
      valid_from: makeDate(-90),
      valid_to: makeDate(-30),
      usage_limit: 20,
      usage_count: 17,
      min_nights: null,
      min_amount: null,
      is_active: false,
    },
    {
      code: 'MIDWEEK10',
      description: '10% off for midweek check-ins (Mon–Thu)',
      discount_type: DiscountType.PERCENTAGE,
      discount_value: 10,
      valid_from: makeDate(-14),
      valid_to: makeDate(90),
      usage_limit: null,
      usage_count: 4,
      min_nights: 2,
      min_amount: 2000,
      is_active: true,
    },
  ];

  for (const pc of promoCodeDefs) {
    await promoCodeRepo.save(promoCodeRepo.create({
      property_id: property.id,
      code: pc.code,
      description: pc.description,
      discount_type: pc.discount_type,
      discount_value: pc.discount_value,
      valid_from: pc.valid_from,
      valid_to: pc.valid_to,
      usage_limit: pc.usage_limit,
      usage_count: pc.usage_count,
      min_nights: pc.min_nights,
      min_amount: pc.min_amount,
      is_active: pc.is_active,
    } as any));
  }
  console.log(`Created ${promoCodeDefs.length} promo codes`);

  // ─── 27. PACKAGES ───
  const packageDefs = [
    {
      name: 'Continental Breakfast',
      description: 'Fresh continental breakfast served daily in our ocean-view dining room. Includes pastries, cold meats, cheeses, fruit, yoghurt, cereals, juices and hot beverages.',
      price: 180,
      pricing_type: PackagePricingType.PER_GUEST_PER_NIGHT,
      category: 'Dining',
      available_at_booking: true,
      available_at_checkin: true,
      sort_order: 1,
    },
    {
      name: 'Full English Breakfast',
      description: 'Hot cooked breakfast with eggs your way, bacon, sausage, mushrooms, grilled tomato and toast. Served in the dining room from 07:30–10:00.',
      price: 220,
      pricing_type: PackagePricingType.PER_GUEST_PER_NIGHT,
      category: 'Dining',
      available_at_booking: true,
      available_at_checkin: true,
      sort_order: 2,
    },
    {
      name: 'Welcome Bottle of Wine',
      description: 'A chilled bottle of Western Cape Sauvignon Blanc or Shiraz waiting in your room on arrival. Select your preference at check-in.',
      price: 320,
      pricing_type: PackagePricingType.FIXED,
      category: 'Beverages',
      available_at_booking: true,
      available_at_checkin: true,
      sort_order: 3,
    },
    {
      name: 'MCC Champagne on Arrival',
      description: 'Méthode Cap Classique bubbly chilled and ready in your room. Perfect for anniversaries, honeymoons and special occasions.',
      price: 580,
      pricing_type: PackagePricingType.FIXED,
      category: 'Beverages',
      available_at_booking: true,
      available_at_checkin: true,
      sort_order: 4,
    },
    {
      name: 'Romance Décor Package',
      description: 'Rose petals scattered across the bed, candles, fresh flowers and a personalised welcome card. Elevate your special occasion.',
      price: 750,
      pricing_type: PackagePricingType.FIXED,
      category: 'Special Occasions',
      available_at_booking: true,
      available_at_checkin: false,
      sort_order: 5,
    },
    {
      name: 'Airport Transfer (One-Way)',
      description: 'Private door-to-door transfer between Cape Town International Airport and Seaside Guesthouse. Includes meet-and-greet and luggage assistance.',
      price: 650,
      pricing_type: PackagePricingType.FIXED,
      category: 'Transport',
      available_at_booking: true,
      available_at_checkin: false,
      sort_order: 6,
    },
    {
      name: 'Secure Parking',
      description: 'Dedicated secure off-street parking in our gated garage. Available to reserve for your entire stay.',
      price: 100,
      pricing_type: PackagePricingType.PER_NIGHT,
      category: 'Transport',
      available_at_booking: true,
      available_at_checkin: true,
      sort_order: 7,
    },
    {
      name: 'Late Checkout (12:00)',
      description: 'Extend your morning and check out at 12:00 instead of the standard 10:00. Subject to availability; guaranteed when pre-booked.',
      price: 350,
      pricing_type: PackagePricingType.FIXED,
      category: 'Convenience',
      available_at_booking: true,
      available_at_checkin: true,
      sort_order: 8,
    },
    {
      name: 'Early Check-In (12:00)',
      description: 'Guaranteed early access to your room from 12:00. Great for long-haul arrivals.',
      price: 300,
      pricing_type: PackagePricingType.FIXED,
      category: 'Convenience',
      available_at_booking: true,
      available_at_checkin: false,
      sort_order: 9,
    },
    {
      name: 'Sunset Cocktail Hour',
      description: 'Private sundowner experience on the terrace: two signature cocktails, canapés and the famous Camps Bay Atlantic sunset.',
      price: 480,
      pricing_type: PackagePricingType.PER_GUEST,
      category: 'Experiences',
      available_at_booking: true,
      available_at_checkin: true,
      sort_order: 10,
    },
  ];

  const allPackages: Package[] = [];
  for (const pkg of packageDefs) {
    const saved = await packageRepo.save(packageRepo.create({
      property_id: property.id,
      name: pkg.name,
      description: pkg.description,
      price: pkg.price,
      pricing_type: pkg.pricing_type,
      category: pkg.category,
      is_active: true,
      available_at_booking: pkg.available_at_booking,
      available_at_checkin: pkg.available_at_checkin,
      sort_order: pkg.sort_order,
    } as any)) as unknown as Package;
    allPackages.push(saved);
  }
  console.log(`Created ${allPackages.length} packages`);

  // Attach some packages to checked-in and checked-out bookings
  const bookingPackageDefs = [
    // Sarah Jones checked-in – breakfast + wine
    { bookingIdx: 13, packageIdx: 0, quantity: 2, stage: 'BOOKING' },
    { bookingIdx: 13, packageIdx: 2, quantity: 1, stage: 'BOOKING' },
    // Priya checked-in – champagne + romance décor
    { bookingIdx: 15, packageIdx: 3, quantity: 1, stage: 'BOOKING' },
    { bookingIdx: 15, packageIdx: 4, quantity: 1, stage: 'BOOKING' },
    // David Botha checked-in – champagne + parking
    { bookingIdx: 16, packageIdx: 3, quantity: 1, stage: 'BOOKING' },
    { bookingIdx: 16, packageIdx: 6, quantity: 1, stage: 'BOOKING' },
    // Heinrich Visser checked-in – breakfast + parking
    { bookingIdx: 17, packageIdx: 0, quantity: 1, stage: 'BOOKING' },
    { bookingIdx: 17, packageIdx: 6, quantity: 1, stage: 'BOOKING' },
    // Some checked-out bookings – breakfast
    { bookingIdx: 0, packageIdx: 0, quantity: 2, stage: 'BOOKING' },
    { bookingIdx: 6, packageIdx: 0, quantity: 2, stage: 'BOOKING' },
    { bookingIdx: 6, packageIdx: 2, quantity: 1, stage: 'BOOKING' },
    // Late checkout added at check-in
    { bookingIdx: 16, packageIdx: 7, quantity: 1, stage: 'CHECKIN' },
  ];

  let bookingPkgCount = 0;
  for (const bpd of bookingPackageDefs) {
    const booking = allBookings[bpd.bookingIdx];
    const pkg = allPackages[bpd.packageIdx];
    if (!booking || !pkg) continue;
    const unitPrice = Number(pkg.price);
    await bookingPackageRepo.save(bookingPackageRepo.create({
      booking_id: booking.id,
      package_id: pkg.id,
      property_id: property.id,
      quantity: bpd.quantity,
      unit_price: unitPrice,
      total_price: unitPrice * bpd.quantity,
      added_at_stage: bpd.stage,
    } as any));
    bookingPkgCount++;
  }
  console.log(`Created ${bookingPkgCount} booking package attachments`);

  // ─── 28. REVIEWS ───
  const reviewDefs = [
    {
      bookingIdx: 0, guestIdx: 0,
      overall: 5, cleanliness: 5, comfort: 5, location: 5, value: 4, service: 5,
      comment: 'Absolutely stunning guesthouse! The sea views from our balcony were breathtaking. Staff were warm and professional – Pieter at the front desk went out of his way to arrange a surprise anniversary setup. Will definitely be back!',
      ownerResponse: "Thank you so much Sarah, it was our absolute pleasure hosting you. We'll pass your kind words on to Pieter! We look forward to welcoming you back for your next anniversary.",
      status: ReviewStatus.PUBLISHED,
      daysAgo: 24,
    },
    {
      bookingIdx: 1, guestIdx: 1,
      overall: 4, cleanliness: 5, comfort: 4, location: 5, value: 4, service: 4,
      comment: 'Great location in the heart of Camps Bay. Room was spotlessly clean and comfortable. Breakfast was excellent. Only minor note – the WiFi in our room was a bit slow late at night.',
      ownerResponse: 'Thank you Mike! We\'ve since upgraded our WiFi router on the first floor. Hope to host you again soon!',
      status: ReviewStatus.PUBLISHED,
      daysAgo: 20,
    },
    {
      bookingIdx: 2, guestIdx: 3,
      overall: 5, cleanliness: 5, comfort: 5, location: 5, value: 5, service: 5,
      comment: 'Exceptional experience from start to finish. We needed an airport transfer at 04:30 and the team arranged it without a fuss. The Family Room was spacious and perfect for our group. Highly recommend Seaside Guesthouse.',
      ownerResponse: null,
      status: ReviewStatus.PUBLISHED,
      daysAgo: 13,
    },
    {
      bookingIdx: 3, guestIdx: 4,
      overall: 4, cleanliness: 4, comfort: 4, location: 5, value: 3, service: 4,
      comment: 'Beautiful location on the Atlantic Seaboard. Very comfortable stay overall. Slightly pricey compared to similar options but the location makes it worthwhile. Would stay again.',
      ownerResponse: null,
      status: ReviewStatus.PUBLISHED,
      daysAgo: 10,
    },
    {
      bookingIdx: 4, guestIdx: 6,
      overall: 5, cleanliness: 5, comfort: 5, location: 5, value: 5, service: 5,
      comment: 'We stay here every few months and it never disappoints. The team knows us by name and always has fresh flowers in the room without us even asking. Finest guesthouse in Cape Town.',
      ownerResponse: 'Priya, you truly make our day every time! We look forward to welcoming you back. The flowers will be ready! 🌸',
      status: ReviewStatus.PUBLISHED,
      daysAgo: 12,
    },
    {
      bookingIdx: 5, guestIdx: 7,
      overall: 4, cleanliness: 5, comfort: 4, location: 5, value: 4, service: 4,
      comment: 'Wonderful boutique guesthouse in a prime location. The standard single room was compact but smartly designed. Staff were helpful with local restaurant recommendations. Great stay!',
      ownerResponse: null,
      status: ReviewStatus.PUBLISHED,
      daysAgo: 9,
    },
    {
      bookingIdx: 6, guestIdx: 10,
      overall: 5, cleanliness: 5, comfort: 5, location: 5, value: 5, service: 5,
      comment: 'My wife and I have been coming here for our anniversary every year for 5 years. The team arranged champagne, flowers and a cake – they truly treat you like family. The Garden Suite is magnificent. See you next year!',
      ownerResponse: 'David and Anna, thank you for your incredible loyalty! It is always such a privilege to be part of your anniversary tradition. We can\'t wait to have you back!',
      status: ReviewStatus.PUBLISHED,
      daysAgo: 5,
    },
    {
      bookingIdx: 7, guestIdx: 12,
      overall: 3, cleanliness: 4, comfort: 3, location: 4, value: 3, service: 3,
      comment: 'Good location but the room we were given was a bit dated compared to what was advertised. Air conditioning was noisy on the first night. Staff were polite and sorted the A/C issue quickly though.',
      ownerResponse: 'Thank you for the honest feedback Robert. We apologise for the A/C inconvenience – we\'ve since replaced the unit in that room. We hope you\'ll give us another chance to impress you.',
      status: ReviewStatus.PUBLISHED,
      daysAgo: 3,
    },
    {
      bookingIdx: 8, guestIdx: 14,
      overall: 5, cleanliness: 5, comfort: 5, location: 5, value: 5, service: 5,
      comment: 'What a gem! Found Seaside Guesthouse via Google and booked last minute. Far exceeded expectations. The sunset views from the pool area are simply magical. Already booked to return next month.',
      ownerResponse: null,
      status: ReviewStatus.PUBLISHED,
      daysAgo: 2,
    },
    {
      bookingIdx: 9, guestIdx: 9,
      overall: 4, cleanliness: 4, comfort: 5, location: 5, value: 4, service: 5,
      comment: 'Very comfortable stay. The staff were extremely attentive to our dietary requirements (halal breakfast) without any fuss. Room was immaculate. The pool and terrace area is lovely.',
      ownerResponse: null,
      status: ReviewStatus.PUBLISHED,
      daysAgo: 1,
    },
    // Pending review (just submitted, not yet published)
    {
      bookingIdx: 10, guestIdx: 17,
      overall: 5, cleanliness: 5, comfort: 5, location: 5, value: 5, service: 5,
      comment: 'My monthly base in Cape Town. The team knows exactly what I need – strong WiFi, quiet desk and strong coffee. Consistent excellence every single visit.',
      ownerResponse: null,
      status: ReviewStatus.PENDING,
      daysAgo: 0,
    },
  ];

  let reviewCount = 0;
  for (const rd of reviewDefs) {
    const booking = allBookings[rd.bookingIdx];
    const guest = guests[rd.guestIdx];
    if (!booking || !guest) continue;
    await reviewRepo.save(reviewRepo.create({
      property_id: property.id,
      booking_id: booking.id,
      guest_id: guest.id,
      overall_rating: rd.overall,
      cleanliness_rating: rd.cleanliness,
      comfort_rating: rd.comfort,
      location_rating: rd.location,
      value_rating: rd.value,
      service_rating: rd.service,
      comment: rd.comment,
      owner_response: rd.ownerResponse || null,
      responded_at: rd.ownerResponse ? makeTimestamp(-(rd.daysAgo - 1), 14) : null,
      status: rd.status,
      created_at: makeTimestamp(-rd.daysAgo, randomInt(18, 22)),
    } as any));
    reviewCount++;
  }
  console.log(`Created ${reviewCount} reviews`);

  // ─── 29. TOURISM LEVY ───
  await levySettingsRepo.save(levySettingsRepo.create({
    property_id: property.id,
    enabled: true,
    levy_type: LevyType.PER_NIGHT,
    levy_amount: 35,
    levy_percent: 0,
    levy_name: 'Tourism Levy',
    exempt_children_under: 12,
    include_in_total: false,
  } as any));
  console.log('Created tourism levy settings');

  // Generate levy records for checked-out bookings
  const checkedOutForLevy = bookingDefs
    .map((b, i) => ({ ...b, idx: i }))
    .filter(b => b.status === BookingStatus.CHECKED_OUT);

  let levyRecordCount = 0;
  for (const bd of checkedOutForLevy) {
    const booking = allBookings[bd.idx];
    const guest = guests[bd.guestIdx];
    const nights = bd.checkOut - bd.checkIn;
    const rate = 35;
    const totalLevy = rate * nights;
    await levyRecordRepo.save(levyRecordRepo.create({
      property_id: property.id,
      booking_id: booking.id,
      guest_id: guest.id,
      levy_name: 'Tourism Levy',
      levy_type: LevyType.PER_NIGHT,
      nights,
      guest_count: bd.guestCount,
      rate,
      total_levy: totalLevy,
      check_in: makeDate(bd.checkIn),
      check_out: makeDate(bd.checkOut),
    } as any));
    levyRecordCount++;
  }
  console.log(`Created ${levyRecordCount} tourism levy records`);

  // ─── 30. ACCOUNTING ───
  const xeroConn = (await accountingConnRepo.save(accountingConnRepo.create({
    property_id: property.id,
    provider_type: AccountingProviderType.XERO,
    tenant_id: 'xero-tenant-abc123',
    access_token_encrypted: 'enc_xero_token_placeholder_seaside_guesthouse',
    refresh_token_encrypted: 'enc_xero_refresh_placeholder',
    token_expires_at: makeTimestamp(1, 0),
    status: AccountingConnectionStatus.ACTIVE,
    last_sync_at: makeTimestamp(-1, 8),
    organisation_name: 'Seaside Guesthouse (Pty) Ltd',
    settings: {
      default_revenue_account_code: '200',
      default_tax_type: 'OUTPUT2',
      auto_sync_enabled: true,
      sync_invoices: true,
      sync_payments: true,
      sync_credit_notes: true,
    },
  } as any))) as unknown as AccountingConnection;

  await accountingConnRepo.save(accountingConnRepo.create({
    property_id: property.id,
    provider_type: AccountingProviderType.SAGE,
    tenant_id: null,
    status: AccountingConnectionStatus.DISCONNECTED,
    last_sync_at: makeTimestamp(-45, 10),
    last_error: 'Refresh token expired. Please reconnect your Sage account.',
    organisation_name: 'Seaside Guesthouse (Pty) Ltd',
    settings: {
      auto_sync_enabled: false,
      sync_invoices: true,
      sync_payments: false,
      sync_credit_notes: false,
    },
  } as any));
  console.log('Created 2 accounting connections (Xero active, Sage disconnected)');

  // Create accounting mappings for synced invoices (Xero)
  let accountingMappingCount = 0;
  for (let i = 0; i < Math.min(allInvoices.length, 8); i++) {
    const inv = allInvoices[i];
    const bDef = bookingDefs[i];
    const guest = guests[bDef.guestIdx];

    await accountingMappingRepo.save(accountingMappingRepo.create({
      connection_id: xeroConn.id,
      entity_type: AccountingEntityType.INVOICE,
      internal_id: inv.id,
      provider_ref: `INV-XERO-${String(1000 + i)}`,
      sync_status: AccountingSyncStatus.SYNCED,
      last_synced_at: makeTimestamp(-1, 8),
    } as any));
    accountingMappingCount++;

    // Contact mapping for the guest
    await accountingMappingRepo.save(accountingMappingRepo.create({
      connection_id: xeroConn.id,
      entity_type: AccountingEntityType.CONTACT,
      internal_id: guest.id,
      provider_ref: `CONT-XERO-${String(2000 + bDef.guestIdx)}`,
      sync_status: AccountingSyncStatus.SYNCED,
      last_synced_at: makeTimestamp(-1, 8),
    } as any));
    accountingMappingCount++;
  }

  // One failed mapping
  if (allInvoices.length > 8) {
    await accountingMappingRepo.save(accountingMappingRepo.create({
      connection_id: xeroConn.id,
      entity_type: AccountingEntityType.INVOICE,
      internal_id: allInvoices[8].id,
      provider_ref: 'XERO-SYNC-FAILED',
      sync_status: AccountingSyncStatus.FAILED,
      last_error: 'Xero API error 422: Account code "200" not found in chart of accounts',
      last_synced_at: makeTimestamp(-1, 9),
    } as any));
    accountingMappingCount++;
  }
  console.log(`Created ${accountingMappingCount} accounting mappings`);

  // ─── 31. HISTORICAL DATA FOR REPORTS ───
  // 18 months of past bookings + payments + availability so year-over-year,
  // occupancy, revenue, KPI, tax, and tourism-levy monthly reports all have data.

  const histToday = new Date();
  histToday.setHours(0, 0, 0, 0);

  // Past availability records – 550 days back (~18 months) for all rooms
  const histStartDate = new Date(histToday);
  histStartDate.setDate(histStartDate.getDate() - 550);

  const histAvailBatch: Partial<RoomAvailability>[] = [];
  for (const room of rooms) {
    const d = new Date(histStartDate);
    while (d < histToday) {
      histAvailBatch.push({
        room_id: room.id,
        date: d.toISOString().slice(0, 10),
        status: AvailabilityStatus.AVAILABLE,
      });
      d.setDate(d.getDate() + 1);
    }
  }
  const AVAIL_CHUNK = 500;
  for (let i = 0; i < histAvailBatch.length; i += AVAIL_CHUNK) {
    await availRepo.save(histAvailBatch.slice(i, i + AVAIL_CHUNK) as RoomAvailability[]);
  }
  console.log(`Created ${histAvailBatch.length} historical availability records`);

  // 3 bookings per month × 18 months = 54 historical CHECKED_OUT bookings
  const histGuestCycle = [0, 1, 3, 4, 6, 7, 10, 11, 12, 14, 17, 18, 20, 21, 23, 24];
  const histRoomCycle  = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const histNights     = [3, 4, 2, 3, 4, 2, 3, 2, 4, 3];
  const histSources    = [
    BookingSource.DIRECT, BookingSource.BOOKING_COM, BookingSource.AIRBNB,
    BookingSource.PHONE, BookingSource.EXPEDIA, BookingSource.DIRECT,
  ];
  let histBookingCount = 0;
  let histPaymentCount = 0;
  let histLevyCount    = 0;
  let histRIdx = 0;
  let histGIdx = 0;

  for (let monthsBack = 18; monthsBack >= 1; monthsBack--) {
    for (const dayOfMonth of [5, 13, 21]) {
      const checkInDate = new Date(histToday);
      checkInDate.setDate(dayOfMonth);
      checkInDate.setMonth(checkInDate.getMonth() - monthsBack);
      checkInDate.setHours(0, 0, 0, 0);
      if (checkInDate >= histToday) continue;

      const nights = histNights[(monthsBack * 3 + dayOfMonth) % histNights.length];
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkInDate.getDate() + nights);
      if (checkOutDate > histToday) continue;

      const room  = rooms[histRoomCycle[histRIdx % histRoomCycle.length]];
      const guest = guests[histGuestCycle[histGIdx % histGuestCycle.length]];
      const rt    = roomTypes.find(r => r.id === room.room_type_id);
      const rate  = Number(rt?.base_price || 1500);
      const total = rate * nights;
      const src   = histSources[(monthsBack + dayOfMonth) % histSources.length];
      histRIdx++;
      histGIdx++;

      const ciStr = checkInDate.toISOString().slice(0, 10);
      const coStr = checkOutDate.toISOString().slice(0, 10);

      const hb = await bookingRepo.save({
        property_id: property.id,
        room_id: room.id,
        guest_id: guest.id,
        reference_number: `POS-${checkInDate.getFullYear()}-${String(refNum++).padStart(4, '0')}`,
        check_in: ciStr,
        check_out: coStr,
        nights,
        total_price: total,
        nightly_rate: rate,
        currency: 'ZAR',
        status: BookingStatus.CHECKED_OUT,
        source: src,
        guest_count: randomInt(1, 2),
      } as any) as Booking;
      histBookingCount++;

      // Mark availability BOOKED
      await availRepo.createQueryBuilder().update()
        .set({ status: AvailabilityStatus.BOOKED, booking_id: hb.id })
        .where('room_id = :rid AND date >= :ci AND date < :co', { rid: room.id, ci: ciStr, co: coStr })
        .execute();

      // Deposit: paid 3 days before check-in
      const depositDate = new Date(checkInDate);
      depositDate.setDate(depositDate.getDate() - 3);
      await paymentRepo.save(paymentRepo.create({
        booking_id: hb.id,
        property_id: property.id,
        amount: Math.round(total * 0.5 * 100) / 100,
        currency: 'ZAR',
        payment_type: 'DEPOSIT' as any,
        status: 'COMPLETED' as any,
        provider: pick(['PAYFAST', 'EFT', 'CARD_MANUAL']),
        provider_ref: `PF-H-${Date.now()}-${randomInt(1000, 9999)}`,
        paid_at: depositDate,
      } as any));

      // Balance: paid at check-in
      await paymentRepo.save(paymentRepo.create({
        booking_id: hb.id,
        property_id: property.id,
        amount: Math.round(total * 0.5 * 100) / 100,
        currency: 'ZAR',
        payment_type: 'BALANCE' as any,
        status: 'COMPLETED' as any,
        provider: pick(['PAYFAST', 'EFT', 'CASH']),
        provider_ref: `PF-H-${Date.now()}-${randomInt(1000, 9999)}`,
        paid_at: checkInDate,
      } as any));
      histPaymentCount += 2;

      // Invoice
      const subtotalH = +(total / 1.15).toFixed(2);
      await invoiceRepo.save(invoiceRepo.create({
        invoice_number: `INV-${checkInDate.getFullYear()}-${String(refNum).padStart(4, '0')}`,
        booking_id: hb.id,
        property_id: property.id,
        invoice_type: InvoiceType.TAX_INVOICE,
        status: InvoiceStatus.PAID,
        issue_date: ciStr,
        due_date: ciStr,
        subtotal: subtotalH,
        vat_rate: 15,
        vat_amount: +(total - subtotalH).toFixed(2),
        total,
        currency: 'ZAR',
        amount_paid: total,
        line_items: [{ description: `Accommodation – ${room.name} (${nights} nights)`, quantity: nights, unit_price: rate, total }],
        guest_details: { name: `${guest.first_name} ${guest.last_name}`, email: guest.email },
        property_details: { name: 'Seaside Guesthouse', address: '42 Ocean View Drive, Camps Bay', email: 'info@seasideguesthouse.co.za', vat_number: '4123456789' },
        notes: 'Paid in full.',
      } as any));

      // Tourism levy record
      await levyRecordRepo.save(levyRecordRepo.create({
        property_id: property.id,
        booking_id: hb.id,
        guest_id: guest.id,
        levy_name: 'Tourism Levy',
        levy_type: LevyType.PER_NIGHT,
        nights,
        guest_count: randomInt(1, 2),
        rate: 35,
        total_levy: 35 * nights,
        check_in: ciStr,
        check_out: coStr,
      } as any));
      histLevyCount++;
    }
  }
  console.log(`Created ${histBookingCount} historical bookings | ${histPaymentCount} payments | ${histLevyCount} levy records`);

  // ─── SUMMARY ───
  console.log('\n════════════════════════════════════════');
  console.log('  SEED COMPLETE');
  console.log('════════════════════════════════════════');
  console.log(`  Users:                 4`);
  console.log(`  Properties:            1`);
  console.log(`  Property-User links:   4`);
  console.log(`  Room Types:            5`);
  console.log(`  Rooms:                 ${rooms.length}`);
  console.log(`  Room Amenities:        ${totalAmenities}`);
  console.log(`  Rate Periods:          7`);
  console.log(`  Availability records:  ${rooms.length * 90}`);
  console.log(`  Guests:                ${guests.length}`);
  console.log(`  Bookings:              ${allBookings.length}`);
  console.log(`  Payments:              ${paymentDefs.length}`);
  console.log(`  Invoices:              ${allInvoices.length}`);
  console.log(`  Refunds:               ${refundCount}`);
  console.log(`  Pricing Rules:         ${pricingRules.length}`);
  console.log(`  Folio Items:           ${folioCount}`);
  console.log(`  Housekeeping Tasks:    ${hkTasks.length}`);
  console.log(`  Guest Consents:        ${consentCount}`);
  console.log(`  Data Retention:        1`);
  console.log(`  Smart Alerts:          ${alertDefs.length}`);
  console.log(`  Alert Settings:        1`);
  console.log(`  Notifications:         ${notifCount}`);
  console.log(`  Notification Settings: 1 (with automation config)`);
  console.log(`  Payment Settings:      1`);
  console.log(`  Channels:              4 (Airbnb, Booking.com, Expedia, iCal)`);
  console.log(`  Channel Mappings:      ${mappings.length}`);
  console.log(`  Sync Logs:             ${syncLogData.length}`);
  console.log(`  Audit Log entries:     ${auditActions.length}`);
  console.log(`  Rate Plans:            ${ratePlanDefs.length}`);
  console.log(`  Promo Codes:           ${promoCodeDefs.length}`);
  console.log(`  Packages:              ${allPackages.length}`);
  console.log(`  Booking Packages:      ${bookingPkgCount}`);
  console.log(`  Reviews:               ${reviewCount}`);
  console.log(`  Tourism Levy Settings: 1`);
  console.log(`  Tourism Levy Records:  ${levyRecordCount}`);
  console.log(`  Accounting Connections:2 (Xero, Sage)`);
  console.log(`  Accounting Mappings:   ${accountingMappingCount}`);
  console.log(`  Hist. Bookings:        ${histBookingCount} (18 months × 3/month)`);
  console.log(`  Hist. Payments:        ${histPaymentCount}`);
  console.log(`  Hist. Levy Records:    ${histLevyCount}`);
  console.log(`  Hist. Availability:    ${histAvailBatch.length} (all rooms × ~550 days)`);
  console.log(`  Photo URLs (Pexels):   ${propertyPhotos.length + Object.values(roomTypePhotos).flat().length}`);
  console.log('════════════════════════════════════════');
  console.log('  Login: demo@propertyos.co.za / Demo1234!');
  console.log('  Other users also use: Demo1234!');
  console.log('════════════════════════════════════════\n');

  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
