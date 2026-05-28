import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { sharedStyles } from './styles.js';
import { Api } from './api.js';
import type { PropertyInfo, AvailabilityResult, AvailableRoom, BookingResult, GuestDetails } from './api.js';

import './steps/date-select.js';
import './steps/room-select.js';
import './steps/guest-details.js';
import './steps/confirmation.js';

type Step = 'dates' | 'rooms' | 'details' | 'confirmation';

const STEPS: Step[] = ['dates', 'rooms', 'details', 'confirmation'];
const STEP_LABELS: Record<Step, string> = {
  dates: 'Dates',
  rooms: 'Room',
  details: 'Details',
  confirmation: 'Confirmed',
};

@customElement('propertyos-booking')
export class PropertyOSBooking extends LitElement {
  static styles = sharedStyles;

  @property() slug = '';
  @property({ attribute: 'api-url' }) apiUrl = 'http://localhost:3001/api';

  @state() private propertyInfo: PropertyInfo | null = null;
  @state() private loading = true;
  @state() private error = '';
  @state() private step: Step = 'dates';

  @state() private checkIn = '';
  @state() private checkOut = '';
  @state() private guests = 2;

  @state() private availability: AvailabilityResult | null = null;
  @state() private searchingRooms = false;
  @state() private selectedRoom: AvailableRoom | null = null;

  @state() private submitting = false;
  @state() private bookingResult: BookingResult | null = null;
  @state() private lastGuest: GuestDetails | null = null;

  private api!: Api;

  connectedCallback() {
    super.connectedCallback();
    this.api = new Api(this.apiUrl);
    this.loadProperty();
  }

  private async loadProperty() {
    try {
      this.propertyInfo = await this.api.getProperty(this.slug);
    } catch {
      this.error = 'Property not found';
    } finally {
      this.loading = false;
    }
  }

  private async searchAvailability() {
    this.searchingRooms = true;
    this.error = '';
    try {
      this.availability = await this.api.checkAvailability(this.slug, this.checkIn, this.checkOut, this.guests);
      this.step = 'rooms';
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.searchingRooms = false;
    }
  }

  private selectRoom(room: AvailableRoom) {
    this.selectedRoom = room;
    this.step = 'details';
  }

  private async submitBooking(guest: GuestDetails) {
    if (!this.selectedRoom) return;
    this.submitting = true;
    this.error = '';
    try {
      this.bookingResult = await this.api.createBooking({
        propertySlug: this.slug,
        roomTypeId: this.selectedRoom.roomTypeId,
        checkIn: this.checkIn,
        checkOut: this.checkOut,
        guestCount: this.guests,
        guest,
        specialRequests: guest.specialRequests,
      });
      this.lastGuest = guest;
      this.step = 'confirmation';
    } catch (err: any) {
      this.error = err.message;
    } finally {
      this.submitting = false;
    }
  }

  private handleFieldChange(e: CustomEvent) {
    const { field, value } = e.detail;
    if (field === 'checkIn') this.checkIn = value;
    else if (field === 'checkOut') this.checkOut = value;
    else if (field === 'guests') this.guests = value;
  }

  render() {
    if (this.loading) {
      return html`<div class="container"><div class="center-loader"><span class="spinner spinner-dark" style="width:2rem;height:2rem;"></span></div></div>`;
    }

    if (!this.propertyInfo) {
      return html`
        <div class="container">
          <div class="body" style="text-align:center;padding:2rem;">
            <p style="font-weight:600;">Property not found</p>
            <p style="font-size:0.875rem;color:var(--pos-muted);">This property does not exist or is not accepting bookings.</p>
          </div>
        </div>
      `;
    }

    const stepIndex = STEPS.indexOf(this.step);

    return html`
      <div class="container">
        <div class="header">
          <h2>${this.propertyInfo.name}</h2>
          ${this.propertyInfo.location ? html`<div class="location">📍 ${this.propertyInfo.location}</div>` : nothing}
        </div>

        <div class="body">
          <div class="progress">
            ${STEPS.map((s, i) => html`
              ${i > 0 ? html`<span class="chevron">›</span>` : nothing}
              <span class="step-pill ${s === this.step ? 'active' : stepIndex > i ? 'done' : ''}">${STEP_LABELS[s]}</span>
            `)}
          </div>

          ${this.error ? html`<div class="error-box">${this.error}</div>` : nothing}

          ${this.step === 'dates' ? html`
            <pos-date-select
              .propertyInfo=${this.propertyInfo}
              .checkIn=${this.checkIn}
              .checkOut=${this.checkOut}
              .guests=${this.guests}
              .searching=${this.searchingRooms}
              @field-change=${this.handleFieldChange}
              @search-availability=${() => this.searchAvailability()}
            ></pos-date-select>
          ` : nothing}

          ${this.step === 'rooms' && this.availability ? html`
            <pos-room-select
              .availability=${this.availability}
              .guests=${this.guests}
              @go-back=${() => { this.step = 'dates'; }}
              @select-room=${(e: CustomEvent) => this.selectRoom(e.detail)}
            ></pos-room-select>
          ` : nothing}

          ${this.step === 'details' && this.selectedRoom && this.availability ? html`
            <pos-guest-details
              .selectedRoom=${this.selectedRoom}
              .availability=${this.availability}
              .submitting=${this.submitting}
              @go-back=${() => { this.step = 'rooms'; }}
              @submit-booking=${(e: CustomEvent) => this.submitBooking(e.detail)}
            ></pos-guest-details>
          ` : nothing}

          ${this.step === 'confirmation' && this.bookingResult && this.lastGuest ? html`
            <pos-confirmation
              .propertyInfo=${this.propertyInfo}
              .result=${this.bookingResult}
              .selectedRoom=${this.selectedRoom!}
              .availability=${this.availability!}
              .guest=${this.lastGuest}
              .checkIn=${this.checkIn}
              .checkOut=${this.checkOut}
            ></pos-confirmation>
          ` : nothing}
        </div>
      </div>
    `;
  }
}
