import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * SSRF-hardened fetch helper.
 *
 * Only https URLs are permitted. The target hostname is resolved via DNS and
 * every resolved address is checked against private / loopback / link-local /
 * CGNAT / multicast / reserved / IPv6 ULA ranges (including the cloud metadata
 * address 169.254.169.254). Redirects are followed manually and each hop is
 * re-validated. A request deadline and a response size cap are always enforced.
 *
 * Note: there is an inherent TOCTOU gap because the HTTP client performs its
 * own DNS resolution after we validate. Re-validating every redirect hop and
 * rejecting raw-IP literals keeps the practical risk low; pinning the resolved
 * IP at the socket level would be the next hardening step.
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_MAX_REDIRECTS = 5;

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
}

function ipv4ToLong(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  return (
    ((parts[0]! << 24) >>> 0) +
    ((parts[1]! << 16) >>> 0) +
    ((parts[2]! << 8) >>> 0) +
    (parts[3]! >>> 0)
  );
}

function inV4Cidr(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToLong(ip) & mask) === (ipv4ToLong(base) & mask);
}

function isPrivateIPv4(ip: string): boolean {
  return (
    inV4Cidr(ip, '0.0.0.0', 8) || // "this" network
    inV4Cidr(ip, '10.0.0.0', 8) || // private
    inV4Cidr(ip, '100.64.0.0', 10) || // CGNAT
    inV4Cidr(ip, '127.0.0.0', 8) || // loopback
    inV4Cidr(ip, '169.254.0.0', 16) || // link-local (incl. 169.254.169.254)
    inV4Cidr(ip, '172.16.0.0', 12) || // private
    inV4Cidr(ip, '192.0.0.0', 24) || // IETF protocol assignments
    inV4Cidr(ip, '192.0.2.0', 24) || // TEST-NET-1
    inV4Cidr(ip, '192.168.0.0', 16) || // private
    inV4Cidr(ip, '198.18.0.0', 15) || // benchmarking
    inV4Cidr(ip, '198.51.100.0', 24) || // TEST-NET-2
    inV4Cidr(ip, '203.0.113.0', 24) || // TEST-NET-3
    inV4Cidr(ip, '224.0.0.0', 4) || // multicast
    inV4Cidr(ip, '240.0.0.0', 4) || // reserved
    ip === '255.255.255.255'
  );
}

function isPrivateIPv6(raw: string): boolean {
  let ip = raw.toLowerCase();
  // Strip zone id, e.g. fe80::1%eth0
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);

  if (ip === '::1' || ip === '::') return true;

  // IPv4-mapped / IPv4-compatible (::ffff:a.b.c.d or ::a.b.c.d)
  const mapped = ip.match(/::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIPv4(mapped[1]!);

  const first = ip.split(':')[0] ?? '';
  const head = parseInt(first || '0', 16);
  if (Number.isNaN(head)) return true; // malformed -> reject
  // fc00::/7 unique local
  if ((head & 0xfe00) === 0xfc00) return true;
  // fe80::/10 link-local
  if ((head & 0xffc0) === 0xfe80) return true;
  // ff00::/8 multicast
  if ((head & 0xff00) === 0xff00) return true;

  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // not a valid IP literal -> block
}

/**
 * Synchronous, DNS-free static validation of a URL string. Reusable by DTO
 * validators. Enforces https and rejects raw-IP literals that fall inside a
 * blocked range as well as obvious loopback hostnames.
 */
export function assertSafeUrlStatic(urlStr: string): URL {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new BadRequestException('Invalid URL');
  }

  if (url.protocol !== 'https:') {
    throw new BadRequestException('Only https URLs are allowed');
  }
  if (url.username || url.password) {
    throw new BadRequestException('URLs with credentials are not allowed');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new BadRequestException('URL host is not allowed');
  }

  // If the host is a raw IP literal, validate it statically.
  if (isIP(host) && isBlockedAddress(host)) {
    throw new BadRequestException('URL resolves to a disallowed address');
  }

  return url;
}

/**
 * Full validation: static checks + DNS resolution of the hostname with every
 * resolved address checked against the blocklist.
 */
export async function assertSafeUrl(urlStr: string): Promise<URL> {
  const url = assertSafeUrlStatic(urlStr);
  const host = url.hostname.replace(/^\[|\]$/g, '');

  if (isIP(host)) return url; // already validated statically

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new BadRequestException('Could not resolve URL host');
  }

  if (addresses.length === 0) {
    throw new BadRequestException('Could not resolve URL host');
  }
  for (const a of addresses) {
    if (isBlockedAddress(a.address)) {
      throw new BadRequestException('URL resolves to a disallowed address');
    }
  }

  return url;
}

export async function safeFetch(
  urlStr: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = urlStr;
    let redirects = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await assertSafeUrl(currentUrl);

      const res = await fetch(currentUrl, {
        method: options.method ?? 'GET',
        headers: options.headers,
        redirect: 'manual',
        signal: controller.signal,
      });

      // Manually follow redirects, re-validating each hop.
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) {
          return toSafeResponse(res, maxBytes);
        }
        if (++redirects > maxRedirects) {
          throw new BadRequestException('Too many redirects');
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      return toSafeResponse(res, maxBytes);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new BadRequestException('Request to URL timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function toSafeResponse(res: Response, maxBytes: number): SafeFetchResponse {
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    text: async () => {
      const body = res.body;
      if (!body) return '';
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.length;
          if (total > maxBytes) {
            await reader.cancel();
            throw new BadRequestException('Response exceeds maximum allowed size');
          }
          chunks.push(value);
        }
      }
      return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');
    },
  };
}

@ValidatorConstraint({ name: 'isSafeUrl', async: false })
export class IsSafeUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null) return true; // leave presence to @IsOptional
    if (typeof value !== 'string') return false;
    try {
      assertSafeUrlStatic(value);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'URL must be an https URL that does not point to a private or internal address';
  }
}

export function IsSafeUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSafeUrlConstraint,
    });
  };
}
