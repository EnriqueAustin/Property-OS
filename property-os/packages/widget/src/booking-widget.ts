import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { widgetStyles } from './styles';

interface RoomType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  maxOccupancy: number;
  amenities: string[];
}

interface PropertyInfo {
  name: string;
  description: string;
  coverImage: string | null;
  location: string;
  checkInTime: string;
  checkOutTime: string;
  roomTypes: RoomType[];
}

interface AvailableRoom {
  roomTypeId: string;
  roomTypeName: string;
  description: string;
  amenities: string[];
  nightlyRate: number;
  totalPrice: number;
  availableCount: number;
  maxOccupancy: number;
}

interface AvailabilityResult {
  checkIn: string;
  checkOut: string;
  nights: number;
  availableRooms: AvailableRoom[];
}

type Step = 'dates' | 'rooms' | 'details' | 'confirmation';

const STEP_ORDER: Step[] = ['dates', 'rooms', 'details', 'confirmation'];
const STEP_LABELS: Record<Step, string> = {
  dates: 'Dates',
  rooms: 'Room',
  details: 'Details',
  confirmation: 'Confirmed',
};

const SVG_CHECK = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

@customElement('booking-widget')
export class BookingWidget extends LitElement {
  static override styles = widgetStyles;

  @property({ type: String, attribute: 'property-slug' }) slug = '';
  @property({ type: String, attribute: 'api-url' }) apiUrl = '';

  @state() private _step: Step = 'dates';
  @state() private _property: PropertyInfo | null = null;
  @state() private _loading = true;
  @state() private _error = '';
  @state() private _checkIn = '';
  @state() private _checkOut = '';
  @state() private _guests = 2;
  @state() private _searching = false;
  @state() private _availability: AvailabilityResult | null = null;
  @state() private _selectedRoom: AvailableRoom | null = null;
  @state() private _firstName = '';
  @state() private _lastName = '';
  @state() private _email = '';
  @state() private _phone = '';
  @state() private _specialRequests = '';
  @state() private _submitting = false;
  @state() private _bookingResult: any = null;

  private get _baseUrl(): string {
    if (this.apiUrl) return this.apiUrl.replace(/\/$/, '');
    const script = document.querySelector('script[src*="widget"]');
    if (script) {
      try {
        const url = new URL((script as HTMLScriptElement).src);
        return `${url.origin}/api`;
      } catch { /* fall through */ }
    }
    return 'http://localhost:3001/api';
  }

  override connectedCallback() {
    super.connectedCallback();
    this._fetchProperty();
  }

  private async _fetchProperty() {
    try {
      const res = await fetch(`${this._baseUrl}/public/properties/${this.slug}`);
      if (!res.ok) throw new Error('Property not found');
      const json = await res.json();
      this._property = json.data ?? json;
    } catch {
      this._error = 'Property not found or unavailable.';
    } finally {
      this._loading = false;
    }
  }

  private async _searchAvailability() {
    if (!this._checkIn || !this._checkOut) return;
    this._searching = true;
    this._error = '';
    try {
      const res = await fetch(
        `${this._baseUrl}/public/properties/${this.slug}/availability?checkIn=${this._checkIn}&checkOut=${this._checkOut}&guests=${this._guests}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || 'Failed to check availability');
      }
      const json = await res.json();
      this._availability = json.data ?? json;
      this._step = 'rooms';
    } catch (err: any) {
      this._error = err.message;
    } finally {
      this._searching = false;
    }
  }

  private async _submitBooking() {
    if (!this._selectedRoom) return;
    this._submitting = true;
    this._error = '';
    try {
      const res = await fetch(`${this._baseUrl}/public/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertySlug: this.slug,
          roomTypeId: this._selectedRoom.roomTypeId,
          checkIn: this._checkIn,
          checkOut: this._checkOut,
          guestCount: this._guests,
          guest: {
            firstName: this._firstName,
            lastName: this._lastName,
            email: this._email,
            phone: this._phone,
          },
          specialRequests: this._specialRequests || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.message || 'Booking failed');
      }
      const json = await res.json();
      this._bookingResult = json.data ?? json;
      this._step = 'confirmation';
    } catch (err: any) {
      this._error = err.message;
    } finally {
      this._submitting = false;
    }
  }

  private _today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private _minCheckOut(): string {
    if (!this._checkIn) return this._today();
    return new Date(new Date(this._checkIn).getTime() + 86400000).toISOString().slice(0, 10);
  }

  override render() {
    if (this._loading) {
      return html`
        <div class="widget-container">
          <div class="loading-center"><span class="spinner dark"></span></div>
        </div>
      `;
    }
    if (!this._property) {
      return html`
        <div class="widget-container">
          <div class="empty-state">${this._error || 'Property not found.'}</div>
        </div>
      `;
    }

    return html`
      <div class="widget-container">
        <div class="widget-header">
          <h1>${this._property.name}</h1>
          ${this._property.location ? html`<div class="location">${this._property.location}</div>` : nothing}
        </div>
        <div class="widget-body">
          ${this._renderSteps()}
          ${this._error ? html`<div class="alert-error">${this._error}</div>` : nothing}
          ${this._step === 'dates' ? this._renderDates() : nothing}
          ${this._step === 'rooms' ? this._renderRooms() : nothing}
          ${this._step === 'details' ? this._renderDetails() : nothing}
          ${this._step === 'confirmation' ? this._renderConfirmation() : nothing}
        </div>
        <div class="powered-by">Powered by <a href="https://propertyos.co.za" target="_blank" rel="noopener">PropertyOS</a></div>
      </div>
    `;
  }

  private _renderSteps() {
    const currentIdx = STEP_ORDER.indexOf(this._step);
    return html`
      <div class="steps">
        ${STEP_ORDER.map((s, i) => html`
          ${i > 0 ? html`<span class="step-sep">›</span>` : nothing}
          <span class="step-pill ${i === currentIdx ? 'active' : i < currentIdx ? 'done' : 'pending'}">
            ${STEP_LABELS[s]}
          </span>
        `)}
      </div>
    `;
  }

  private _renderDates() {
    const p = this._property!;
    return html`
      <div class="form-row">
        <div class="form-group">
          <label>Check-in</label>
          <input
            type="date"
            .value=${this._checkIn}
            min=${this._today()}
            @change=${(e: Event) => {
              this._checkIn = (e.target as HTMLInputElement).value;
              if (this._checkOut && this._checkIn >= this._checkOut) this._checkOut = '';
            }}
          />
        </div>
        <div class="form-group">
          <label>Check-out</label>
          <input
            type="date"
            .value=${this._checkOut}
            min=${this._minCheckOut()}
            @change=${(e: Event) => { this._checkOut = (e.target as HTMLInputElement).value; }}
          />
        </div>
      </div>
      <div class="form-group">
        <label>Guests</label>
        <select
          .value=${String(this._guests)}
          @change=${(e: Event) => { this._guests = Number((e.target as HTMLSelectElement).value); }}
          style="width: 120px"
        >
          ${[1, 2, 3, 4, 5, 6].map(n => html`<option value=${n}>${n} ${n === 1 ? 'Guest' : 'Guests'}</option>`)}
        </select>
      </div>
      <div class="check-times">
        <span>Check-in: ${p.checkInTime || '14:00'}</span>
        <span>Check-out: ${p.checkOutTime || '10:00'}</span>
      </div>
      <button
        class="btn btn-primary"
        ?disabled=${!this._checkIn || !this._checkOut || this._searching}
        @click=${this._searchAvailability}
      >
        ${this._searching ? html`<span class="spinner"></span> Searching...` : 'Search Available Rooms'}
      </button>
    `;
  }

  private _renderRooms() {
    const a = this._availability!;
    return html`
      <button class="btn-link" @click=${() => { this._step = 'dates'; }}>← Change dates</button>
      <div class="summary-bar" style="margin-top: 8px">
        <span>${a.checkIn} → ${a.checkOut}</span>
        <span>${a.nights} night${a.nights > 1 ? 's' : ''}</span>
        <span>${this._guests} guest${this._guests > 1 ? 's' : ''}</span>
      </div>
      ${a.availableRooms.length === 0
        ? html`<div class="empty-state">No rooms available for the selected dates. Try different dates.</div>`
        : a.availableRooms.map(room => html`
            <div class="room-card">
              <div class="room-card-inner">
                <div class="room-info">
                  <h3>${room.roomTypeName}</h3>
                  ${room.description ? html`<div class="desc">${room.description}</div>` : nothing}
                  <div class="meta">Max ${room.maxOccupancy} guests</div>
                  ${room.amenities.length > 0 ? html`
                    <div class="amenities">
                      ${room.amenities.map(am => html`<span class="amenity-tag">✓ ${am}</span>`)}
                    </div>
                  ` : nothing}
                </div>
                <div class="room-pricing">
                  <div class="per-night">R ${room.nightlyRate.toLocaleString()} / night</div>
                  <div class="total">R ${room.totalPrice.toLocaleString()}</div>
                  <div class="total-label">total for ${a.nights} night${a.nights > 1 ? 's' : ''}</div>
                  <button class="btn btn-primary" style="padding: 8px 16px; font-size: 13px" @click=${() => {
                    this._selectedRoom = room;
                    this._step = 'details';
                  }}>Select</button>
                </div>
              </div>
            </div>
          `)
      }
    `;
  }

  private _renderDetails() {
    const room = this._selectedRoom!;
    const a = this._availability!;
    const canSubmit = this._firstName && this._lastName && this._email && this._phone && !this._submitting;

    return html`
      <button class="btn-link" @click=${() => { this._step = 'rooms'; }}>← Change room</button>
      <div class="booking-summary" style="margin-top: 8px">
        <div class="room-name">${room.roomTypeName}</div>
        <div class="dates">${a.checkIn} → ${a.checkOut} · ${a.nights} night${a.nights > 1 ? 's' : ''}</div>
        <div class="price">Total: R ${room.totalPrice.toLocaleString()}</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>First Name *</label>
          <input type="text" .value=${this._firstName} @input=${(e: Event) => { this._firstName = (e.target as HTMLInputElement).value; }} />
        </div>
        <div class="form-group">
          <label>Last Name *</label>
          <input type="text" .value=${this._lastName} @input=${(e: Event) => { this._lastName = (e.target as HTMLInputElement).value; }} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email *</label>
          <input type="email" .value=${this._email} @input=${(e: Event) => { this._email = (e.target as HTMLInputElement).value; }} />
        </div>
        <div class="form-group">
          <label>Phone *</label>
          <input type="tel" .value=${this._phone} placeholder="+27 82 123 4567" @input=${(e: Event) => { this._phone = (e.target as HTMLInputElement).value; }} />
        </div>
      </div>
      <div class="form-group">
        <label>Special Requests (optional)</label>
        <textarea rows="3" placeholder="Late check-in, extra pillows, etc." .value=${this._specialRequests} @input=${(e: Event) => { this._specialRequests = (e.target as HTMLTextAreaElement).value; }}></textarea>
      </div>
      <button
        class="btn btn-accent"
        ?disabled=${!canSubmit}
        @click=${this._submitBooking}
      >
        ${this._submitting ? html`<span class="spinner"></span> Booking...` : `Confirm Booking — R ${room.totalPrice.toLocaleString()}`}
      </button>
    `;
  }

  private _renderConfirmation() {
    const b = this._bookingResult;
    const room = this._selectedRoom;
    const a = this._availability;
    const p = this._property!;

    return html`
      <div class="confirm-center">
        <div class="confirm-icon">${SVG_CHECK}</div>
        <h2>Booking Confirmed!</h2>
        <div class="ref">Reference: <code>${b.reference_number}</code></div>

        <div class="confirm-details">
          <div class="row"><span class="label">Property</span><span class="value">${p.name}</span></div>
          <div class="row"><span class="label">Room</span><span class="value">${room?.roomTypeName}</span></div>
          <div class="row"><span class="label">Check-in</span><span class="value">${this._checkIn}</span></div>
          <div class="row"><span class="label">Check-out</span><span class="value">${this._checkOut}</span></div>
          <div class="row"><span class="label">Nights</span><span class="value">${a?.nights}</span></div>
          <div class="row"><span class="label">Guest</span><span class="value">${this._firstName} ${this._lastName}</span></div>
          <div class="row total"><span class="label">Total</span><span class="value">R ${Number(b.total_price).toLocaleString()}</span></div>
        </div>

        <div class="confirm-actions">
          <button class="btn btn-outline" @click=${() => this._addToGoogleCalendar()}>Add to Calendar</button>
          <button class="btn btn-outline" @click=${() => this._downloadIcs()}>Download .ics</button>
        </div>

        <div class="confirm-email">Confirmation sent to <strong>${this._email}</strong></div>
      </div>
    `;
  }

  private _addToGoogleCalendar() {
    const b = this._bookingResult;
    const p = this._property!;
    const start = this._checkIn.replace(/-/g, '');
    const end = this._checkOut.replace(/-/g, '');
    const title = encodeURIComponent(`Stay at ${p.name}`);
    const details = encodeURIComponent(`Booking Ref: ${b.reference_number}\nRoom: ${this._selectedRoom?.roomTypeName}\nGuests: ${this._guests}`);
    const location = encodeURIComponent(p.location || p.name);
    window.open(
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`,
      '_blank',
    );
  }

  private _downloadIcs() {
    const b = this._bookingResult;
    const p = this._property!;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PropertyOS//Booking//EN',
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE:${this._checkIn.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${this._checkOut.replace(/-/g, '')}`,
      `SUMMARY:Stay at ${p.name}`,
      `DESCRIPTION:Booking Ref: ${b.reference_number}\\nRoom: ${this._selectedRoom?.roomTypeName}\\nGuests: ${this._guests}`,
      `LOCATION:${p.location || p.name}`,
      `UID:${b.id || b.reference_number}@propertyos`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-${b.reference_number}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'booking-widget': BookingWidget;
  }
}
