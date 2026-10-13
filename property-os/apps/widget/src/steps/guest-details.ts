import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { sharedStyles } from '../styles.js';
import type { AvailabilityResult, AvailableRoom, GuestDetails } from '../api.js';

@customElement('pos-guest-details')
export class GuestDetailsStep extends LitElement {
  static styles = sharedStyles;

  @property({ type: Object }) selectedRoom!: AvailableRoom;
  @property({ type: Object }) availability!: AvailabilityResult;
  @property({ type: Boolean }) submitting = false;
  @property({ type: String }) roomDisplayName = '';

  @state() private form: GuestDetails = {
    firstName: '',
    lastName: '',
    email: '',
    emailConfirm: '',
    phone: '',
    idNumber: '',
    arrivalTime: '',
    specialRequests: '',
  };

  @state() private emailMismatch = false;

  private emit(name: string, detail: any) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private update_(field: keyof GuestDetails, value: string) {
    this.form = { ...this.form, [field]: value };
    if (field === 'email' || field === 'emailConfirm') {
      this.emailMismatch = !!(this.form.email && this.form.emailConfirm && this.form.email !== this.form.emailConfirm);
    }
  }

  private get canSubmit() {
    return (
      this.form.firstName &&
      this.form.lastName &&
      this.form.email &&
      this.form.emailConfirm &&
      this.form.email === this.form.emailConfirm &&
      this.form.phone &&
      !this.submitting
    );
  }

  render() {
    const r = this.selectedRoom;
    const a = this.availability;
    return html`
      <div>
        <button class="back-link" @click=${() => this.emit('go-back', {})}>← Change room</button>

        <div class="booking-summary">
          <div class="room-name">${this.roomDisplayName || r.roomTypeName}</div>
          <div class="dates">${a.checkIn} → ${a.checkOut} · ${a.nights} night${a.nights > 1 ? 's' : ''}</div>
          <div class="total">Total: R ${r.totalPrice.toLocaleString()}</div>
        </div>

        <h3 style="font-size:1rem;font-weight:600;margin-bottom:1rem;">Your Details</h3>

        <div class="row">
          <div class="field">
            <label>First Name *</label>
            <input .value=${this.form.firstName} @input=${(e: Event) => this.update_('firstName', (e.target as HTMLInputElement).value)} />
          </div>
          <div class="field">
            <label>Last Name *</label>
            <input .value=${this.form.lastName} @input=${(e: Event) => this.update_('lastName', (e.target as HTMLInputElement).value)} />
          </div>
        </div>

        <div class="field">
          <label>Email *</label>
          <input type="email" .value=${this.form.email} @input=${(e: Event) => this.update_('email', (e.target as HTMLInputElement).value)} />
        </div>

        <div class="field">
          <label>Confirm Email *</label>
          <input type="email" .value=${this.form.emailConfirm || ''} @input=${(e: Event) => this.update_('emailConfirm', (e.target as HTMLInputElement).value)}
            style=${this.emailMismatch ? 'border-color:#ef4444' : ''} />
          ${this.emailMismatch ? html`<span style="color:#ef4444;font-size:0.75rem;">Emails do not match</span>` : ''}
        </div>

        <div class="row">
          <div class="field">
            <label>Phone *</label>
            <input type="tel" placeholder="+27 82 123 4567" .value=${this.form.phone} @input=${(e: Event) => this.update_('phone', (e.target as HTMLInputElement).value)} />
          </div>
          <div class="field">
            <label>ID / Passport Number</label>
            <input placeholder="For guest register" .value=${this.form.idNumber || ''} @input=${(e: Event) => this.update_('idNumber', (e.target as HTMLInputElement).value)} />
          </div>
        </div>

        <div class="field">
          <label>Estimated Arrival Time</label>
          <select @change=${(e: Event) => this.update_('arrivalTime', (e.target as HTMLSelectElement).value)}>
            <option value="">Select time (optional)</option>
            ${['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'].map(
              (t) => html`<option value=${t} ?selected=${this.form.arrivalTime === t}>${t}</option>`
            )}
          </select>
        </div>

        <div class="field">
          <label>Special Requests (optional)</label>
          <textarea rows="3" placeholder="Late check-in, extra pillows, etc."
            .value=${this.form.specialRequests || ''}
            @input=${(e: Event) => this.update_('specialRequests', (e.target as HTMLTextAreaElement).value)}></textarea>
        </div>

        <button class="btn btn-accent"
          ?disabled=${!this.canSubmit}
          @click=${() => this.emit('submit-booking', this.form)}>
          ${this.submitting ? html`<span class="spinner"></span> Booking...` : `Confirm Booking – R ${r.totalPrice.toLocaleString()}`}
        </button>
      </div>
    `;
  }
}
