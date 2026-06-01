'use client';

import { useEffect, useState } from 'react';
import { Save, Upload, Trash2, Copy, ExternalLink, Check } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const UPLOADS_URL = API_BASE.replace('/api', '/uploads');
function photoUrl(photo: string) {
  return photo.startsWith('http') ? photo : `${UPLOADS_URL}/${photo}`;
}
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const WIDGET_URL = process.env.NEXT_PUBLIC_WIDGET_URL || 'https://cdn.propertyos.co.za/widget.iife.js';

type SettingsTab = 'property' | 'payments' | 'photos' | 'widget' | 'notifications' | 'templates';

interface EmailTemplateRecord {
  id: string;
  template_type: string;
  subject: string;
  body_html: string;
  is_active: boolean;
}

export default function SettingsPage() {
  const { property } = useAuth();
  const [tab, setTab] = useState<SettingsTab>('property');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [templateVars, setTemplateVars] = useState<Record<string, string[]>>({});
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({ subject: '', bodyHtml: '' });

  // Notification settings
  const [notifSettings, setNotifSettings] = useState({
    email_booking_confirmation: true,
    email_owner_new_booking: true,
    email_cancellation: true,
    email_payment_received: true,
    whatsapp_booking_confirmation: false,
    whatsapp_owner_new_booking: false,
    email_pre_arrival: true,
    pre_arrival_days_before: 1,
    email_post_stay_review: true,
    post_stay_days_after: 1,
    whatsapp_check_in_info: false,
    wifi_name: '',
    wifi_password: '',
    directions: '',
  });

  // Property settings
  const [propForm, setPropForm] = useState({
    name: '', description: '', email: '', phone: '',
    check_in_time: '14:00', check_out_time: '10:00',
    min_stay_nights: 1, deposit_required: false, deposit_percentage: 0,
    cancellation_policy: '',
    google_analytics_id: '',
    wifi_name: '',
    wifi_password: '',
    house_rules: '',
    local_tips: '',
    emergency_contact: '',
  });

  // Payment settings
  const [payForm, setPayForm] = useState({
    payfastMerchantId: '', payfastMerchantKey: '', payfastPassphrase: '',
    payfastSandbox: true, payfastEnabled: false,
    eftEnabled: false, eftBankName: '', eftAccountHolder: '',
    eftAccountNumber: '', eftBranchCode: '', eftAccountType: 'cheque',
  });

  useEffect(() => {
    if (!property) return;
    api.get<any>(`/properties/${property.id}`)
      .then((p) => {
        setPropForm({
          name: p.name || '', description: p.description || '',
          email: p.email || '', phone: p.phone || '',
          check_in_time: p.check_in_time || '14:00',
          check_out_time: p.check_out_time || '10:00',
          min_stay_nights: p.min_stay_nights || 1,
          deposit_required: p.deposit_required || false,
          deposit_percentage: p.deposit_percentage || 0,
          cancellation_policy: p.cancellation_policy || '',
          google_analytics_id: p.google_analytics_id || '',
          wifi_name: p.wifi_name || '',
          wifi_password: p.wifi_password || '',
          house_rules: p.house_rules || '',
          local_tips: p.local_tips || '',
          emergency_contact: p.emergency_contact || '',
        });
        setPhotos(p.photos || []);
      })
      .catch(() => {});

    api.get<any>(`/properties/${property.id}/payment-settings`)
      .then((s) => setPayForm({
        payfastMerchantId: s.payfast_merchant_id || '',
        payfastMerchantKey: s.payfast_merchant_key || '',
        payfastPassphrase: s.payfast_passphrase || '',
        payfastSandbox: s.payfast_sandbox ?? true,
        payfastEnabled: s.payfast_enabled ?? false,
        eftEnabled: s.eft_enabled ?? false,
        eftBankName: s.eft_bank_name || '',
        eftAccountHolder: s.eft_account_holder || '',
        eftAccountNumber: s.eft_account_number || '',
        eftBranchCode: s.eft_branch_code || '',
        eftAccountType: s.eft_account_type || 'cheque',
      }))
      .catch(() => {});

    api.get<any>(`/properties/${property.id}/settings/notifications`)
      .then((s) => setNotifSettings({
        email_booking_confirmation: s.email_booking_confirmation ?? true,
        email_owner_new_booking: s.email_owner_new_booking ?? true,
        email_cancellation: s.email_cancellation ?? true,
        email_payment_received: s.email_payment_received ?? true,
        whatsapp_booking_confirmation: s.whatsapp_booking_confirmation ?? false,
        whatsapp_owner_new_booking: s.whatsapp_owner_new_booking ?? false,
        email_pre_arrival: s.email_pre_arrival ?? true,
        pre_arrival_days_before: s.pre_arrival_days_before ?? 1,
        email_post_stay_review: s.email_post_stay_review ?? true,
        post_stay_days_after: s.post_stay_days_after ?? 1,
        whatsapp_check_in_info: s.whatsapp_check_in_info ?? false,
        wifi_name: s.wifi_name || '',
        wifi_password: s.wifi_password || '',
        directions: s.directions || '',
      }))
      .catch(() => {});

    api.get<EmailTemplateRecord[]>(`/properties/${property.id}/email-templates`)
      .then((t) => setTemplates(Array.isArray(t) ? t : []))
      .catch(() => {});

    api.get<Record<string, string[]>>(`/properties/${property.id}/email-templates/variables`)
      .then((v) => setTemplateVars(v || {}))
      .catch(() => {});
  }, [property]);

  const saveProperty = async () => {
    if (!property) return;
    setSaving(true);
    try {
      await api.patch(`/properties/${property.id}`, propForm);
      setMessage('Property settings saved!');
    } catch (err: any) {
      setMessage(err.message);
    }
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const savePayment = async () => {
    if (!property) return;
    setSaving(true);
    try {
      await api.patch(`/properties/${property.id}/payment-settings`, payForm);
      setMessage('Payment settings saved!');
    } catch (err: any) {
      setMessage(err.message);
    }
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const saveNotifications = async () => {
    if (!property) return;
    setSaving(true);
    try {
      await api.patch(`/properties/${property.id}/settings/notifications`, notifSettings);
      setMessage('Notification settings saved!');
    } catch (err: any) {
      setMessage(err.message);
    }
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const bookingPageUrl = property?.slug ? `${APP_URL}/book/${property.slug}` : '';
  const embedCode = property?.slug
    ? `<script src="${WIDGET_URL}"></script>\n<booking-widget property-slug="${property.slug}" api-url="${API_BASE}"></booking-widget>`
    : '';

  const copyText = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const uploadPropertyPhotos = async (files: FileList) => {
    if (!property) return;
    setUploadingPhotos(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append('files', f));
      const res = await fetch(`${API_BASE}/properties/${property.id}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('pos_token')}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      setPhotos(json.data?.photos ?? json.photos ?? []);
      setMessage('Photos uploaded!');
    } catch (err: any) {
      setMessage(err.message);
    }
    setUploadingPhotos(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const deletePropertyPhoto = async (filename: string) => {
    if (!property) return;
    try {
      await api.delete(`/properties/${property.id}/photos/${filename}`);
      setPhotos((prev) => prev.filter((p) => p !== filename));
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-accent/10 text-accent text-sm">{message}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 overflow-x-auto">
        {([
          ['property', 'Property'],
          ['payments', 'Payments'],
          ['photos', 'Photos'],
          ['widget', 'Booking Widget'],
          ['notifications', 'Notifications'],
          ['templates', 'Email Templates'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition whitespace-nowrap ${tab === key ? 'bg-white shadow-sm' : 'text-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'property' && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-4">
          <div>
            <label className={labelClass}>Property Name</label>
            <input value={propForm.name} onChange={(e) => setPropForm({ ...propForm, name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={propForm.description} onChange={(e) => setPropForm({ ...propForm, description: e.target.value })} rows={3} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email</label>
              <input value={propForm.email} onChange={(e) => setPropForm({ ...propForm, email: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input value={propForm.phone} onChange={(e) => setPropForm({ ...propForm, phone: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Check-in Time</label>
              <input type="time" value={propForm.check_in_time} onChange={(e) => setPropForm({ ...propForm, check_in_time: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Check-out Time</label>
              <input type="time" value={propForm.check_out_time} onChange={(e) => setPropForm({ ...propForm, check_out_time: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Min Stay (nights)</label>
            <input type="number" min={1} value={propForm.min_stay_nights} onChange={(e) => setPropForm({ ...propForm, min_stay_nights: Number(e.target.value) })} className={inputClass} />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={propForm.deposit_required} onChange={(e) => setPropForm({ ...propForm, deposit_required: e.target.checked })} className="rounded" />
            <label className="text-sm">Require deposit</label>
            {propForm.deposit_required && (
              <input type="number" min={0} max={100} value={propForm.deposit_percentage} onChange={(e) => setPropForm({ ...propForm, deposit_percentage: Number(e.target.value) })} className="w-20 px-2 py-1 border border-border rounded text-sm" placeholder="%" />
            )}
          </div>
          <div>
            <label className={labelClass}>Cancellation Policy</label>
            <textarea value={propForm.cancellation_policy} onChange={(e) => setPropForm({ ...propForm, cancellation_policy: e.target.value })} rows={2} className={inputClass} />
          </div>

          <div className="border-t border-border pt-6 mt-6">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">Google Analytics</h4>
            <div>
              <label className={labelClass}>GA Measurement ID</label>
              <input value={propForm.google_analytics_id} onChange={(e) => setPropForm({ ...propForm, google_analytics_id: e.target.value })} placeholder="G-XXXXXXXXXX" className={inputClass} />
              <p className="text-xs text-muted mt-1">Track booking conversions on your public booking page.</p>
            </div>
          </div>

          <div className="border-t border-border pt-6 mt-6">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">Digital Guestbook</h4>
            <p className="text-xs text-muted mb-3">This info is shown to guests via the guestbook QR code.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>WiFi Name</label>
                <input value={propForm.wifi_name} onChange={(e) => setPropForm({ ...propForm, wifi_name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>WiFi Password</label>
                <input value={propForm.wifi_password} onChange={(e) => setPropForm({ ...propForm, wifi_password: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass}>House Rules</label>
              <textarea value={propForm.house_rules} onChange={(e) => setPropForm({ ...propForm, house_rules: e.target.value })} rows={3} placeholder="Check-out by 10:00, no smoking indoors..." className={inputClass} />
            </div>
            <div className="mt-4">
              <label className={labelClass}>Local Tips</label>
              <textarea value={propForm.local_tips} onChange={(e) => setPropForm({ ...propForm, local_tips: e.target.value })} rows={3} placeholder="Best restaurants, attractions, transport..." className={inputClass} />
            </div>
            <div className="mt-4">
              <label className={labelClass}>Emergency Contact</label>
              <input value={propForm.emergency_contact} onChange={(e) => setPropForm({ ...propForm, emergency_contact: e.target.value })} placeholder="Manager: 082 123 4567" className={inputClass} />
            </div>
          </div>

          <button onClick={saveProperty} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
            <Save size={16} /> Save
          </button>
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-6">
          {/* PayFast */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-6">
            <h3 className="font-semibold mb-4">PayFast</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <input type="checkbox" checked={payForm.payfastEnabled} onChange={(e) => setPayForm({ ...payForm, payfastEnabled: e.target.checked })} className="rounded" />
                <label className="text-sm font-medium">Enable PayFast</label>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <input type="checkbox" checked={payForm.payfastSandbox} onChange={(e) => setPayForm({ ...payForm, payfastSandbox: e.target.checked })} className="rounded" />
                <label className="text-sm">Sandbox mode (testing)</label>
              </div>
              <div>
                <label className={labelClass}>Merchant ID</label>
                <input value={payForm.payfastMerchantId} onChange={(e) => setPayForm({ ...payForm, payfastMerchantId: e.target.value })} className={inputClass} placeholder="From PayFast dashboard" />
              </div>
              <div>
                <label className={labelClass}>Merchant Key</label>
                <input value={payForm.payfastMerchantKey} onChange={(e) => setPayForm({ ...payForm, payfastMerchantKey: e.target.value })} className={inputClass} placeholder="From PayFast dashboard" />
              </div>
              <div>
                <label className={labelClass}>Passphrase</label>
                <input type="password" value={payForm.payfastPassphrase} onChange={(e) => setPayForm({ ...payForm, payfastPassphrase: e.target.value })} className={inputClass} />
              </div>
            </div>
          </div>

          {/* EFT */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-6">
            <h3 className="font-semibold mb-4">EFT / Bank Transfer</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <input type="checkbox" checked={payForm.eftEnabled} onChange={(e) => setPayForm({ ...payForm, eftEnabled: e.target.checked })} className="rounded" />
                <label className="text-sm font-medium">Enable EFT</label>
              </div>
              <div>
                <label className={labelClass}>Bank Name</label>
                <input value={payForm.eftBankName} onChange={(e) => setPayForm({ ...payForm, eftBankName: e.target.value })} className={inputClass} placeholder="e.g. FNB, Standard Bank" />
              </div>
              <div>
                <label className={labelClass}>Account Holder</label>
                <input value={payForm.eftAccountHolder} onChange={(e) => setPayForm({ ...payForm, eftAccountHolder: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Account Number</label>
                  <input value={payForm.eftAccountNumber} onChange={(e) => setPayForm({ ...payForm, eftAccountNumber: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Branch Code</label>
                  <input value={payForm.eftBranchCode} onChange={(e) => setPayForm({ ...payForm, eftBranchCode: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Account Type</label>
                <select value={payForm.eftAccountType} onChange={(e) => setPayForm({ ...payForm, eftAccountType: e.target.value })} className={inputClass}>
                  <option value="cheque">Cheque</option>
                  <option value="savings">Savings</option>
                </select>
              </div>
            </div>
          </div>

          <button onClick={savePayment} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
            <Save size={16} /> Save Payment Settings
          </button>
        </div>
      )}

      {tab === 'photos' && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-semibold mb-2">Property Photos</h3>
          <p className="text-sm text-muted mb-4">Upload photos of your property. These appear on your public booking page.</p>

          <div className="flex flex-wrap gap-4 mb-4">
            {photos.map((photo) => (
              <div key={photo} className="relative group w-32 h-32 rounded-lg overflow-hidden border border-border">
                <img src={photoUrl(photo)} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => deletePropertyPhoto(photo)}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <Trash2 size={14} className="text-danger" />
                </button>
              </div>
            ))}

            <label className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
              <Upload size={22} className="text-muted mb-1" />
              <span className="text-xs text-muted">{uploadingPhotos ? 'Uploading...' : 'Add photos'}</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files && uploadPropertyPhotos(e.target.files)}
                disabled={uploadingPhotos}
              />
            </label>
          </div>

          <p className="text-xs text-muted">Accepted formats: JPG, PNG, WebP. Max 5MB per file.</p>
        </div>
      )}

      {tab === 'widget' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-border shadow-sm p-6">
            <h3 className="font-semibold mb-2">Direct Booking Page</h3>
            <p className="text-sm text-muted mb-4">Share this link with guests so they can book directly.</p>
            <div className="flex items-center gap-2">
              <input value={bookingPageUrl} readOnly className={`${inputClass} bg-slate-50 font-mono text-sm`} />
              <button onClick={() => copyText(bookingPageUrl, setCopiedLink)} className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50 whitespace-nowrap">
                {copiedLink ? <><Check size={14} className="text-accent" /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
              <a href={bookingPageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-slate-50 whitespace-nowrap">
                <ExternalLink size={14} /> Open
              </a>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border shadow-sm p-6">
            <h3 className="font-semibold mb-2">Embed on Your Website</h3>
            <p className="text-sm text-muted mb-4">Add this code to your website to display the booking widget.</p>
            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">{embedCode}</pre>
              <button
                onClick={() => copyText(embedCode, setCopiedEmbed)}
                className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs"
              >
                {copiedEmbed ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border shadow-sm p-6">
            <h3 className="font-semibold mb-2">Preview</h3>
            <p className="text-sm text-muted mb-4">This is how the booking widget looks to your guests.</p>
            <div className="border border-border rounded-lg overflow-hidden">
              <iframe
                src={bookingPageUrl}
                className="w-full border-0"
                style={{ height: '500px' }}
                title="Booking widget preview"
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-semibold mb-1">Notification Preferences</h3>
          <p className="text-sm text-muted mb-6">Choose which notifications are sent automatically when booking events occur.</p>

          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Email Notifications</h4>
              <div className="space-y-3">
                {([
                  ['email_booking_confirmation', 'Booking Confirmation', 'Sent to guest after a booking is confirmed'],
                  ['email_owner_new_booking', 'New Booking Alert', 'Sent to you when a new booking comes in'],
                  ['email_cancellation', 'Cancellation Notice', 'Sent to guest and you when a booking is cancelled'],
                  ['email_payment_received', 'Payment Received', 'Sent to guest when payment is processed'],
                ] as const).map(([key, label, desc]) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifSettings[key]}
                      onChange={(e) => setNotifSettings({ ...notifSettings, [key]: e.target.checked })}
                      className="rounded mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">WhatsApp Notifications</h4>
              <div className="space-y-3">
                {([
                  ['whatsapp_booking_confirmation', 'Booking Confirmation', 'Sent to guest via WhatsApp after booking'],
                  ['whatsapp_owner_new_booking', 'New Booking Alert', 'Sent to you via WhatsApp when a booking comes in'],
                ] as const).map(([key, label, desc]) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifSettings[key]}
                      onChange={(e) => setNotifSettings({ ...notifSettings, [key]: e.target.checked })}
                      className="rounded mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted mt-3 bg-slate-50 rounded-lg p-3">
                WhatsApp notifications require a WhatsApp Business API provider to be configured. Contact support for setup.
              </p>
            </div>

            <hr className="border-border" />

            {/* Automated notifications */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Automated Guest Communications</h4>
              <p className="text-xs text-muted mb-3">These are sent automatically on a schedule based on check-in/check-out dates.</p>
              <div className="space-y-4">
                <div className="p-4 border border-border rounded-lg space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifSettings.email_pre_arrival}
                      onChange={(e) => setNotifSettings({ ...notifSettings, email_pre_arrival: e.target.checked })}
                      className="rounded mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium">Pre-Arrival Email</div>
                      <div className="text-xs text-muted">Sent to guest before check-in with property info, directions, and WiFi</div>
                    </div>
                  </label>
                  {notifSettings.email_pre_arrival && (
                    <div className="ml-7">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Days before check-in</label>
                      <select
                        value={notifSettings.pre_arrival_days_before}
                        onChange={(e) => setNotifSettings({ ...notifSettings, pre_arrival_days_before: parseInt(e.target.value) })}
                        className="px-2 py-1 border border-border rounded text-sm w-32"
                      >
                        {[1, 2, 3, 5, 7].map((d) => (
                          <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="p-4 border border-border rounded-lg space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifSettings.email_post_stay_review}
                      onChange={(e) => setNotifSettings({ ...notifSettings, email_post_stay_review: e.target.checked })}
                      className="rounded mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium">Post-Stay Review Request</div>
                      <div className="text-xs text-muted">Sent to guest after check-out asking for feedback</div>
                    </div>
                  </label>
                  {notifSettings.email_post_stay_review && (
                    <div className="ml-7">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Days after check-out</label>
                      <select
                        value={notifSettings.post_stay_days_after}
                        onChange={(e) => setNotifSettings({ ...notifSettings, post_stay_days_after: parseInt(e.target.value) })}
                        className="px-2 py-1 border border-border rounded text-sm w-32"
                      >
                        {[1, 2, 3, 5, 7].map((d) => (
                          <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="p-4 border border-border rounded-lg space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifSettings.whatsapp_check_in_info}
                      onChange={(e) => setNotifSettings({ ...notifSettings, whatsapp_check_in_info: e.target.checked })}
                      className="rounded mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium">WhatsApp Check-in Info</div>
                      <div className="text-xs text-muted">Auto-send directions, WiFi, and check-in details via WhatsApp</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <hr className="border-border" />

            {/* Guest info for automated messages */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Check-in Information</h4>
              <p className="text-xs text-muted mb-3">This info is included in pre-arrival emails and WhatsApp check-in messages.</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>WiFi Network Name</label>
                    <input
                      value={notifSettings.wifi_name}
                      onChange={(e) => setNotifSettings({ ...notifSettings, wifi_name: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. GuestWiFi"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>WiFi Password</label>
                    <input
                      value={notifSettings.wifi_password}
                      onChange={(e) => setNotifSettings({ ...notifSettings, wifi_password: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. Welcome123"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Directions / How to Find Us</label>
                  <textarea
                    value={notifSettings.directions}
                    onChange={(e) => setNotifSettings({ ...notifSettings, directions: e.target.value })}
                    rows={3}
                    className={inputClass}
                    placeholder="e.g. Turn right at the main gate, unit 5 on the left..."
                  />
                </div>
              </div>
            </div>
          </div>

          <button onClick={saveNotifications} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 mt-6">
            <Save size={16} /> Save Notification Settings
          </button>
        </div>
      )}

      {tab === 'templates' && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-semibold mb-1">Email Templates</h3>
          <p className="text-sm text-muted mb-6">Customize the emails sent to guests and staff. Use {'{{variableName}}'} for dynamic content.</p>

          <div className="space-y-4">
            {Object.entries(templateVars).map(([type, vars]) => {
              const existing = templates.find((t) => t.template_type === type);
              const isEditing = editingTemplate === type;
              return (
                <div key={type} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-semibold capitalize">{type.replace(/_/g, ' ')}</h4>
                      <p className="text-xs text-muted">
                        {existing ? 'Custom template' : 'Using default template'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingTemplate(null);
                        } else {
                          setEditingTemplate(type);
                          setTemplateForm({
                            subject: existing?.subject || '',
                            bodyHtml: existing?.body_html || '',
                          });
                        }
                      }}
                      className="text-sm text-primary hover:underline"
                    >
                      {isEditing ? 'Cancel' : existing ? 'Edit' : 'Customize'}
                    </button>
                  </div>

                  {isEditing && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className={labelClass}>Subject Line</label>
                        <input
                          value={templateForm.subject}
                          onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                          className={inputClass}
                          placeholder={`e.g. Booking Confirmed — {{referenceNumber}}`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Email Body (HTML)</label>
                        <textarea
                          value={templateForm.bodyHtml}
                          onChange={(e) => setTemplateForm({ ...templateForm, bodyHtml: e.target.value })}
                          rows={8}
                          className={inputClass + ' font-mono text-xs'}
                          placeholder="<p>Dear {{guestName}},</p><p>Your booking at {{propertyName}} is confirmed.</p>"
                        />
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-600 mb-1">Available variables:</p>
                        <div className="flex flex-wrap gap-1">
                          {vars.map((v) => (
                            <code key={v} className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600 cursor-pointer hover:bg-primary/5"
                              onClick={() => {
                                setTemplateForm({ ...templateForm, bodyHtml: templateForm.bodyHtml + `{{${v}}}` });
                              }}
                            >
                              {`{{${v}}}`}
                            </code>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (!property || !templateForm.subject || !templateForm.bodyHtml) return;
                            setSaving(true);
                            try {
                              await api.put(`/properties/${property.id}/email-templates/${type}`, templateForm);
                              const t = await api.get<EmailTemplateRecord[]>(`/properties/${property.id}/email-templates`);
                              setTemplates(Array.isArray(t) ? t : []);
                              setEditingTemplate(null);
                              setMessage('Template saved!');
                              setTimeout(() => setMessage(''), 3000);
                            } catch (err: any) {
                              setMessage(err.message);
                            }
                            setSaving(false);
                          }}
                          disabled={saving}
                          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                        >
                          Save Template
                        </button>
                        {existing && (
                          <button
                            onClick={async () => {
                              if (!property) return;
                              await api.delete(`/properties/${property.id}/email-templates/${existing.id}`);
                              const t = await api.get<EmailTemplateRecord[]>(`/properties/${property.id}/email-templates`);
                              setTemplates(Array.isArray(t) ? t : []);
                              setEditingTemplate(null);
                              setMessage('Reset to default template');
                              setTimeout(() => setMessage(''), 3000);
                            }}
                            className="px-4 py-2 text-sm text-danger hover:text-danger/80"
                          >
                            Reset to Default
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
