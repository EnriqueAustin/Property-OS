import { escapeHtml } from './html-escape.util';

export interface BookingTemplateData {
  guestName: string;
  propertyName: string;
  referenceNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomName: string;
  totalPrice: string;
  currency: string;
  specialRequests?: string;
  checkInTime?: string;
  checkOutTime?: string;
}

export function bookingConfirmationEmail(data: BookingTemplateData): {
  subject: string;
  html: string;
} {
  const e = escapeHtml;
  return {
    subject: `Booking Confirmed — ${data.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Booking Confirmed</h2>
        <p>Dear ${e(data.guestName)},</p>
        <p>Your booking at <strong>${e(data.propertyName)}</strong> has been confirmed.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Reference</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${e(data.referenceNumber)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Check-in</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.checkIn)}${data.checkInTime ? ` (from ${e(data.checkInTime)})` : ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Check-out</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.checkOut)}${data.checkOutTime ? ` (by ${e(data.checkOutTime)})` : ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Nights</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.nights)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Room</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.roomName)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Total</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${e(data.currency)} ${e(data.totalPrice)}</td></tr>
        </table>
        ${data.specialRequests ? `<p><strong>Special Requests:</strong> ${e(data.specialRequests)}</p>` : ''}
        <p style="color: #6b7280; font-size: 14px;">We look forward to welcoming you!</p>
      </div>
    `,
  };
}

export function bookingCancellationEmail(
  data: BookingTemplateData & { reason?: string },
): { subject: string; html: string } {
  const e = escapeHtml;
  return {
    subject: `Booking Cancelled — ${data.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Booking Cancelled</h2>
        <p>Dear ${e(data.guestName)},</p>
        <p>Your booking at <strong>${e(data.propertyName)}</strong> (Ref: ${e(data.referenceNumber)}) has been cancelled.</p>
        <p><strong>Dates:</strong> ${e(data.checkIn)} to ${e(data.checkOut)} (${e(data.nights)} night${data.nights > 1 ? 's' : ''})</p>
        ${data.reason ? `<p><strong>Reason:</strong> ${e(data.reason)}</p>` : ''}
        <p style="color: #6b7280; font-size: 14px;">If you have any questions, please contact the property directly.</p>
      </div>
    `,
  };
}

export function newBookingAlertEmail(
  data: BookingTemplateData & { guestEmail?: string; guestPhone?: string },
): { subject: string; html: string } {
  const e = escapeHtml;
  return {
    subject: `New Booking — ${data.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">New Booking Received</h2>
        <p>A new booking has been made at <strong>${e(data.propertyName)}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Reference</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${e(data.referenceNumber)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Guest</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.guestName)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Dates</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.checkIn)} to ${e(data.checkOut)} (${e(data.nights)} nights)</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Room</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.roomName)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Total</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${e(data.currency)} ${e(data.totalPrice)}</td></tr>
          ${data.guestEmail ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Email</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.guestEmail)}</td></tr>` : ''}
          ${data.guestPhone ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.guestPhone)}</td></tr>` : ''}
        </table>
      </div>
    `,
  };
}

export function bookingModifiedEmail(
  data: BookingTemplateData & { changes: string },
): { subject: string; html: string } {
  const e = escapeHtml;
  // `data.changes` is a trusted, pre-built HTML fragment assembled by
  // NotificationsService (labels are server-controlled and the dynamic values
  // inside it are escaped there). It is intentionally interpolated as raw HTML.
  return {
    subject: `Booking Updated — ${data.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Booking Updated</h2>
        <p>Dear ${e(data.guestName)},</p>
        <p>Your booking at <strong>${e(data.propertyName)}</strong> (Ref: ${e(data.referenceNumber)}) has been updated.</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-weight: bold; color: #334155;">What changed:</p>
          ${data.changes}
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Check-in</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.checkIn)}${data.checkInTime ? ` (from ${e(data.checkInTime)})` : ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Check-out</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.checkOut)}${data.checkOutTime ? ` (by ${e(data.checkOutTime)})` : ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Nights</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.nights)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Room</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.roomName)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Total</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${e(data.currency)} ${e(data.totalPrice)}</td></tr>
        </table>
        <p style="color: #6b7280; font-size: 14px;">If you have any questions, please contact the property directly.</p>
      </div>
    `,
  };
}

export function paymentReceivedEmail(
  data: BookingTemplateData & { amountPaid: string; paymentMethod: string },
): { subject: string; html: string } {
  const e = escapeHtml;
  return {
    subject: `Payment Received — ${data.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Payment Received</h2>
        <p>Dear ${e(data.guestName)},</p>
        <p>We have received your payment for booking <strong>${e(data.referenceNumber)}</strong> at ${e(data.propertyName)}.</p>
        <p><strong>Amount:</strong> ${e(data.currency)} ${e(data.amountPaid)}</p>
        <p><strong>Method:</strong> ${e(data.paymentMethod)}</p>
        <p style="color: #6b7280; font-size: 14px;">Thank you for your payment.</p>
      </div>
    `,
  };
}

export interface PreArrivalData extends BookingTemplateData {
  propertyAddress?: string;
  propertyPhone?: string;
  wifiName?: string;
  wifiPassword?: string;
  directions?: string;
  houseRules?: string;
}

export function preArrivalEmail(data: PreArrivalData): {
  subject: string;
  html: string;
} {
  const e = escapeHtml;
  return {
    subject: `Your stay is coming up — ${data.propertyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Your Stay is Almost Here!</h2>
        <p>Dear ${e(data.guestName)},</p>
        <p>We're looking forward to welcoming you at <strong>${e(data.propertyName)}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Reference</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${e(data.referenceNumber)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Check-in</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.checkIn)}${data.checkInTime ? ` (from ${e(data.checkInTime)})` : ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Check-out</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.checkOut)}${data.checkOutTime ? ` (by ${e(data.checkOutTime)})` : ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Room</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${e(data.roomName)}</td></tr>
        </table>
        ${data.propertyAddress ? `<div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;"><p style="margin: 0 0 4px; font-weight: bold; color: #334155;">Address</p><p style="margin: 0; color: #475569;">${e(data.propertyAddress)}</p></div>` : ''}
        ${data.directions ? `<div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;"><p style="margin: 0 0 4px; font-weight: bold; color: #334155;">Directions</p><p style="margin: 0; color: #475569;">${e(data.directions)}</p></div>` : ''}
        ${data.wifiName ? `<div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0;"><p style="margin: 0 0 4px; font-weight: bold; color: #334155;">WiFi</p><p style="margin: 0; color: #475569;">Network: <strong>${e(data.wifiName)}</strong>${data.wifiPassword ? ` &middot; Password: <strong>${e(data.wifiPassword)}</strong>` : ''}</p></div>` : ''}
        ${data.propertyPhone ? `<p style="color: #475569; font-size: 14px;">Need help? Contact us at <strong>${e(data.propertyPhone)}</strong>.</p>` : ''}
        <p style="color: #6b7280; font-size: 14px;">We look forward to welcoming you!</p>
      </div>
    `,
  };
}

export function postStayReviewEmail(data: BookingTemplateData): {
  subject: string;
  html: string;
} {
  const e = escapeHtml;
  return {
    subject: `How was your stay at ${data.propertyName}?`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Thank You for Staying With Us</h2>
        <p>Dear ${e(data.guestName)},</p>
        <p>We hope you enjoyed your stay at <strong>${e(data.propertyName)}</strong> (${e(data.checkIn)} to ${e(data.checkOut)}).</p>
        <p>Your feedback helps us improve and helps future guests choose the right place. We'd really appreciate it if you could take a moment to share your experience.</p>
        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #475569; font-size: 14px;">How would you rate your stay?</p>
          <div style="font-size: 32px; letter-spacing: 8px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Simply reply to this email with your feedback, or rate us on the platform you booked through.</p>
        <p style="color: #6b7280; font-size: 14px;">Thank you for choosing ${e(data.propertyName)}!</p>
      </div>
    `,
  };
}

export interface ErasureConfirmationData {
  guestName: string;
  propertyName: string;
  referenceNumber: string;
  confirmUrl: string;
  graceDays: number;
}

export function erasureConfirmationEmail(data: ErasureConfirmationData): {
  subject: string;
  html: string;
} {
  const e = escapeHtml;
  // `confirmUrl` is built server-side from FRONTEND_URL plus a random token and
  // is validated/escaped by the caller via `safeUrl` before being passed in.
  return {
    subject: `Confirm your data erasure request — ${data.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Confirm Your Data Erasure Request</h2>
        <p>Dear ${e(data.guestName)},</p>
        <p>We received a request to erase your personal data associated with booking
        <strong>${e(data.referenceNumber)}</strong> at <strong>${e(data.propertyName)}</strong>.</p>
        <p>For your protection, this request must be confirmed. Click the button below to
        confirm. If you did not make this request, you can safely ignore this email and
        nothing will happen.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.confirmUrl}" style="background: #dc2626; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Confirm Erasure</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This confirmation link expires in 24 hours.</p>
        <p style="color: #6b7280; font-size: 14px;">Once confirmed, your data will be anonymised after a grace period of
        ${e(data.graceDays)} day${data.graceDays === 1 ? '' : 's'}, during which you may cancel the request by contacting the property.</p>
      </div>
    `,
  };
}
