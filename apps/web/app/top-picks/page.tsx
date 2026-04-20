'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';

interface Machinery {
  id: string;
  name: string;
  model: string;
  daily_rate: number;
  image_url: string;
  location: string;
  year: number;
  distance?: number;
}

export default function TopPicksPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [machinery, setMachinery] = useState<Machinery[]>([]);
  const [loadingMachinery, setLoadingMachinery] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, loading, mounted, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetch(getApiUrl(`/api/machinery/featured`))
        .then(r => r.ok ? r.json() : [])
        .then(data => setMachinery(Array.isArray(data) ? data : []))
        .catch(() => setMachinery([]))
        .finally(() => setLoadingMachinery(false));
    }
  }, [isAuthenticated]);

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!mounted || loading || !isAuthenticated) {
    return (
      <div className="w-full min-h-[100dvh] flex items-center justify-center bg-surface-muted">
        <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-min-h-[100dvh] bg-surface-muted">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-colors"
          >
            <i className="ph-bold ph-arrow-left text-lg"></i>
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Top Picks Near You</h1>
            <p className="text-gray-500 text-sm mt-0.5">{machinery.length} equipment available</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loadingMachinery ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="h-56 bg-gray-200"></div>
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-10 bg-gray-200 rounded mt-4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : machinery.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ph-bold ph-tractor text-3xl text-brand-400"></i>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Equipment Found</h3>
            <p className="text-gray-500 text-sm">Check back later for top picks near you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {machinery.map(item => (
              <div
                key={item.id}
                className="bg-white rounded-2xl overflow-hidden shadow-soft hover:shadow-float transition-all duration-300 group cursor-pointer border border-gray-100"
                onClick={() => router.push(`/machinery-details?id=${item.id}&source=top-picks`)}
              >
                {/* Image — fixed height with proper aspect ratio */}
                <div className="relative overflow-hidden bg-gray-100" style={{ height: '220px' }}>
                  <img
                    src={item.image_url || null}
                    alt={item.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    onError={e => {
                      (e.target as HTMLImageElement).src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'%3E%3Crect fill='%23f3f4f6' width='600' height='400'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='20' fill='%239ca3af'%3ENo Image%3C/text%3E%3C/svg%3E`;
                    }}
                  />
                  {/* Gradient overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>

                  {/* Favorite button */}
                  <button
                    onClick={e => toggleFavorite(e, item.id)}
                    className="absolute top-3 right-3 w-9 h-9 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                  >
                    <i className={`${favorites.has(item.id) ? 'ph-fill text-red-500' : 'ph text-gray-400 hover:text-red-400'} ph-heart text-lg transition-colors`}></i>
                  </button>

                  {/* Year tag on image */}
                  <div className="absolute bottom-3 left-3 bg-brand-600/90 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                    {item.year}
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{item.name}</h3>
                  <p className="text-sm text-gray-400 mb-2">{item.model}</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
                    <i className="ph-fill ph-map-pin text-brand-500 text-sm"></i>
                    <span>{item.distance ? `${item.distance} km away` : item.location}</span>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div>
                      <span className="text-2xl font-black text-gray-900">
                        ₹{Number(item.daily_rate).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-400 font-medium"> / day</span>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/machinery-details?id=${item.id}`); }}
                      className="bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-700 transition-colors shadow-md shadow-brand-600/20 flex items-center gap-1.5"
                    >
                      <i className="ph-bold ph-eye text-sm"></i>
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
