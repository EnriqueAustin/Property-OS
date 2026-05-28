import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { sharedStyles } from '../styles.js';
import type { AvailabilityResult, AvailableRoom } from '../api.js';

@customElement('pos-room-select')
export class RoomSelect extends LitElement {
  static styles = sharedStyles;

  @property({ type: Object }) availability!: AvailabilityResult;
  @property({ type: Number }) guests = 2;

  private emit(name: string, detail: any) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  render() {
    const a = this.availability;
    return html`
      <div>
        <button class="back-link" @click=${() => this.emit('go-back', {})}>← Change dates</button>

        <div class="summary-bar">
          <span>${a.checkIn} → ${a.checkOut}</span>
          <span>${a.nights} night${a.nights > 1 ? 's' : ''}</span>
          <span>${this.guests} guest${this.guests > 1 ? 's' : ''}</span>
        </div>

        ${a.availableRooms.length === 0
          ? html`<div style="text-align:center;padding:2rem;color:var(--pos-muted);">No rooms available for the selected dates.</div>`
          : a.availableRooms.map(room => this.renderRoom(room))
        }
      </div>
    `;
  }

  private renderRoom(room: AvailableRoom) {
    return html`
      <div class="room-card">
        <div class="room-info">
          <h4>${room.roomTypeName}</h4>
          ${room.description ? html`<div class="desc">${room.description}</div>` : ''}
          <div class="occupancy">Max ${room.maxOccupancy} guests</div>
          ${room.amenities.length > 0 ? html`
            <div class="amenities">
              ${room.amenities.map(a => html`<span class="amenity">✓ ${a}</span>`)}
            </div>
          ` : ''}
        </div>
        <div class="pricing">
          <div class="rate">R ${room.nightlyRate.toLocaleString()} / night</div>
          <div class="total-price">R ${room.totalPrice.toLocaleString()}</div>
          <div class="nights-label">total for ${this.availability.nights} night${this.availability.nights > 1 ? 's' : ''}</div>
          <button class="btn btn-primary" @click=${() => this.emit('select-room', room)}>Select</button>
        </div>
      </div>
    `;
  }
}
