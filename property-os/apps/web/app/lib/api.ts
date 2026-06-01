const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (typeof window === 'undefined') return;
    if (token) {
      localStorage.setItem('pos_token', token);
    } else {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_refresh_token');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('pos_token');
    }
    return this.token;
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('pos_refresh_token') : null;
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const json = await res.json();
      const data = json?.data || json;
      this.setToken(data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('pos_refresh_token', data.refreshToken);
      }
      return true;
    } catch {
      return false;
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res = await fetch(`${API_URL}${path}`, { ...options, headers });

    if (res.status === 401 && token) {
      if (!this.refreshPromise) {
        this.refreshPromise = this.tryRefresh().then((ok) => {
          this.refreshPromise = null;
          if (!ok) throw new Error('refresh_failed');
        });
      }
      try {
        await this.refreshPromise;
        headers['Authorization'] = `Bearer ${this.getToken()}`;
        res = await fetch(`${API_URL}${path}`, { ...options, headers });
      } catch {
        this.setToken(null);
        if (typeof window !== 'undefined') {
          const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?expired=1&returnTo=${returnTo}`;
        }
        throw new Error('Session expired — please sign in again');
      }
    }

    if (res.status === 401) {
      this.setToken(null);
      if (typeof window !== 'undefined') {
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?expired=1&returnTo=${returnTo}`;
      }
      throw new Error('Session expired — please sign in again');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const details = body.error?.details;
      const msg = details && Array.isArray(details) ? details.join(', ') : (body.error?.message || body.message || `Request failed: ${res.status}`);
      throw new Error(msg);
    }

    if (res.status === 204) return undefined as T;
    const json = await res.json();
    if (json && typeof json === 'object' && 'success' in json) {
      if ('meta' in json) return { data: json.data, meta: json.meta } as T;
      return json.data as T;
    }
    return json;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
