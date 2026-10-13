'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { formatCurrency, formatDate } from '../../../lib/format';
import { Printer } from 'lucide-react';

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  currency: string;
  amount_paid: number;
  line_items: InvoiceLineItem[];
  guest_details: { name: string; email: string; phone?: string; address?: string };
  property_details: { name: string; address: string; email?: string; phone?: string; vat_number?: string };
  booking?: { reference_number: string; check_in: string; check_out: string; nights: number };
}

export default function InvoicePrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const propertyId = searchParams.get('propertyId');
    const bookingId = searchParams.get('bookingId');
    if (!propertyId || !bookingId) {
      setError('Missing property or booking ID');
      return;
    }
    api.get<InvoiceData>(`/properties/${propertyId}/bookings/${bookingId}/invoice`)
      .then((data) => setInvoice(data))
      .catch((err: any) => setError(err.message || 'Failed to load invoice'));
  }, [params, searchParams]);

  if (error) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-danger">{error}</p></div>;
  }
  if (!invoice) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-slate-500">Loading invoice...</p></div>;
  }

  const balanceDue = Number(invoice.total) - Number(invoice.amount_paid);
  const typeLabel = invoice.invoice_type === 'credit_note' ? 'CREDIT NOTE' : invoice.invoice_type === 'proforma' ? 'PROFORMA INVOICE' : 'TAX INVOICE';
  const statusColors: Record<string, string> = {
    paid: 'text-green-700 bg-green-50',
    issued: 'text-blue-700 bg-blue-50',
    partially_paid: 'text-amber-700 bg-amber-50',
    overdue: 'text-red-700 bg-red-50',
    cancelled: 'text-slate-500 bg-slate-100',
  };

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-slate-900">Invoice {invoice.invoice_number}</h1>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      <div className="max-w-[800px] mx-auto my-8 print:my-0 bg-white shadow-lg print:shadow-none p-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{invoice.property_details.name}</h2>
            <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">{invoice.property_details.address}</p>
            {invoice.property_details.phone && <p className="text-sm text-slate-500">{invoice.property_details.phone}</p>}
            {invoice.property_details.email && <p className="text-sm text-slate-500">{invoice.property_details.email}</p>}
            {invoice.property_details.vat_number && <p className="text-sm text-slate-500">VAT: {invoice.property_details.vat_number}</p>}
          </div>
          <div className="text-right">
            <h3 className="text-xl font-bold text-slate-900">{typeLabel}</h3>
            <p className="text-sm text-slate-500 mt-1">#{invoice.invoice_number}</p>
            <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium uppercase ${statusColors[invoice.status] || 'text-slate-600 bg-slate-100'}`}>
              {invoice.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Bill To + Dates */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Bill To</p>
            <p className="font-medium text-slate-900">{invoice.guest_details.name}</p>
            {invoice.guest_details.email && <p className="text-sm text-slate-500">{invoice.guest_details.email}</p>}
            {invoice.guest_details.phone && <p className="text-sm text-slate-500">{invoice.guest_details.phone}</p>}
          </div>
          <div className="text-right">
            <div className="space-y-1">
              <p className="text-sm"><span className="text-slate-400">Issue Date:</span> <span className="text-slate-900">{formatDate(invoice.issue_date)}</span></p>
              <p className="text-sm"><span className="text-slate-400">Due Date:</span> <span className="text-slate-900">{formatDate(invoice.due_date)}</span></p>
              {invoice.booking && (
                <>
                  <p className="text-sm"><span className="text-slate-400">Booking Ref:</span> <span className="font-mono text-slate-900">{invoice.booking.reference_number}</span></p>
                  <p className="text-sm"><span className="text-slate-400">Stay:</span> <span className="text-slate-900">{formatDate(invoice.booking.check_in)} — {formatDate(invoice.booking.check_out)}</span></p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="text-left py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
              <th className="text-right py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-20">Qty</th>
              <th className="text-right py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">Unit Price</th>
              <th className="text-right py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.line_items.map((item, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-3 text-sm text-slate-700">{item.description}</td>
                <td className="py-3 text-sm text-slate-700 text-right">{item.quantity}</td>
                <td className="py-3 text-sm text-slate-700 text-right">{formatCurrency(item.unit_price, invoice.currency)}</td>
                <td className="py-3 text-sm text-slate-900 font-medium text-right">{formatCurrency(item.total, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal (excl. VAT)</span>
              <span className="text-slate-900">{formatCurrency(Number(invoice.subtotal) - Number(invoice.vat_amount), invoice.currency)}</span>
            </div>
            {Number(invoice.vat_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">VAT ({invoice.vat_rate}%)</span>
                <span className="text-slate-900">{formatCurrency(Number(invoice.vat_amount), invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2">
              <span className="text-slate-900">Total</span>
              <span className="text-slate-900">{formatCurrency(Number(invoice.total), invoice.currency)}</span>
            </div>
            {Number(invoice.amount_paid) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount Paid</span>
                <span className="text-green-600">-{formatCurrency(Number(invoice.amount_paid), invoice.currency)}</span>
              </div>
            )}
            {balanceDue > 0 && (
              <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2">
                <span className="text-slate-900">Balance Due</span>
                <span className="text-red-600">{formatCurrency(balanceDue, invoice.currency)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          <p>Thank you for your stay at {invoice.property_details.name}</p>
          <p className="mt-1">Generated by PropertyOS</p>
        </div>
      </div>
    </div>
  );
}
