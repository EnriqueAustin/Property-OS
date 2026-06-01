'use client';

import { useEffect, useState } from 'react';
import { Star, MessageSquare, Eye, EyeOff, Send } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';

interface Review {
  id: string;
  booking_id: string;
  guest_id: string;
  overall_rating: number;
  cleanliness_rating: number | null;
  comfort_rating: number | null;
  location_rating: number | null;
  value_rating: number | null;
  service_rating: number | null;
  comment: string | null;
  owner_response: string | null;
  responded_at: string | null;
  status: 'pending' | 'published' | 'hidden';
  created_at: string;
  guest?: { first_name: string; last_name: string; email: string };
  booking?: { reference_number: string; check_in: string; check_out: string };
}

interface ReviewSummary {
  totalReviews: number;
  averageOverall: number;
  averageCleanliness: number;
  averageComfort: number;
  averageLocation: number;
  averageValue: number;
  averageService: number;
  distribution: { rating: number; count: number }[];
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const { property } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'hidden'>('all');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState('');

  const fetchData = async () => {
    if (!property) return;
    try {
      const [reviewResult, summaryData] = await Promise.all([
        api.get<{ data: Review[]; meta: any }>(`/properties/${property.id}/reviews${filter !== 'all' ? `?status=${filter}` : ''}`),
        api.get<ReviewSummary>(`/properties/${property.id}/reviews/summary`),
      ]);
      const reviewData = (reviewResult as any)?.data ?? (Array.isArray(reviewResult) ? reviewResult : []);
      setReviews(reviewData);
      setSummary(summaryData);
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [property, filter]);

  const handleRespond = async (reviewId: string) => {
    if (!property || !responseText.trim()) return;
    setError('');
    try {
      await api.patch(`/properties/${property.id}/reviews/${reviewId}/respond`, {
        ownerResponse: responseText,
      });
      setRespondingTo(null);
      setResponseText('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateStatus = async (reviewId: string, status: 'published' | 'hidden') => {
    if (!property) return;
    try {
      await api.patch(`/properties/${property.id}/reviews/${reviewId}/status`, { status });
      fetchData();
    } catch { /* empty */ }
  };

  const statusColor = (s: string) => {
    if (s === 'published') return 'bg-green-100 text-green-700';
    if (s === 'hidden') return 'bg-slate-100 text-slate-500';
    return 'bg-amber-100 text-amber-700';
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Guest Reviews</h2>
          <p className="text-sm text-muted mt-1">Manage and respond to guest feedback.</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-border p-4 col-span-2 md:col-span-1">
            <p className="text-xs text-muted uppercase tracking-wide">Overall</p>
            <p className="text-3xl font-bold mt-1">{(summary.averageOverall ?? 0).toFixed(1)}</p>
            <Stars rating={Math.round(summary.averageOverall ?? 0)} />
            <p className="text-xs text-muted mt-1">{summary.totalReviews} reviews</p>
          </div>
          {([
            ['Cleanliness', summary.averageCleanliness],
            ['Comfort', summary.averageComfort],
            ['Location', summary.averageLocation],
            ['Value', summary.averageValue],
            ['Service', summary.averageService],
          ] as [string, number][]).map(([cat, avg]) => (
            <div key={cat} className="bg-white rounded-xl border border-border p-4">
              <p className="text-xs text-muted uppercase tracking-wide">{cat}</p>
              <p className="text-2xl font-bold mt-1">{(avg ?? 0).toFixed(1)}</p>
              <Stars rating={Math.round(avg ?? 0)} size={12} />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'published', 'hidden'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
              filter === f ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="p-12 text-center text-muted">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <MessageSquare size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-600">No reviews yet</p>
          <p className="text-sm text-muted mt-1">Reviews from guests will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <Stars rating={review.overall_rating} />
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(review.status)}`}>
                      {review.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium mt-2">
                    {review.guest?.first_name} {review.guest?.last_name}
                  </p>
                  <p className="text-xs text-muted">
                    {review.booking?.reference_number} &middot; {new Date(review.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1">
                  {review.status !== 'published' && (
                    <button
                      onClick={() => updateStatus(review.id, 'published')}
                      className="p-1.5 hover:bg-green-50 rounded text-slate-400 hover:text-green-600"
                      title="Publish"
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  {review.status !== 'hidden' && (
                    <button
                      onClick={() => updateStatus(review.id, 'hidden')}
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                      title="Hide"
                    >
                      <EyeOff size={16} />
                    </button>
                  )}
                </div>
              </div>

              {review.comment && (
                <p className="mt-3 text-sm text-slate-700 leading-relaxed">&ldquo;{review.comment}&rdquo;</p>
              )}

              {(review.cleanliness_rating || review.comfort_rating || review.location_rating || review.value_rating || review.service_rating) && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {[
                    { label: 'Cleanliness', val: review.cleanliness_rating },
                    { label: 'Comfort', val: review.comfort_rating },
                    { label: 'Location', val: review.location_rating },
                    { label: 'Value', val: review.value_rating },
                    { label: 'Service', val: review.service_rating },
                  ].filter((r) => r.val != null).map((r) => (
                    <span key={r.label} className="text-xs bg-slate-50 px-2 py-1 rounded">
                      {r.label}: {r.val}/5
                    </span>
                  ))}
                </div>
              )}

              {review.owner_response && (
                <div className="mt-4 bg-blue-50 rounded-lg p-3 border-l-2 border-blue-400">
                  <p className="text-xs font-medium text-blue-700 mb-1">Your response</p>
                  <p className="text-sm text-blue-900">{review.owner_response}</p>
                </div>
              )}

              {!review.owner_response && (
                respondingTo === review.id ? (
                  <div className="mt-4">
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Write your response to this review..."
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleRespond(review.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
                      >
                        <Send size={14} /> Send Response
                      </button>
                      <button
                        onClick={() => { setRespondingTo(null); setResponseText(''); }}
                        className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setRespondingTo(review.id)}
                    className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
                  >
                    <MessageSquare size={14} /> Respond
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
