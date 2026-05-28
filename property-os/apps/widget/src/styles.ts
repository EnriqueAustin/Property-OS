import { css } from 'lit';

export const sharedStyles = css`
  :host {
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1e293b;
    line-height: 1.5;
    --pos-primary: #2563eb;
    --pos-primary-dark: #1d4ed8;
    --pos-accent: #16a34a;
    --pos-border: #e2e8f0;
    --pos-muted: #64748b;
    --pos-bg: #f8fafc;
    --pos-danger: #dc2626;
    --pos-radius: 0.75rem;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .container {
    background: white;
    border: 1px solid var(--pos-border);
    border-radius: var(--pos-radius);
    overflow: hidden;
  }

  .header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--pos-border);
  }

  .header h2 {
    font-size: 1.125rem;
    font-weight: 700;
    margin: 0;
  }

  .header .location {
    font-size: 0.8125rem;
    color: var(--pos-muted);
    margin-top: 0.25rem;
  }

  .body {
    padding: 1.25rem;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    margin-bottom: 1rem;
  }

  .progress .step-pill {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-weight: 500;
    background: #f1f5f9;
    color: var(--pos-muted);
  }

  .progress .step-pill.active {
    background: var(--pos-primary);
    color: white;
  }

  .progress .step-pill.done {
    background: rgba(22, 163, 74, 0.1);
    color: var(--pos-accent);
  }

  .progress .chevron {
    color: var(--pos-muted);
    font-size: 0.75rem;
  }

  .error-box {
    background: rgba(220, 38, 38, 0.1);
    color: var(--pos-danger);
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  input, select, textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--pos-border);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  input:focus, select:focus, textarea:focus {
    border-color: var(--pos-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  }

  textarea {
    resize: none;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--pos-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--pos-primary-dark);
  }

  .btn-accent {
    background: var(--pos-accent);
    color: white;
  }

  .btn-accent:hover:not(:disabled) {
    background: #15803d;
  }

  .back-link {
    display: inline-block;
    font-size: 0.875rem;
    color: var(--pos-primary);
    cursor: pointer;
    margin-bottom: 1rem;
    background: none;
    border: none;
    font-family: inherit;
    padding: 0;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .field {
    margin-bottom: 1rem;
  }

  .summary-bar {
    background: #f1f5f9;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1rem;
    color: var(--pos-muted);
  }

  .booking-summary {
    background: rgba(37, 99, 235, 0.05);
    border: 1px solid rgba(37, 99, 235, 0.15);
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    margin-bottom: 1.25rem;
    font-size: 0.875rem;
  }

  .booking-summary .room-name {
    font-weight: 600;
  }

  .booking-summary .dates {
    color: var(--pos-muted);
  }

  .booking-summary .total {
    font-weight: 700;
    margin-top: 0.25rem;
  }

  .room-card {
    border: 1px solid var(--pos-border);
    border-radius: var(--pos-radius);
    padding: 1.25rem;
    margin-bottom: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: space-between;
    align-items: flex-start;
  }

  .room-card .room-info {
    flex: 1;
    min-width: 180px;
  }

  .room-card h4 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
  }

  .room-card .desc {
    font-size: 0.8125rem;
    color: var(--pos-muted);
  }

  .room-card .occupancy {
    font-size: 0.8125rem;
    color: var(--pos-muted);
    margin-top: 0.375rem;
  }

  .room-card .amenities {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.5rem;
  }

  .room-card .amenity {
    font-size: 0.6875rem;
    background: #f1f5f9;
    padding: 0.2rem 0.5rem;
    border-radius: 0.25rem;
  }

  .room-card .pricing {
    text-align: right;
    min-width: 140px;
  }

  .room-card .pricing .rate {
    font-size: 0.8125rem;
    color: var(--pos-muted);
  }

  .room-card .pricing .total-price {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .room-card .pricing .nights-label {
    font-size: 0.6875rem;
    color: var(--pos-muted);
    margin-bottom: 0.5rem;
  }

  .room-card .btn {
    width: 100%;
    padding: 0.5rem;
  }

  .confirm-wrap {
    text-align: center;
  }

  .confirm-icon {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    background: rgba(22, 163, 74, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
    font-size: 1.5rem;
  }

  .confirm-wrap h3 {
    font-size: 1.375rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .confirm-wrap .ref {
    color: var(--pos-muted);
    font-size: 0.875rem;
    margin-bottom: 1.25rem;
  }

  .confirm-wrap .ref strong {
    font-family: monospace;
    font-weight: 700;
    color: #1e293b;
  }

  .receipt {
    text-align: left;
    background: #f8fafc;
    border-radius: 0.5rem;
    padding: 1rem;
    max-width: 22rem;
    margin: 0 auto;
    font-size: 0.875rem;
  }

  .receipt .line {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0;
  }

  .receipt .line .label {
    color: var(--pos-muted);
  }

  .receipt .line .value {
    font-weight: 500;
  }

  .receipt .line.total-line {
    border-top: 1px solid var(--pos-border);
    margin-top: 0.5rem;
    padding-top: 0.5rem;
  }

  .receipt .line.total-line .value {
    font-weight: 700;
  }

  .confirm-email {
    font-size: 0.875rem;
    color: var(--pos-muted);
    margin-top: 1.25rem;
  }

  .spinner {
    display: inline-block;
    width: 1.125rem;
    height: 1.125rem;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .spinner-dark {
    border-color: rgba(0,0,0,0.15);
    border-top-color: var(--pos-primary);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .center-loader {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem;
  }
`;
