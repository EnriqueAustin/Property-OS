import * as crypto from 'crypto';
import axios from 'axios';

export interface PayfastPayload {
  merchant_id: string;
  merchant_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  name_first: string;
  name_last: string;
  email_address: string;
  m_payment_id: string;
  amount: string;
  item_name: string;
  item_description?: string;
}

const PAYFAST_LIVE_URL = 'https://www.payfast.co.za/eng/process';
const PAYFAST_SANDBOX_URL = 'https://sandbox.payfast.co.za/eng/process';

const PAYFAST_LIVE_VALIDATE_URL = 'https://www.payfast.co.za/eng/query/validate';
const PAYFAST_SANDBOX_VALIDATE_URL =
  'https://sandbox.payfast.co.za/eng/query/validate';

export function buildPayfastRedirectUrl(
  payload: PayfastPayload,
  passphrase: string | null,
  sandbox: boolean,
): { url: string; signature: string } {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined && v !== null && v !== '') {
      params[k] = String(v).trim();
    }
  }

  const paramString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  const signatureInput = passphrase
    ? `${paramString}&passphrase=${encodeURIComponent(passphrase)}`
    : paramString;

  const signature = crypto
    .createHash('md5')
    .update(signatureInput)
    .digest('hex');

  const baseUrl = sandbox ? PAYFAST_SANDBOX_URL : PAYFAST_LIVE_URL;

  return { url: `${baseUrl}?${paramString}&signature=${signature}`, signature };
}

export function verifyPayfastSignature(
  data: Record<string, string>,
  passphrase: string | null,
): boolean {
  const receivedSignature = data.signature;
  if (!receivedSignature) return false;

  const params = { ...data };
  delete params.signature;

  const paramString = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v).trim())}`)
    .join('&');

  const signatureInput = passphrase
    ? `${paramString}&passphrase=${encodeURIComponent(passphrase)}`
    : paramString;

  const expected = crypto
    .createHash('md5')
    .update(signatureInput)
    .digest('hex');

  return expected === receivedSignature;
}

/**
 * Server-to-server confirmation that an ITN really originated from PayFast.
 * PayFast's docs require posting the received data back to the validate
 * endpoint and treating the payment as genuine only when the response is
 * "VALID". Returns false on any error or non-VALID response.
 */
export async function validatePayfastItn(
  data: Record<string, string>,
  sandbox: boolean,
): Promise<boolean> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) {
      params.append(k, String(v));
    }
  }

  const url = sandbox ? PAYFAST_SANDBOX_VALIDATE_URL : PAYFAST_LIVE_VALIDATE_URL;

  try {
    const res = await axios.post(url, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });
    const text = typeof res.data === 'string' ? res.data : String(res.data);
    const firstLine = text.trim().split(/\r?\n/)[0].trim().toUpperCase();
    return firstLine === 'VALID';
  } catch {
    return false;
  }
}

export function isValidPayfastHost(ip: string): boolean {
  const validHosts = [
    '197.97.145.144',
    '197.97.145.145',
    '197.97.145.146',
    '197.97.145.147',
    '197.97.145.148',
    '197.97.145.149',
    '41.74.179.194',
    '41.74.179.195',
    '41.74.179.196',
    '41.74.179.197',
    '127.0.0.1', // local dev
  ];
  return validHosts.includes(ip);
}
