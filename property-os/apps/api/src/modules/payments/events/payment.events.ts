export const PAYMENT_EVENTS = {
  COMPLETED: 'payment.completed',
} as const;

export class PaymentCompletedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly amount: number,
    public readonly method: string,
  ) {}
}
