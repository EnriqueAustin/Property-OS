'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from './api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface Property {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextType {
  user: User | null;
  property: Property | null;
  properties: Property[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => void;
  selectProperty: (p: Property) => void;
  refreshProperties: () => Promise<Property[]>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProperties = useCallback(async (): Promise<Property[]> => {
    try {
      const res = await api.get<Property[] | { data: Property[] }>('/properties');
      const list = Array.isArray(res) ? res : (res.data || []);
      setProperties(list);
      const saved = typeof window !== 'undefined' ? localStorage.getItem('pos_property_id') : null;
      const match = list.find((p: Property) => p.id === saved) || list[0] || null;
      setProperty(match);
      return list;
    } catch {
      setProperties([]);
      setProperty(null);
      return [];
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const u = await api.get<{ id: string; email: string; first_name: string; last_name: string }>('/auth/me');
      return { id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name };
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Cannot GET /api/auth/me')) {
        throw error;
      }

      const legacy = await api.get<{ userId: string; email: string }>('/auth/profile');
      return { id: legacy.userId, email: legacy.email, firstName: '', lastName: '' };
    }
  }, []);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    loadUser()
      .then((u) => {
        setUser(u);
        return loadProperties();
      })
      .catch(() => {
        api.setToken(null);
      })
      .finally(() => setLoading(false));
  }, [loadProperties, loadUser]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ access_token?: string; tokens?: { accessToken: string; refreshToken: string } }>('/auth/login', { email, password });
    const accessToken = res.tokens?.accessToken ?? res.access_token;
    if (!accessToken) throw new Error('No token received');
    api.setToken(accessToken);
    if (res.tokens?.refreshToken) {
      localStorage.setItem('pos_refresh_token', res.tokens.refreshToken);
    }
    const u = await loadUser();
    setUser(u);
    await loadProperties();
  };

  const register = async (data: { email: string; password: string; firstName: string; lastName: string }) => {
    const res = await api.post<{ tokens?: { accessToken: string; refreshToken: string } }>('/auth/register', {
      email: data.email,
      password: data.password,
      first_name: data.firstName,
      last_name: data.lastName,
    });
    if (res.tokens?.accessToken) {
      api.setToken(res.tokens.accessToken);
      if (res.tokens.refreshToken) {
        localStorage.setItem('pos_refresh_token', res.tokens.refreshToken);
      }
      const u = await loadUser();
      setUser(u);
      await loadProperties();
    } else {
      await login(data.email, data.password);
    }
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
    setProperties([]);
    setProperty(null);
  };

  const selectProperty = (p: Property) => {
    setProperty(p);
    localStorage.setItem('pos_property_id', p.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        property,
        properties,
        loading,
        login,
        register,
        logout,
        selectProperty,
        refreshProperties: loadProperties,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
