import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { sharedStyles } from '../styles.js';
import type { PropertyInfo } from '../api.js';

@customElement('pos-date-select')
export class DateSelect extends LitElement {
  static styles = sharedStyles;

  @property({ type: Object }) propertyInfo!: PropertyInfo;
  @property() checkIn = '';
  @property() checkOut = '';
  @property({ type: Number }) guests = 2;
  @property({ type: Boolean }) searching = false;

  private get today() {
    return new Date().toISOString().slice(0, 10);
  }

  private get minCheckOut() {
    if (!this.checkIn) return this.today;
    return new Date(new Date(this.checkIn).getTime() + 86400000).toISOString().slice(0, 10);
  }

  private emit(name: string, detail: any) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private onCheckInChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    this.emit('field-change', { field: 'checkIn', value: val });
    if (this.checkOut && val >= this.checkOut) {
      this.emit('field-change', { field: 'checkOut', value: '' });
    }
  }

  render() {
    return html`
      <div>
        <h3 style="font-size:1rem;font-weight:600;margin-bottom:1rem;">Select Your Dates</h3>

        <div class="row">
          <div class="field">
            <label>Check-in</label>
            <input type="date" .value=${this.checkIn} min=${this.today}
              @change=${this.onCheckInChange} />
          </div>
          <div class="field">
            <label>Check-out</label>
            <input type="date" .value=${this.checkOut} min=${this.minCheckOut}
              @change=${(e: Event) => this.emit('field-change', { field: 'checkOut', value: (e.target as HTMLInputElement).value })} />
          </div>
        </div>

        <div class="field">
          <label>Guests</label>
          <select .value=${String(this.guests)} style="width:6rem;"
            @change=${(e: Event) => this.emit('field-change', { field: 'guests', value: Number((e.target as HTMLSelectElement).value) })}>
            ${[1,2,3,4,5,6].map(n => html`<option value=${n}>${n} ${n === 1 ? 'Guest' : 'Guests'}</option>`)}
          </select>
        </div>

        <div style="font-size:0.8125rem;color:var(--pos-muted);margin-bottom:1rem;display:flex;gap:1rem;">
          <span>Check-in: ${this.propertyInfo.checkInTime}</span>
          <span>Check-out: ${this.propertyInfo.checkOutTime}</span>
        </div>

        <button class="btn btn-primary"
          ?disabled=${!this.checkIn || !this.checkOut || this.searching}
          @click=${() => this.emit('search-availability', {})}>
          ${this.searching ? html`<span class="spinner"></span> Searching...` : 'Search Available Rooms'}
        </button>
      </div>
    `;
  }
}
