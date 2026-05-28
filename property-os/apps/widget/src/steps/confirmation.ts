import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { sharedStyles } from '../styles.js';
import type { AvailabilityResult, AvailableRoom, BookingResult, GuestDetails, PropertyInfo } from '../api.js';

@customElement('pos-confirmation')
export class Confirmation extends LitElement {
  static styles = sharedStyles;

  @property({ type: Object }) propertyInfo!: PropertyInfo;
  @property({ type: Object }) result!: BookingResult;
  @property({ type: Object }) selectedRoom!: AvailableRoom;
  @property({ type: Object }) availability!: AvailabilityResult;
  @property({ type: Object }) guest!: GuestDetails;
  @property() checkIn = '';
  @property() checkOut = '';

  render() {
    const r = this.result;
    const room = this.selectedRoom;
    const a = this.availability;
    return html`
      <div class="confirm-wrap">
        <div class="confirm-icon">✓</div>
        <h3>Booking Confirmed!</h3>
        <div class="ref">Reference: <strong>${r.reference_number}</strong></div>

        <div class="receipt">
          <div class="line">
            <span class="label">Property</span>
            <span class="value">${this.propertyInfo.name}</span>
          </div>
          <div class="line">
            <span class="label">Room</span>
            <span class="value">${room.roomTypeName}</span>
          </div>
          <div class="line">
            <span class="label">Check-in</span>
            <span class="value">${this.checkIn}</span>
          </div>
          <div class="line">
            <span class="label">Check-out</span>
            <span class="value">${this.checkOut}</span>
          </div>
          <div class="line">
            <span class="label">Nights</span>
            <span class="value">${a.nights}</span>
          </div>
          <div class="line">
            <span class="label">Guest</span>
            <span class="value">${this.guest.firstName} ${this.guest.lastName}</span>
          </div>
          <div class="line total-line">
            <span class="label">Total</span>
            <span class="value">R ${Number(r.total_price).toLocaleString()}</span>
          </div>
        </div>

        <div class="confirm-email">
          A confirmation email has been sent to <strong>${this.guest.email}</strong>
        </div>
      </div>
    `;
  }
}
