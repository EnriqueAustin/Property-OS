import { css } from 'lit';

export const widgetStyles = css`
  :host {
    display: block;
    font-family: Inter, system-ui, -apple-system, sans-serif;
    color: #1e293b;
    line-height: 1.5;
    --primary: #2563eb;
    --primary-dark: #1d4ed8;
    --accent: #10b981;
    --accent-dark: #059669;
    --danger: #ef4444;
    --border: #e2e8f0;
    --muted: #64748b;
    --bg: #f8fafc;
    --surface: #ffffff;
    --radius: 8px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .widget-container {
    max-width: 640px;
    margin: 0 auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .widget-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  .widget-header h1 {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }
  .widget-header .location {
    font-size: 13px;
    color: var(--muted);
    margin-top: 2px;
  }

  .widget-body { padding: 20px; }

  /* Progress steps */
  .steps {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    font-size: 12px;
  }
  .step-pill {
    padding: 4px 12px;
    border-radius: 20px;
    font-weight: 500;
  }
  .step-pill.active { background: var(--primary); color: white; }
  .step-pill.done { background: #d1fae5; color: var(--accent-dark); }
  .step-pill.pending { background: #f1f5f9; color: var(--muted); }
  .step-sep { color: var(--muted); font-size: 14px; }

  /* Form elements */
  label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 4px;
  }
  input, select, textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input:focus, select:focus, textarea:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  }
  textarea { resize: none; }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 480px) {
    .form-row { grid-template-columns: 1fr; }
  }
  .form-group { margin-bottom: 12px; }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
    width: 100%;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: var(--primary); color: white; }
  .btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
  .btn-accent { background: var(--accent); color: white; }
  .btn-accent:hover:not(:disabled) { background: var(--accent-dark); }
  .btn-outline {
    background: transparent;
    border: 1px solid var(--border);
    color: #334155;
    width: auto;
  }
  .btn-outline:hover { background: #f8fafc; }
  .btn-link {
    background: none;
    border: none;
    color: var(--primary);
    cursor: pointer;
    font-size: 13px;
    padding: 0;
    width: auto;
    font-family: inherit;
  }
  .btn-link:hover { text-decoration: underline; }

  /* Alert */
  .alert-error {
    background: #fef2f2;
    color: var(--danger);
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 13px;
    margin-bottom: 16px;
  }

  /* Summary bar */
  .summary-bar {
    background: #f1f5f9;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    color: #475569;
  }

  /* Room card */
  .room-card {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    margin-bottom: 12px;
  }
  .room-card-inner {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  @media (max-width: 480px) {
    .room-card-inner { flex-direction: column; }
  }
  .room-info { flex: 1; }
  .room-info h3 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
  .room-info .desc { font-size: 13px; color: var(--muted); }
  .room-info .meta { font-size: 13px; color: var(--muted); margin-top: 6px; }
  .amenities {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .amenity-tag {
    font-size: 11px;
    background: #f1f5f9;
    padding: 2px 8px;
    border-radius: 4px;
    color: #475569;
  }
  .room-pricing {
    text-align: right;
    min-width: 130px;
    flex-shrink: 0;
  }
  .room-pricing .per-night { font-size: 13px; color: var(--muted); }
  .room-pricing .total { font-size: 20px; font-weight: 700; margin: 4px 0; }
  .room-pricing .total-label { font-size: 11px; color: var(--muted); margin-bottom: 8px; }

  /* Booking summary box */
  .booking-summary {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    padding: 12px 14px;
    font-size: 13px;
    margin-bottom: 16px;
  }
  .booking-summary .room-name { font-weight: 600; }
  .booking-summary .dates { color: var(--muted); margin-top: 2px; }
  .booking-summary .price { font-weight: 700; margin-top: 4px; }

  /* Confirmation */
  .confirm-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #d1fae5;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
  }
  .confirm-icon svg { width: 28px; height: 28px; color: var(--accent); }
  .confirm-center { text-align: center; }
  .confirm-center h2 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
  .confirm-center .ref { color: var(--muted); font-size: 14px; margin-bottom: 20px; }
  .confirm-center .ref code { font-family: monospace; font-weight: 700; color: #1e293b; }
  .confirm-details {
    background: #f8fafc;
    border-radius: 6px;
    padding: 14px;
    max-width: 360px;
    margin: 0 auto;
    text-align: left;
    font-size: 13px;
  }
  .confirm-details .row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
  }
  .confirm-details .row .label { color: var(--muted); }
  .confirm-details .row .value { font-weight: 500; }
  .confirm-details .row.total {
    border-top: 1px solid var(--border);
    margin-top: 6px;
    padding-top: 8px;
  }
  .confirm-details .row.total .value { font-weight: 700; }
  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 16px;
  }
  .confirm-email { font-size: 13px; color: var(--muted); margin-top: 16px; }

  /* Check times */
  .check-times {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 16px;
  }

  /* Spinner */
  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  .spinner.dark {
    border-color: rgba(0,0,0,0.1);
    border-top-color: var(--primary);
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .loading-center {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
  }

  .empty-state {
    text-align: center;
    padding: 32px;
    color: var(--muted);
    font-size: 14px;
  }

  .powered-by {
    text-align: center;
    padding: 8px;
    font-size: 11px;
    color: #94a3b8;
    border-top: 1px solid var(--border);
  }
  .powered-by a { color: #64748b; text-decoration: none; }
  .powered-by a:hover { text-decoration: underline; }
`;
