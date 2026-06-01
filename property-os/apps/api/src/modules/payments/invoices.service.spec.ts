import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoicesService } from './invoices.service';
import { Invoice, InvoiceStatus, InvoiceType } from './entities/invoice.entity';
import { Payment, PaymentStatus, PaymentType } from './entities/payment.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Property } from '../properties/entities/property.entity';
import { PAYMENT_EVENTS } from './events/payment.events';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ id: 'inv-1', ...data })),
  count: jest.fn().mockResolvedValue(0),
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  })),
});

const mockEventEmitter = { emit: jest.fn() };
const mockDataSource = {};

const mockBooking = {
  id: 'booking-1',
  property_id: 'prop-1',
  reference_number: 'POS-2026-0001',
  nights: 3,
  nightly_rate: 1000,
  total_price: 3000,
  currency: 'ZAR',
  balance_due_date: '2026-05-28',
  check_in: '2026-06-01',
  guest: { first_name: 'John', last_name: 'Doe', email: 'john@test.com', phone: '+2782123' },
  room: { name: 'Room 1' },
};

const mockProperty = {
  id: 'prop-1',
  name: 'Seaside Lodge',
  address_line1: '10 Beach Road',
  city: 'Cape Town',
  province: 'Western Cape',
  postal_code: '8000',
  email: 'info@seaside.co.za',
  phone: '+2721123',
};

describe('InvoicesService', () => {
  let service: InvoicesService;
  let invoicesRepo: ReturnType<typeof mockRepo>;
  let paymentsRepo: ReturnType<typeof mockRepo>;
  let bookingsRepo: ReturnType<typeof mockRepo>;
  let propertiesRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    invoicesRepo = mockRepo();
    paymentsRepo = mockRepo();
    bookingsRepo = mockRepo();
    propertiesRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: getRepositoryToken(Invoice), useValue: invoicesRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingsRepo },
        { provide: getRepositoryToken(Property), useValue: propertiesRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    jest.clearAllMocks();
  });

  describe('generateInvoice', () => {
    it('should generate a tax invoice with VAT', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      propertiesRepo.findOne.mockResolvedValue(mockProperty);
      paymentsRepo.find.mockResolvedValue([]);
      invoicesRepo.count.mockResolvedValue(0);

      const result = await service.generateInvoice('prop-1', 'booking-1');

      expect(result.invoice_number).toBe('INV-2026-0001');
      expect(result.invoice_type).toBe(InvoiceType.TAX_INVOICE);
      expect(result.subtotal).toBe(3000);
      expect(result.vat_rate).toBe(15);
      expect(result.vat_amount).toBeCloseTo(391.30, 1);
      expect(result.total).toBe(3000);
      expect(result.status).toBe(InvoiceStatus.ISSUED);
      expect(result.guest_details.name).toBe('John Doe');
      expect(result.property_details.name).toBe('Seaside Lodge');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        PAYMENT_EVENTS.INVOICE_GENERATED,
        expect.anything(),
      );
    });

    it('should mark as PAID when full payment exists', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      propertiesRepo.findOne.mockResolvedValue(mockProperty);
      paymentsRepo.find.mockResolvedValue([
        { amount: 3000, status: PaymentStatus.COMPLETED, payment_type: PaymentType.FULL },
      ]);
      invoicesRepo.count.mockResolvedValue(0);

      const result = await service.generateInvoice('prop-1', 'booking-1');

      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(result.amount_paid).toBe(3000);
    });

    it('should mark as PARTIALLY_PAID when partial payment exists', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      propertiesRepo.findOne.mockResolvedValue(mockProperty);
      paymentsRepo.find.mockResolvedValue([
        { amount: 1500, status: PaymentStatus.COMPLETED, payment_type: PaymentType.DEPOSIT },
      ]);
      invoicesRepo.count.mockResolvedValue(0);

      const result = await service.generateInvoice('prop-1', 'booking-1');

      expect(result.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    });

    it('should exclude refund payments from amount_paid', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      propertiesRepo.findOne.mockResolvedValue(mockProperty);
      paymentsRepo.find.mockResolvedValue([
        { amount: 3000, status: PaymentStatus.COMPLETED, payment_type: PaymentType.FULL },
        { amount: 500, status: PaymentStatus.COMPLETED, payment_type: PaymentType.REFUND },
      ]);
      invoicesRepo.count.mockResolvedValue(0);

      const result = await service.generateInvoice('prop-1', 'booking-1');

      expect(result.amount_paid).toBe(3000);
    });

    it('should generate without VAT when includeVat=false', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      propertiesRepo.findOne.mockResolvedValue(mockProperty);
      paymentsRepo.find.mockResolvedValue([]);
      invoicesRepo.count.mockResolvedValue(0);

      const result = await service.generateInvoice('prop-1', 'booking-1', {
        includeVat: false,
      });

      expect(result.vat_rate).toBe(0);
      expect(result.vat_amount).toBe(0);
    });

    it('should throw when booking not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateInvoice('prop-1', 'nope'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when property not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      propertiesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateInvoice('prop-1', 'booking-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should increment invoice number based on count', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      propertiesRepo.findOne.mockResolvedValue(mockProperty);
      paymentsRepo.find.mockResolvedValue([]);
      invoicesRepo.count.mockResolvedValue(42);

      const result = await service.generateInvoice('prop-1', 'booking-1');

      expect(result.invoice_number).toBe('INV-2026-0043');
    });
  });

  describe('getInvoice', () => {
    it('should return an invoice by id', async () => {
      invoicesRepo.findOne.mockResolvedValue({ id: 'inv-1', invoice_number: 'INV-2026-0001' });

      const result = await service.getInvoice('inv-1', 'prop-1');
      expect(result.invoice_number).toBe('INV-2026-0001');
    });

    it('should throw when invoice not found', async () => {
      invoicesRepo.findOne.mockResolvedValue(null);

      await expect(service.getInvoice('nope', 'prop-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getInvoiceByNumber', () => {
    it('should return invoice by number', async () => {
      invoicesRepo.findOne.mockResolvedValue({
        id: 'inv-1',
        invoice_number: 'INV-2026-0001',
        booking: { guest: { email: 'john@test.com' } },
      });

      const result = await service.getInvoiceByNumber('INV-2026-0001', 'john@test.com');
      expect(result.id).toBe('inv-1');
    });

    it('should throw when email does not match', async () => {
      invoicesRepo.findOne.mockResolvedValue({
        id: 'inv-1',
        booking: { guest: { email: 'other@test.com' } },
      });

      await expect(
        service.getInvoiceByNumber('INV-2026-0001', 'john@test.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when invoice not found', async () => {
      invoicesRepo.findOne.mockResolvedValue(null);

      await expect(service.getInvoiceByNumber('NOPE')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelInvoice', () => {
    it('should cancel an issued invoice', async () => {
      invoicesRepo.findOne.mockResolvedValue({ id: 'inv-1', status: InvoiceStatus.ISSUED });
      invoicesRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.cancelInvoice('inv-1', 'prop-1');

      expect(result.status).toBe(InvoiceStatus.CANCELLED);
    });

    it('should throw when invoice is already cancelled', async () => {
      invoicesRepo.findOne.mockResolvedValue({ id: 'inv-1', status: InvoiceStatus.CANCELLED });

      await expect(
        service.cancelInvoice('inv-1', 'prop-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateCreditNote', () => {
    it('should generate a credit note for a refund', async () => {
      bookingsRepo.findOne.mockResolvedValue(mockBooking);
      propertiesRepo.findOne.mockResolvedValue(mockProperty);
      invoicesRepo.count.mockResolvedValue(5);

      const result = await service.generateCreditNote('prop-1', 'booking-1', 500);

      expect(result.invoice_number).toBe('CN-2026-0006');
      expect(result.invoice_type).toBe(InvoiceType.CREDIT_NOTE);
      expect(result.total).toBe(500);
      expect(result.line_items[0].description).toContain('Refund');
    });

    it('should throw when booking not found', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateCreditNote('prop-1', 'nope', 500),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listInvoices', () => {
    it('should return paginated invoices', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'inv-1' }], 1]),
      };
      invoicesRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listInvoices('prop-1', { page: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
