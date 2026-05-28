import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { User, UserRole } from './modules/users/entities/user.entity';
import { Property } from './modules/properties/entities/property.entity';
import { PropertyUser, PropertyUserRole } from './modules/properties/entities/property-user.entity';
import { RoomType } from './modules/inventory/entities/room-type.entity';
import { Room } from './modules/inventory/entities/room.entity';
import { RoomAvailability, AvailabilityStatus } from './modules/inventory/entities/room-availability.entity';
import { RoomAmenity } from './modules/inventory/entities/room-amenity.entity';
import { RatePeriod } from './modules/inventory/entities/rate-period.entity';
import { Guest } from './modules/bookings/entities/guest.entity';
import { Booking, BookingStatus, BookingSource } from './modules/bookings/entities/booking.entity';
import { Payment } from './modules/payments/entities/payment.entity';
import { PaymentSettings } from './modules/payments/entities/payment-settings.entity';
import { Notification } from './modules/notifications/entities/notification.entity';
import { NotificationSettings } from './modules/notifications/entities/notification-settings.entity';
import { AuditLog } from './modules/audit/entities/audit-log.entity';
import { Channel, ChannelType, ChannelStatus } from './modules/channels/entities/channel.entity';
import { ChannelMapping } from './modules/channels/entities/channel-mapping.entity';
import { SyncLog, SyncDirection, SyncStatus } from './modules/channels/entities/sync-log.entity';

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
    RoomAvailability, RatePeriod, Guest, Booking, Payment,
    PaymentSettings, Notification, NotificationSettings, AuditLog,
    Channel, ChannelMapping, SyncLog,
  ],
  synchronize: true,
});

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

function createPlaceholderImage(uploadsDir: string, filename: string): void {
  const filePath = join(uploadsDir, filename);
  if (!existsSync(filePath)) {
    // 1x1 white JPEG (smallest valid JPEG)
    const jpeg = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
      0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
      0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
      0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
      0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
      0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
      0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
      0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
      0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
      0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
      0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
      0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
      0x00, 0x00, 0x3F, 0x00, 0x7B, 0x94, 0x11, 0x00, 0x00, 0x00, 0x00, 0xFF,
      0xD9,
    ]);
    writeFileSync(filePath, jpeg);
  }
}

async function seed() {
  await ds.initialize();
  console.log('Connected to database');

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

  const existingUsers = await userRepo.count();
  if (existingUsers > 0) {
    console.log('Database already has data, skipping seed');
    await ds.destroy();
    return;
  }

  // ─── 0. UPLOADS DIRECTORY + PLACEHOLDER IMAGES ───
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  const propertyPhotos = [
    'property-exterior-front.jpg',
    'property-pool-area.jpg',
    'property-garden.jpg',
    'property-lounge.jpg',
    'property-breakfast-area.jpg',
  ];
  const roomTypePhotos: Record<string, string[]> = {
    deluxe: ['deluxe-seaview-1.jpg', 'deluxe-seaview-2.jpg', 'deluxe-bathroom.jpg'],
    suite: ['garden-suite-1.jpg', 'garden-suite-2.jpg', 'garden-suite-kitchen.jpg', 'garden-suite-lounge.jpg'],
    standard: ['standard-room-1.jpg', 'standard-bathroom.jpg'],
    family: ['family-room-1.jpg', 'family-room-2.jpg', 'family-play-area.jpg'],
    single: ['single-room-1.jpg'],
  };

  const allPhotoFiles = [
    ...propertyPhotos,
    ...Object.values(roomTypePhotos).flat(),
  ];
  for (const file of allPhotoFiles) {
    createPlaceholderImage(uploadsDir, file);
  }
  console.log(`Created ${allPhotoFiles.length} placeholder images in uploads/`);

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
    photos: propertyPhotos,
  }));

  await puRepo.save([
    puRepo.create({ property_id: property.id, user_id: owner.id, role: PropertyUserRole.OWNER, is_active: true }),
    puRepo.create({ property_id: property.id, user_id: manager.id, role: PropertyUserRole.MANAGER, is_active: true }),
    puRepo.create({ property_id: property.id, user_id: staff1.id, role: PropertyUserRole.STAFF, is_active: true }),
    puRepo.create({ property_id: property.id, user_id: staff2.id, role: PropertyUserRole.STAFF, is_active: true }),
  ]);
  console.log('Created property with 4 linked users + photos');

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

  // ─── 15. AUDIT LOG ───
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

  const ipAddresses = ['41.13.24.102', '105.224.56.78', '196.25.180.44', '102.68.34.12', '41.185.20.200'];
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
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
  console.log(`  Notifications:         ${notifCount}`);
  console.log(`  Notification Settings: 1 (with automation config)`);
  console.log(`  Payment Settings:      1`);
  console.log(`  Channels:              4 (Airbnb, Booking.com, Expedia, iCal)`);
  console.log(`  Channel Mappings:      ${mappings.length}`);
  console.log(`  Sync Logs:             ${syncLogData.length}`);
  console.log(`  Audit Log entries:     ${auditActions.length}`);
  console.log(`  Upload placeholders:   ${allPhotoFiles.length}`);
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
