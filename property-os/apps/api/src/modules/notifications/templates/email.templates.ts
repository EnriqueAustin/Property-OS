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

export function bookingConfirmationEmail(data: BookingTemplateData): { subject: string; html: string } {
  return {
    subject: `Booking Confirmed — ${data.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Booking Confirmed</h2>
        <p>Dear ${data.guestName},</p>
        <p>Your booking at <strong>${data.propertyName}</strong> has been confirmed.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Reference</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${data.referenceNumber}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Check-in</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.checkIn}${data.checkInTime ? ` (from ${data.checkInTime})` : ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Check-out</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.checkOut}${data.checkOutTime ? ` (by ${data.checkOutTime})` : ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Nights</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.nights}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Room</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.roomName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Total</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${data.currency} ${data.totalPrice}</td></tr>
        </table>
        ${data.specialRequests ? `<p><strong>Special Requests:</strong> ${data.specialRequests}</p>` : ''}
        <p style="color: #6b7280; font-size: 14px;">We look forward to welcoming you!</p>
      </div>
    `,
  };
}

export function bookingCancellationEmail(data: BookingTemplateData & { reason?: string }): { subject: string; html: string } {
  return {
    subject: `Booking Cancelled — ${data.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Booking Cancelled</h2>
        <p>Dear ${data.guestName},</p>
        <p>Your booking at <strong>${data.propertyName}</strong> (Ref: ${data.referenceNumber}) has been cancelled.</p>
        <p><strong>Dates:</strong> ${data.checkIn} to ${data.checkOut} (${data.nights} night${data.nights > 1 ? 's' : ''})</p>
        ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
        <p style="color: #6b7280; font-size: 14px;">If you have any questions, please contact the property directly.</p>
      </div>
    `,
  };
}

export function newBookingAlertEmail(data: BookingTemplateData & { guestEmail?: string; guestPhone?: string }): { subject: string; html: string } {
  return {
    subject: `New Booking — ${data.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">New Booking Received</h2>
        <p>A new booking has been made at <strong>${data.propertyName}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Reference</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${data.referenceNumber}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Guest</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.guestName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Dates</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.checkIn} to ${data.checkOut} (${data.nights} nights)</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Room</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.roomName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Total</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${data.currency} ${data.totalPrice}</td></tr>
          ${data.guestEmail ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Email</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.guestEmail}</td></tr>` : ''}
          ${data.guestPhone ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.guestPhone}</td></tr>` : ''}
        </table>
      </div>
    `,
  };
}

export function bookingModifiedEmail(data: BookingTemplateData & { changes: string }): { subject: string; html: string } {
  return {
    subject: `Booking Updated — ${data.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Booking Updated</h2>
        <p>Dear ${data.guestName},</p>
        <p>Your booking at <strong>${data.propertyName}</strong> (Ref: ${data.referenceNumber}) has been updated.</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-weight: bold; color: #334155;">What changed:</p>
          ${data.changes}
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Check-in</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.checkIn}${data.checkInTime ? ` (from ${data.checkInTime})` : ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Check-out</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.checkOut}${data.checkOutTime ? ` (by ${data.checkOutTime})` : ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Nights</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.nights}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Room</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.roomName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Total</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${data.currency} ${data.totalPrice}</td></tr>
        </table>
        <p style="color: #6b7280; font-size: 14px;">If you have any questions, please contact the property directly.</p>
      </div>
    `,
  };
}

export function paymentReceivedEmail(data: BookingTemplateData & { amountPaid: string; paymentMethod: string }): { subject: string; html: string } {
  return {
    subject: `Payment Received — ${data.referenceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Payment Received</h2>
        <p>Dear ${data.guestName},</p>
        <p>We have received your payment for booking <strong>${data.referenceNumber}</strong> at ${data.propertyName}.</p>
        <p><strong>Amount:</strong> ${data.currency} ${data.amountPaid}</p>
        <p><strong>Method:</strong> ${data.paymentMethod}</p>
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

export function preArrivalEmail(data: PreArrivalData): { subject: string; html: string } {
  return {
    subject: `Your stay is coming up — ${data.propertyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Your Stay is Almost Here!</h2>
        <p>Dear ${data.guestName},</p>
        <p>We're looking forward to welcoming you at <strong>${data.propertyName}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Reference</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${data.referenceNumber}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Check-in</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.checkIn}${data.checkInTime ? ` (from ${data.checkInTime})` : ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Check-out</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.checkOut}${data.checkOutTime ? ` (by ${data.checkOutTime})` : ''}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Room</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.roomName}</td></tr>
        </table>
        ${data.propertyAddress ? `<div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;"><p style="margin: 0 0 4px; font-weight: bold; color: #334155;">Address</p><p style="margin: 0; color: #475569;">${data.propertyAddress}</p></div>` : ''}
        ${data.directions ? `<div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;"><p style="margin: 0 0 4px; font-weight: bold; color: #334155;">Directions</p><p style="margin: 0; color: #475569;">${data.directions}</p></div>` : ''}
        ${data.wifiName ? `<div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0;"><p style="margin: 0 0 4px; font-weight: bold; color: #334155;">WiFi</p><p style="margin: 0; color: #475569;">Network: <strong>${data.wifiName}</strong>${data.wifiPassword ? ` &middot; Password: <strong>${data.wifiPassword}</strong>` : ''}</p></div>` : ''}
        ${data.propertyPhone ? `<p style="color: #475569; font-size: 14px;">Need help? Contact us at <strong>${data.propertyPhone}</strong>.</p>` : ''}
        <p style="color: #6b7280; font-size: 14px;">We look forward to welcoming you!</p>
      </div>
    `,
  };
}

export function postStayReviewEmail(data: BookingTemplateData): { subject: string; html: string } {
  return {
    subject: `How was your stay at ${data.propertyName}?`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Thank You for Staying With Us</h2>
        <p>Dear ${data.guestName},</p>
        <p>We hope you enjoyed your stay at <strong>${data.propertyName}</strong> (${data.checkIn} to ${data.checkOut}).</p>
        <p>Your feedback helps us improve and helps future guests choose the right place. We'd really appreciate it if you could take a moment to share your experience.</p>
        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #475569; font-size: 14px;">How would you rate your stay?</p>
          <div style="font-size: 32px; letter-spacing: 8px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Simply reply to this email with your feedback, or rate us on the platform you booked through.</p>
        <p style="color: #6b7280; font-size: 14px;">Thank you for choosing ${data.propertyName}!</p>
      </div>
    `,
  };
}
