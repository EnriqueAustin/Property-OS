export const PAYMENT_EVENTS = {
  COMPLETED: 'payment.completed',
  FAILED: 'payment.failed',
  REFUNDED: 'payment.refunded',
  BALANCE_DUE: 'payment.balance_due',
  INVOICE_GENERATED: 'payment.invoice_generated',
} as const;

export class PaymentCompletedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly amount: number,
    public readonly method: string,
  ) {}
}

export class PaymentFailedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly amount: number,
    public readonly reason: string,
  ) {}
}

export class PaymentRefundedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly amount: number,
    public readonly reason: string,
  ) {}
}

export class BalanceDueEvent {
  constructor(
    public readonly bookingId: string,
    public readonly balanceAmount: number,
    public readonly dueDate: string,
    public readonly guestEmail: string,
  ) {}
}

export class InvoiceGeneratedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly invoiceId: string,
    public readonly invoiceNumber: string,
  ) {}
}
