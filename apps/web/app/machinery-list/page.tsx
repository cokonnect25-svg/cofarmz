'use client';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { getApiUrl } from '@/lib/api';

// ── Haversine distance (km) ──────────────────────────────────────────────────
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_DISTANCE_KM = 500;   // slider "all" value
const MAX_PRICE       = 50000; // slider max

const equipmentOptions = [
  { id: 'tractors',   label: 'Tractors'   },
  { id: 'harvesters', label: 'Harvesters' },
  { id: 'implements', label: 'Implements' },
  { id: 'loaders',    label: 'Loaders'    },
  { id: 'excavators', label: 'Excavators' },
  { id: 'pumps',      label: 'Pumps'      },
];

const TYPE_KEYWORDS: Record<string, string[]> = {
  tractors:   ['tractor'],
  harvesters: ['harvester', 'combine'],
  implements: ['implement', 'plow', 'harrow', 'rotavator', 'cultivator'],
  loaders:    ['loader'],
  excavators: ['excavator'],
  pumps:      ['pump'],
};

// ── Page content ─────────────────────────────────────────────────────────────
function MachineryListContent() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading, user } = useAuth();

  const [mounted,        setMounted]        = useState(false);
  const [showFilter,     setShowFilter]     = useState(false);
  const [showSortMenu,   setShowSortMenu]   = useState(false);
  const [sortBy,         setSortBy]         = useState('distance');
  const [searchQuery,    setSearchQuery]    = useState(searchParams.get('search') || '');
  const [machineryData,  setMachineryData]  = useState<any[]>([]);
  const [favorites,      setFavorites]      = useState<Set<string>>(new Set());
  const [userLocation,   setUserLocation]   = useState<{ latitude: number; longitude: number } | null>(null);
  const [profileLocation,setProfileLocation]= useState<{ latitude: number; longitude: number } | null>(null);
  const [locationReady,  setLocationReady]  = useState(false); // ✅ gate for fetching

  const [filters, setFilters] = useState({
    priceMin:       0,
    priceMax:       MAX_PRICE,
    // ✅ FIX: default to MAX so nothing is filtered out before user touches slider
    distanceMax:    MAX_DISTANCE_KM,
    startDate:      '',
    endDate:        '',
    equipmentTypes: [] as string[],
  });

  // ── mount ──────────────────────────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, loading, mounted, router]);

  // ── init data once auth is ready ───────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !isAuthenticated || !user?.id) return;
    fetchUserProfile();
    getUserLocation();       // sets locationReady when done
    fetchUserFavorites();
  }, [mounted, isAuthenticated, user?.id]);

  // ── fetch machinery only after location attempt finishes ──────────────────
  useEffect(() => {
    if (locationReady) fetchMachinery();
  }, [locationReady]);

  // ── location helpers ───────────────────────────────────────────────────────
  const fetchUserProfile = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(getApiUrl(`/api/users/profile?userId=${user.id}`));
      if (res.ok) {
        const p = await res.json();
        const lat = parseFloat(p.latitude);
        const lon = parseFloat(p.longitude);
        if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
          setProfileLocation({ latitude: lat, longitude: lon });
        }
      }
    } catch (e) {
      console.error('Profile fetch error:', e);
    }
  };

  const getUserLocation = async () => {
    try {
      let lat: number, lon: number;

      if (Capacitor.isNativePlatform()) {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } else {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
        );
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      }

      setUserLocation({ latitude: lat, longitude: lon });
    } catch (e) {
      console.warn('Geolocation unavailable, using profile/fallback:', e);
    } finally {
      // ✅ always unblock machinery fetch, even if location fails
      setLocationReady(true);
    }
  };

  // ── distance enrichment ────────────────────────────────────────────────────
  // Reference coords: prefer live GPS → profile coords → null (unknown)
  const refLocation = userLocation ?? profileLocation ?? null;

  const machineryWithDistances = React.useMemo(() => {
    return machineryData.map((item: any) => {
      const itemLat = parseFloat(item.latitude);
      const itemLon = parseFloat(item.longitude);
      const hasCoords = !isNaN(itemLat) && !isNaN(itemLon) && (itemLat !== 0 || itemLon !== 0);

      let dist: number;
      if (refLocation && hasCoords) {
        // ✅ Real haversine calculation
        dist = calculateDistance(refLocation.latitude, refLocation.longitude, itemLat, itemLon);
      } else if (typeof item.distance === 'number' && item.distance > 0) {
        // ✅ Use server-provided distance if available
        dist = item.distance;
      } else {
        // ✅ Unknown — put at end but keep visible (don't fake a number)
        dist = MAX_DISTANCE_KM;
      }

      return { ...item, distance: dist };
    });
  }, [machineryData, refLocation]);

  // ── filter + sort ──────────────────────────────────────────────────────────
  const getFilteredAndSortedMachinery = () => {
    let list = [...machineryWithDistances];

    // search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.model?.toLowerCase().includes(q)
      );
    }

    // price — use `price` field (mapped from daily_rate in fetchMachinery)
    list = list.filter(m =>
      (m.price ?? 0) >= filters.priceMin &&
      (m.price ?? Infinity) <= filters.priceMax
    );

    // ✅ FIX: only apply distance filter if user moved slider below MAX
    if (filters.distanceMax < MAX_DISTANCE_KM) {
      list = list.filter(m => m.distance <= filters.distanceMax);
    }

    // equipment types
    if (filters.equipmentTypes.length > 0) {
      list = list.filter(m => {
        const name  = m.name?.toLowerCase()  ?? '';
        const model = m.model?.toLowerCase() ?? '';
        return filters.equipmentTypes.some(typeId =>
          (TYPE_KEYWORDS[typeId] ?? [typeId]).some(kw => name.includes(kw) || model.includes(kw))
        );
      });
    }

    // sort
    if (sortBy === 'distance') return list.sort((a, b) => a.distance - b.distance);
    if (sortBy === 'price')    return list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    if (sortBy === 'rating')   return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return list;
  };

  const sortedMachinery = getFilteredAndSortedMachinery();

  // ── data fetchers ──────────────────────────────────────────────────────────
  const fetchMachinery = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/machinery`));
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) { setMachineryData([]); return; }

      setMachineryData(data.map((item: any) => ({
        id:           item.id,
        name:         item.name        ?? 'Unknown Equipment',
        model:        item.model       ?? 'Equipment',
        category:     item.model       ?? 'Equipment',
        // ✅ FIX: map daily_rate → price consistently
        price:        parseFloat(item.daily_rate) || 0,
        latitude:     item.latitude,
        longitude:    item.longitude,
        availability: item.is_unavailable ? 'Not Available' : 'Available Now',
        is_unavailable: item.is_unavailable || false,
        image:        item.image_url?.startsWith('http') ? item.image_url : null,
        location:     item.location    ?? null,
        power:        item.power       ?? null,
        fuel:         item.fuel        ?? null,
        year:         item.year        ?? null,
        description:  item.description ?? null,
        // keep server distance as fallback if provided
        distance:     item.distance    ?? null,
      })));
    } catch (e) {
      console.error('fetchMachinery error:', e);
      setMachineryData([]);
    }
  };

  const fetchUserFavorites = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(getApiUrl(`/api/machinery/favorites`), {
        headers: { 'x-user-id': user.id },
      });
      if (res.ok) {
        const data = await res.json();
        setFavorites(new Set<string>(data.favorites?.map((f: any) => f.id) ?? []));
      }
    } catch (e) {
      console.error('fetchFavorites error:', e);
    }
  };

  const handleFavorite = async (e: React.MouseEvent, machineryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.id) return;

    const wasLiked = favorites.has(machineryId);
    setFavorites(prev => {
      const next = new Set(prev);
      wasLiked ? next.delete(machineryId) : next.add(machineryId);
      return next;
    });

    try {
      const res = await fetch(getApiUrl(`/api/machinery/${machineryId}/favorite`), {
        method: 'POST',
        headers: { 'x-user-id': user.id, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setFavorites(prev => {
        const next = new Set(prev);
        wasLiked ? next.add(machineryId) : next.delete(machineryId);
        return next;
      });
    }
  };

  const toggleEquipmentType = (typeId: string) =>
    setFilters(prev => ({
      ...prev,
      equipmentTypes: prev.equipmentTypes.includes(typeId)
        ? prev.equipmentTypes.filter(t => t !== typeId)
        : [...prev.equipmentTypes, typeId],
    }));

  const resetFilters = () => setFilters({
    priceMin: 0, priceMax: MAX_PRICE,
    distanceMax: MAX_DISTANCE_KM,
    startDate: '', endDate: '',
    equipmentTypes: [],
  });

  // ── loading guard ──────────────────────────────────────────────────────────
  if (!mounted || loading || !isAuthenticated) {
    return (
      <div className="w-full h-screen bg-brand-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="pt-4 text-gray-800 relative min-h-screen" suppressHydrationWarning>
        <div className="ambient-glow"></div>

        {/* Header */}
        <header className="w-full px-6 pb-6 relative z-10">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <button
                className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-gray-900 active:scale-95 transition-transform"
                onClick={() => router.push('/')}
              >
                <i className="ph-bold ph-arrow-left text-lg"></i>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Available Fleet</h1>
            </div>
            <button
              className="relative w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-brand-700 active:scale-95 transition-transform"
              onClick={() => setShowFilter(!showFilter)}
            >
              <i className="ph-bold ph-sliders-horizontal text-lg"></i>
              {(filters.equipmentTypes.length > 0 || filters.distanceMax < MAX_DISTANCE_KM || filters.priceMax < MAX_PRICE) && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-accent border-2 border-white rounded-full"></span>
              )}
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search machinery by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-5 pr-12 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/10 bg-white shadow-soft"
            />
            <i className="ph-bold ph-magnifying-glass absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none"></i>
          </div>

          {/* Location status indicator */}
          <div className="mt-2 flex items-center gap-1.5">
            {userLocation ? (
              <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[11px] text-green-600 font-semibold">Using your live location</span></>
            ) : profileLocation ? (
              <><span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-[11px] text-amber-600 font-semibold">Using saved profile location</span></>
            ) : (
              <><span className="w-2 h-2 rounded-full bg-gray-300"></span>
              <span className="text-[11px] text-gray-400 font-semibold">Location unavailable — distances may be inaccurate</span></>
            )}
          </div>
        </header>

        {/* Filter Modal */}
        {showFilter && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={() => setShowFilter(false)}>
            <div className="w-full mx-4 bg-white rounded-2xl p-6 max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Filter Equipment</h2>
                <button onClick={() => setShowFilter(false)}><i className="ph-bold ph-x text-xl text-gray-500"></i></button>
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  Daily Rate: ₹{filters.priceMin.toLocaleString()} – ₹{filters.priceMax.toLocaleString()}
                </label>
                <input type="range" min="0" max={MAX_PRICE} step="500"
                  value={filters.priceMax}
                  onChange={e => setFilters(f => ({ ...f, priceMax: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-700"
                />
              </div>

              {/* Distance */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  {/* ✅ FIX: show "All distances" when at max */}
                  Distance: {filters.distanceMax >= MAX_DISTANCE_KM ? 'All distances' : `≤ ${filters.distanceMax} km`}
                </label>
                <input type="range" min="5" max={MAX_DISTANCE_KM} step="5"
                  value={filters.distanceMax}
                  onChange={e => setFilters(f => ({ ...f, distanceMax: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-700"
                />
              </div>

              {/* Equipment Types */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-900 mb-3">Equipment Types</label>
                <div className="grid grid-cols-2 gap-3">
                  {equipmentOptions.map(opt => (
                    <button key={opt.id} onClick={() => toggleEquipmentType(opt.id)}
                      className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                        filters.equipmentTypes.includes(opt.id)
                          ? 'bg-brand-700 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-900 mb-3">Select Dates</label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">From Date</label>
                    <input type="date" value={filters.startDate}
                      onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-700" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">To Date</label>
                    <input type="date" value={filters.endDate}
                      onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-700" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={resetFilters}
                  className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm">
                  Reset
                </button>
                <button onClick={() => setShowFilter(false)}
                  className="flex-1 py-3.5 bg-brand-700 text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-transform">
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Category Chips */}
        <section className="mb-6 relative z-10 pl-6">
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pr-6 pb-2">
            <button
              onClick={() => setFilters(f => ({ ...f, equipmentTypes: [] }))}
              className={`px-5 py-2.5 rounded-[14px] text-sm font-bold whitespace-nowrap active:scale-95 transition-transform ${
                filters.equipmentTypes.length === 0
                  ? 'bg-brand-800 text-white shadow-lg shadow-brand-800/20'
                  : 'bg-white text-gray-600 shadow-soft'
              }`}>
              All Equipment
            </button>
            {equipmentOptions.map(opt => (
              <button key={opt.id} onClick={() => toggleEquipmentType(opt.id)}
                className={`px-5 py-2.5 rounded-[14px] text-sm font-bold whitespace-nowrap active:scale-95 transition-transform ${
                  filters.equipmentTypes.includes(opt.id)
                    ? 'bg-brand-800 text-white shadow-lg shadow-brand-800/20'
                    : 'bg-white text-gray-600 shadow-soft'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Sort Bottom Sheet */}
        {showSortMenu && (
          <div className="fixed inset-0 z-[9999] flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={() => setShowSortMenu(false)}>
            <div className="bg-white rounded-t-3xl px-4 pb-8 pt-4" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5"></div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Sort By</p>
              {[
                { key: 'distance', label: 'Nearest First',  sub: 'Sort by distance',  icon: 'ph-map-pin'       },
                { key: 'price',    label: 'Lowest Price',   sub: 'Sort by daily rate', icon: 'ph-currency-inr'  },
                { key: 'rating',   label: 'Top Rated',      sub: 'Sort by rating',     icon: 'ph-star'          },
              ].map(opt => (
                <button key={opt.key} onClick={() => { setSortBy(opt.key); setShowSortMenu(false); }}
                  className={`flex w-full items-center gap-4 px-4 py-4 rounded-2xl mb-2 transition-all ${sortBy === opt.key ? 'bg-emerald-50 border-2 border-emerald-500' : 'bg-gray-50 border-2 border-transparent'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sortBy === opt.key ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                    <i className={`ph-bold ${opt.icon} text-lg ${sortBy === opt.key ? 'text-white' : 'text-gray-500'}`}></i>
                  </div>
                  <div className="text-left flex-1">
                    <p className={`text-sm font-bold ${sortBy === opt.key ? 'text-emerald-700' : 'text-gray-800'}`}>{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.sub}</p>
                  </div>
                  {sortBy === opt.key && <i className="ph-bold ph-check-circle text-emerald-500 text-xl"></i>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats Bar */}
        <section className="px-6 mb-4 flex justify-between items-center text-sm font-medium text-gray-500">
          <p>Showing {sortedMachinery.length} results</p>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-gray-900 shadow-soft font-medium"
            onClick={() => setShowSortMenu(true)}
          >
            <i className="ph-bold ph-funnel text-base"></i>
            {sortBy === 'distance' ? 'Distance' : sortBy === 'price' ? 'Price' : 'Rating'}
            <i className="ph-bold ph-caret-down text-sm"></i>
          </button>
        </section>

        {/* Grid */}
        <section className="px-4 relative z-10">
          {sortedMachinery.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <i className="ph-bold ph-tractor text-4xl text-gray-400"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-1">No equipment found</h3>
              <p className="text-sm text-gray-400 mb-5">Try adjusting your filters or search term</p>
              <button onClick={() => { resetFilters(); setSearchQuery(''); }}
                className="px-5 py-2.5 bg-brand-700 text-white rounded-xl font-semibold text-sm">
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-6 pb-20">
              {sortedMachinery.map(machine => (
                <div key={machine.id}
                  className={`group bg-white rounded-[24px] overflow-hidden shadow-sm transition-all duration-300 relative border border-gray-100 ${
                    machine.is_unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl cursor-pointer active:scale-[0.98]'
                  }`}
                  onClick={() => { if (!machine.is_unavailable) router.push(`/machinery-details?id=${machine.id}&source=machinery-list`); }}
                >
                  {/* Image */}
                  <div className="relative w-full aspect-[16/9] overflow-hidden bg-gray-50">
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-green-50/40 to-emerald-100/40">
                      <div className="w-16 h-16 rounded-3xl bg-white/60 flex items-center justify-center shadow-inner backdrop-blur-xl border border-white/50">
                        <i className="ph-duotone ph-tractor text-4xl text-emerald-500/80"></i>
                      </div>
                    </div>
                    {machine.image && (
                      <img src={machine.image} alt={machine.name} draggable={false}
                        className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105 pointer-events-none select-none"
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                        onContextMenu={e => e.preventDefault()}
                      />
                    )}
                    <div className="absolute inset-0 z-[5]" />

                    {/* Distance badge */}
                    <div className="absolute top-3 left-3 flex flex-row gap-2 z-10">
                      <div className="bg-emerald-600/85 backdrop-blur-lg px-2.5 py-1.5 rounded-2xl flex items-center gap-1.5 shadow-md border border-emerald-400/30">
                        <i className="ph-fill ph-map-pin text-white text-xs"></i>
                        <span className="text-[12px] font-black text-white">
                          {machine.distance >= MAX_DISTANCE_KM
                            ? '—'                                              // ✅ unknown distance → dash
                            : `${machine.distance.toFixed(1)} km`}
                        </span>
                      </div>
                    </div>

                    {/* Favorite */}
                    <button
                      onClick={e => handleFavorite(e, machine.id)}
                      className={`absolute top-3 right-3 w-10 h-10 rounded-full z-20 flex items-center justify-center transition-all duration-300 shadow-xl active:scale-90 backdrop-blur-xl border ${
                        favorites.has(machine.id) ? 'bg-red-500/90 border-red-400/50' : 'bg-white/50 border-white/60'
                      }`}
                    >
                      {favorites.has(machine.id)
                        ? <i className="ph-fill ph-heart text-white text-lg"></i>
                        : <i className="ph ph-heart text-gray-700/80 text-lg"></i>}
                    </button>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            {machine.category ?? 'Equipment'}
                          </span>
                          {machine.availability === 'Available Now'
                            ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            : <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Not Available</span>}
                        </div>
                        <h3 className="font-black text-gray-900 text-xl leading-tight group-hover:text-emerald-700 transition-colors">
                          {machine.name}
                        </h3>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                          {machine.power && <div className="flex items-center gap-1"><i className="ph ph-engine text-gray-400 text-xs"></i><span className="text-[11px] font-bold text-gray-500">{machine.power}</span></div>}
                          {machine.fuel  && <div className="flex items-center gap-1"><i className="ph ph-gas-pump text-gray-400 text-xs"></i><span className="text-[11px] font-bold text-gray-500">{machine.fuel}</span></div>}
                          {machine.year  && <div className="flex items-center gap-1"><i className="ph ph-calendar text-gray-400 text-xs"></i><span className="text-[11px] font-bold text-gray-500">{machine.year}</span></div>}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-tight block">Daily rate</span>
                        <span className="text-emerald-700 font-black text-lg">₹{machine.price.toLocaleString()}</span>
                        <span className="text-gray-400 text-sm font-bold">/day</span>
                      </div>
                    </div>
                    <button
                      disabled={!!machine.is_unavailable}
                      className={`w-full h-[50px] rounded-[18px] font-black text-[14px] transition-all flex items-center justify-center gap-2 ${
                        machine.is_unavailable
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-lg shadow-emerald-700/20 active:scale-95'
                      }`}>
                      {machine.is_unavailable ? 'Not Available' : 'Rent'}
                      {!machine.is_unavailable && <i className="ph-bold ph-arrow-right text-sm"></i>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default function MachineryListPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen bg-brand-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    }>
      <MachineryListContent />
    </Suspense>
  );
}