'use client';

import { useEffect, useState } from 'react';
import { Wifi, BookOpen, MapPin, Phone, Clock, AlertCircle, Home } from 'lucide-react';
import { useParams } from 'next/navigation';
import { formatTime } from '../../lib/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Guestbook {
  propertyName: string;
  wifiName: string | null;
  wifiPassword: string | null;
  houseRules: string | null;
  localTips: string | null;
  emergencyContact: string | null;
  checkInTime: string;
  checkOutTime: string;
  address: string;
  phone: string | null;
}

export default function GuestbookPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<Guestbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/public/properties/${slug}/guestbook`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Property not found');
        const json = await res.json();
        setData(json.data || json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-600">Property not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Home className="w-10 h-10 text-blue-600 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-slate-900">{data.propertyName}</h1>
          <p className="text-slate-500 text-sm mt-1">Welcome! Here&apos;s everything you need.</p>
        </div>

        <div className="space-y-4">
          {(data.wifiName || data.wifiPassword) && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Wifi className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="font-semibold text-slate-900">WiFi</h2>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                {data.wifiName && (
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wide">Network</span>
                    <p className="font-mono font-semibold text-lg">{data.wifiName}</p>
                  </div>
                )}
                {data.wifiPassword && (
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wide">Password</span>
                    <p className="font-mono font-semibold text-lg">{data.wifiPassword}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="font-semibold text-slate-900">Times</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <span className="text-xs text-slate-500">Check-in</span>
                <p className="font-semibold text-lg">{formatTime(data.checkInTime)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <span className="text-xs text-slate-500">Check-out</span>
                <p className="font-semibold text-lg">{formatTime(data.checkOutTime)}</p>
              </div>
            </div>
          </div>

          {data.houseRules && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <BookOpen className="w-5 h-5 text-amber-600" />
                </div>
                <h2 className="font-semibold text-slate-900">House Rules</h2>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{data.houseRules}</p>
            </div>
          )}

          {data.localTips && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-xl">
                  <MapPin className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="font-semibold text-slate-900">Local Tips</h2>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{data.localTips}</p>
            </div>
          )}

          {(data.emergencyContact || data.phone) && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-100 rounded-xl">
                  <Phone className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="font-semibold text-slate-900">Contact</h2>
              </div>
              <div className="space-y-2 text-sm">
                {data.emergencyContact && (
                  <div className="bg-red-50 rounded-xl p-3">
                    <span className="text-xs text-red-500 uppercase tracking-wide">Emergency</span>
                    <p className="font-semibold text-red-800">{data.emergencyContact}</p>
                  </div>
                )}
                {data.phone && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="text-xs text-slate-500 uppercase tracking-wide">Reception</span>
                    <p className="font-semibold">{data.phone}</p>
                  </div>
                )}
                {data.address && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <span className="text-xs text-slate-500 uppercase tracking-wide">Address</span>
                    <p className="text-slate-700">{data.address}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-8 text-xs text-slate-400">
          Powered by PropertyOS
        </div>
      </div>
    </div>
  );
}
