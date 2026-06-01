'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import UserAvatar from '@/app/components/UserAvatar';

  const SCROLL_KEY = 'nearbyFarmers_scrollY';
const VISIBLE_KEY = 'nearbyFarmers_visibleCount';
const TYPE_KEY = 'nearbyFarmers_searchType'; 
const LOCATION_KEY = 'nearbyFarmers_userLocation';

interface FarmerCrop {
  crop_name: string;
  years_of_experience: number | null;
  expertise_level: string;
  grade?: string;
  certification_type?: string;
}

interface Equipment {
  id: string;
  name: string;
  model: string;
  daily_rate: number;
  image_url: string;
}

interface Farmer {
  latitude: any;
  longitude: any;
  id: string;
  name: string;
  email: string;
  image: string;
  location: string;
  distance: number;
  rating: string | null;
  equipment_count: number;
  crops_count: number;
  crops: FarmerCrop[];
  equipment: Equipment[];
  followers_count?: number;
  following_count?: number;
}

const CROP_OPTIONS = [
  'Wheat', 'Rice', 'Corn', 'Barley', 'Oats', 'Soybean',
  'Cotton', 'Sugarcane', 'Tobacco', 'Tea', 'Coffee', 'Cocoa',
  'Tomato', 'Potato', 'Onion', 'Carrot', 'Cabbage', 'Lettuce',
  'Apple', 'Orange', 'Banana', 'Mango', 'Grapes', 'Strawberry',
  'Groundnut', 'Sunflower', 'Linseed', 'Sesame'
];

const EQUIPMENT_OPTIONS = [
  'Tractor', 'Harvester', 'Plow', 'Harrow', 'Seeder',
  'Sprayer', 'Pump', 'Thresher', 'Baler', 'Loader',
  'Cultivator', 'Planter', 'Combine', 'Irrigation Equipment'
];

const GRADE_OPTIONS = ['A+', 'A', 'B+', 'B', 'C', 'D', 'Organic', 'Premium', 'Ungraded'];

const CERTIFICATION_TYPES = [
  { value: 'organic',        label: 'Organic Certified',                   icon: '🌿' },
  { value: 'ipm',            label: 'IPM (Low Pesticide)',                  icon: '🛡️' },
  { value: 'gap',            label: 'Good Agricultural Practices (GAP)',    icon: '✅' },
  { value: 'natural',        label: 'Natural Farming',                      icon: '🍃' },
  { value: 'residue_free',   label: 'Residue-Free',                         icon: '🧪' },
  { value: 'premium',        label: 'Premium Quality',                      icon: '⭐' },
  { value: 'export_quality', label: 'Export Quality',                       icon: '🌍' },
  { value: 'other',          label: 'Other',                                icon: '📜' },
];


function NearbyFarmersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading, user } = useAuth();
  const [mounted, setMounted]         = useState(false);
  const [farmers, setFarmers]         = useState<Farmer[]>([]);
  const [loadingFarmers, setLoadingFarmers] = useState(false);
  const [showFilter, setShowFilter]   = useState(false);
 const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(() => {
  // Try to restore from sessionStorage first (instant, no async wait)
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem(LOCATION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.latitude && parsed.longitude) return parsed;
      } catch {}
    }
  }
  return null;
});
  const [locationError, setLocationError] = useState<string | null>(null);

const rawType = searchParams.get('type');

// Check if we're returning from a profile view
const savedType = typeof window !== 'undefined' 
  ? sessionStorage.getItem(TYPE_KEY) 
  : null;

// PRIORITY: URL param > sessionStorage > default
const initialType =
  rawType === 'buyers'     ? 'buyers'   :
  rawType === 'wastage'    ? 'wastage'  :
  rawType === 'supplier'   ? 'supplier' :
  rawType === 'fpo'        ? 'fpo'      :
  rawType === 'farmers'    ? 'farmers'  :
  savedType === 'farmers'  ? 'farmers'  :
  savedType === 'buyers'   ? 'buyers'   :
  savedType === 'wastage'  ? 'wastage'  :
  savedType === 'supplier' ? 'supplier' :
  savedType === 'fpo'      ? 'fpo'      :
  'farmers';

const [searchType, setSearchType] = useState<'farmers' | 'buyers' | 'wastage' | 'supplier' | 'fpo'>(initialType);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy]           = useState('nearby');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const defaultFilters = {
    distance:        50,
    minRating:       0,
    crops:           [] as string[],
    equipment:       [] as string[],
    enableDistance:  false,
    yieldDateFrom:   '',
    yieldDateTo:     '',
    wasteOnly:       false,
    grades:          [] as string[],
    certTypes:       [] as string[],
  };

  const [filters, setFilters] = useState(defaultFilters);
  const [visibleCount, setVisibleCount] = useState(50);
const isRestoringRef = useRef(false); 
const scrollContainerRef = useRef<HTMLDivElement>(null);

const pendingScrollRef = useRef<number | null>(null);



  // Always-current ref so fetch closures never use stale filters
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const today = new Date().toISOString().split('T')[0];

  const availableCrops = useMemo(() => {
  const seen = new Set<string>();
  farmers.forEach(f => f.crops?.forEach(c => {
    if (c.crop_name) seen.add(c.crop_name);
  }));
  return Array.from(seen).sort();
}, [farmers]);

  useEffect(() => {
  if (isRestoringRef.current) return; // don't reset while restoring
  setVisibleCount(50);
}, [searchType, filters, searchQuery]);

  useEffect(() => { setMounted(true); }, []);

  // Restore scroll position when returning to this page
// REPLACE the existing restore useEffect with this:
// Restore scroll position when returning to this page
useEffect(() => {
  if (!mounted) return;

  const savedVisible = sessionStorage.getItem(VISIBLE_KEY);
  const savedScroll  = sessionStorage.getItem(SCROLL_KEY);
  const savedType    = sessionStorage.getItem(TYPE_KEY);
  
  sessionStorage.removeItem(VISIBLE_KEY);
  sessionStorage.removeItem(SCROLL_KEY);
  
  // Only remove TYPE_KEY if URL doesn't have one (so we preserve back-nav)
  if (!rawType) {
    sessionStorage.removeItem(TYPE_KEY);
  }

  if (savedVisible) {
    isRestoringRef.current = true;
    setVisibleCount(parseInt(savedVisible));
  }
  if (savedScroll) {
    pendingScrollRef.current = parseInt(savedScroll);
  }
}, [mounted, rawType]); // <-- add rawType dependency

  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, loading, mounted, router]);

  useEffect(() => {
    if (mounted && isAuthenticated) getUserLocation();
  }, [mounted, isAuthenticated]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    const lat = userLocation?.latitude  ?? 0;
    const lon = userLocation?.longitude ?? 0;
    fetchNearbyFarmers(lat, lon, searchType);
  }, [searchType, userLocation, mounted, isAuthenticated]);

  useEffect(() => {
    const handler = (e: any) => {
      const { latitude, longitude } = e.detail;
      setUserLocation({ latitude, longitude });
      fetchNearbyFarmers(latitude, longitude, searchType);
    };
    window.addEventListener('userLocationUpdated', handler);
    return () => window.removeEventListener('userLocationUpdated', handler);
  }, [searchType]);


  useEffect(() => {
  if (userLocation) {
    sessionStorage.setItem(LOCATION_KEY, JSON.stringify(userLocation));
  }
}, [userLocation]);

// ── IN YOUR NAVIGATION (before going to profile) ───────────────────────────
// Save ALL state including current location
const saveStateAndNavigate = (url: string) => {
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);
  if (userLocation) {
    sessionStorage.setItem(LOCATION_KEY, JSON.stringify(userLocation));
  }
  router.push(url);
};

  

  // ── filter helpers ──────────────────────────────────────────────────────────
  // BUG FIX E: after toggling a chip OFF from the active-filters bar,
  // immediately re-fetch so results update without requiring a manual Apply.
  const toggleCropFilter = (crop: string, refetch = false) => {
    setFilters(prev => {
      const next = {
        ...prev,
        crops: prev.crops.includes(crop)
          ? prev.crops.filter(c => c !== crop)
          : [...prev.crops, crop],
      };
      if (refetch) {
        const lat = userLocation?.latitude  ?? 0;
        const lon = userLocation?.longitude ?? 0;
        fetchNearbyFarmers(lat, lon, searchType, next);
      }
      return next;
    });
  };

  const toggleGradeFilter = (grade: string, refetch = false) => {
    setFilters(prev => {
      const next = {
        ...prev,
        grades: prev.grades.includes(grade)
          ? prev.grades.filter(g => g !== grade)
          : [...prev.grades, grade],
      };
      if (refetch) {
        const lat = userLocation?.latitude  ?? 0;
        const lon = userLocation?.longitude ?? 0;
        fetchNearbyFarmers(lat, lon, searchType, next);
      }
      return next;
    });
  };

  const toggleCertFilter = (cert: string, refetch = false) => {
    setFilters(prev => {
      const next = {
        ...prev,
        certTypes: prev.certTypes.includes(cert)
          ? prev.certTypes.filter(c => c !== cert)
          : [...prev.certTypes, cert],
      };
      if (refetch) {
        const lat = userLocation?.latitude  ?? 0;
        const lon = userLocation?.longitude ?? 0;
        fetchNearbyFarmers(lat, lon, searchType, next);
      }
      return next;
    });
  };

  const toggleEquipmentFilter = (equip: string, refetch = false) => {
    setFilters(prev => {
      const next = {
        ...prev,
        equipment: prev.equipment.includes(equip)
          ? prev.equipment.filter(e => e !== equip)
          : [...prev.equipment, equip],
      };
      if (refetch) {
        const lat = userLocation?.latitude  ?? 0;
        const lon = userLocation?.longitude ?? 0;
        fetchNearbyFarmers(lat, lon, searchType, next);
      }
      return next;
    });
  };

  // ── location helpers ────────────────────────────────────────────────────────
 const getUserLocation = async () => {
  try {
    setLocationError(null);
    let position: any;
    let hasLocation = false;

    if (Capacitor.isNativePlatform()) {
      try {
        position = await Geolocation.getCurrentPosition();
        hasLocation = true;
      } catch (e) {
        console.warn('Native geolocation failed:', e instanceof Error ? e.message : e);
      }
    } else {
      try {
        position = await Promise.race([
          new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(
              pos => resolve({ coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } }),
              reject,
              { timeout: 5000, enableHighAccuracy: false }
            )
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 6000)),
        ]);
        hasLocation = true;
      } catch (e) {
        console.warn('Web geolocation failed:', e instanceof Error ? e.message : e);
      }
    }

    if (hasLocation && position) {
      const lat = (position as any).coords?.latitude  ?? (position as any).latitude;
      const lon = (position as any).coords?.longitude ?? (position as any).longitude;
      const newLoc = { latitude: lat, longitude: lon };
      setUserLocation(newLoc);
      sessionStorage.setItem(LOCATION_KEY, JSON.stringify(newLoc)); // ← persist immediately
      fetchNearbyFarmers(lat, lon, searchType);
    } else {
      // Only fall back to stored profile location if we have NO saved location
      const savedLoc = sessionStorage.getItem(LOCATION_KEY);
      if (!savedLoc) {
        await useStoredLocation();
      }
      // If savedLoc exists, state initializer already set it — just fetch with it
      else if (userLocation) {
        fetchNearbyFarmers(userLocation.latitude, userLocation.longitude, searchType);
      } else {
        await useStoredLocation();
      }
    }
  } catch {
    const savedLoc = sessionStorage.getItem(LOCATION_KEY);
    if (!savedLoc) {
      await useStoredLocation();
    } else if (userLocation) {
      fetchNearbyFarmers(userLocation.latitude, userLocation.longitude, searchType);
    } else {
      await useStoredLocation();
    }
  }
};

  const useStoredLocation = async () => {
  // First check if we already have a saved location from session
  const savedLoc = sessionStorage.getItem(LOCATION_KEY);
  if (savedLoc) {
    try {
      const parsed = JSON.parse(savedLoc);
      if (parsed.latitude && parsed.longitude && (parsed.latitude !== 0 || parsed.longitude !== 0)) {
        setUserLocation(parsed);
        fetchNearbyFarmers(parsed.latitude, parsed.longitude, searchType);
        return;
      }
    } catch {}
  }

  // Fall back to profile location from API
  if (!user?.id) { 
    fetchNearbyFarmers(0, 0, searchType); 
    return; 
  }
  try {
    const res = await fetch(getApiUrl(`/api/farmers/profile?farmerId=${user.id}`), {
      headers: { 'x-user-id': user.id },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        const lat = parseFloat(data.latitude);
        const lon = parseFloat(data.longitude);
        if (lat !== 0 || lon !== 0) {
          const loc = { latitude: lat, longitude: lon };
          setUserLocation(loc);
          sessionStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
          fetchNearbyFarmers(lat, lon, searchType);
          return;
        }
      }
    }
  } catch {}
  
  setUserLocation(null);
  fetchNearbyFarmers(0, 0, searchType);
};
  // ── core fetch ──────────────────────────────────────────────────────────────
const fetchNearbyFarmers = async (
  latitude: number,
  longitude: number,
  type: 'farmers' | 'buyers' | 'wastage' | 'supplier' | 'fpo' = 'farmers',
  overrideFilters?: typeof filters,
) => {
    // Use explicitly-passed filters first, then the always-current ref
    const f = overrideFilters ?? filtersRef.current;
    setLoadingFarmers(true);
    try {
      const params = new URLSearchParams();
      params.append('latitude',  latitude.toString());
      params.append('longitude', longitude.toString());
      params.append('type', type);
      if (user?.id) params.append('currentUserId', user.id);
      if (f.enableDistance) params.append('distance', f.distance.toString());
      params.append('minRating', f.minRating.toString());
      if (f.crops.length     > 0) params.append('crops',     f.crops.join(','));
      if (f.equipment.length > 0) params.append('equipment', f.equipment.join(','));
      if (f.yieldDateFrom)        params.append('yieldDateFrom', f.yieldDateFrom);
      if (f.yieldDateTo)          params.append('yieldDateTo',   f.yieldDateTo);
      if (f.grades.length    > 0) params.append('grades',    f.grades.join(','));
      if (f.certTypes.length > 0) params.append('certTypes', f.certTypes.join(','));
      if (type === 'wastage' || (type === 'buyers' && f.wasteOnly)) {
        params.append('wasteOnly', 'true');
      }

      const url = getApiUrl(`/api/nearby-farmers?${params.toString()}`);
      console.log('Fetching', type, 'from:', url);

      const response = await fetch(url);
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`HTTP ${response.status}: ${txt}`);
      }
      const data = await response.json();
      setFarmers(Array.isArray(data) ? data : data.farmers || []);
    } catch (error) {
      console.error('Error fetching', type + ':', error instanceof Error ? error.message : error);
      setFarmers([]);
    } finally {
      setLoadingFarmers(false);
    }
  };

  // Add this NEW useEffect after the farmers state is populated:
useEffect(() => {
  if (loadingFarmers) return;                    // still fetching
  if (pendingScrollRef.current === null) return; // nothing to restore

  const target = pendingScrollRef.current;
  pendingScrollRef.current = null;
  isRestoringRef.current = false;

  // Use increasing delays to handle avatar/image paint time
  const attempts = [50, 150, 350, 600];
  attempts.forEach(delay => {
    setTimeout(() => {
      window.scrollTo({ top: target, behavior: 'instant' });
    }, delay);
  });
}, [loadingFarmers]);

  // BUG FIX F: pass current `filters` state directly so the Apply button
  // never sends stale values even if filtersRef hasn't flushed yet
const handleApplyFilters = () => {
  sessionStorage.removeItem(SCROLL_KEY);
  sessionStorage.removeItem(VISIBLE_KEY);
  sessionStorage.removeItem(TYPE_KEY);   // ← ADD THIS
  const lat = userLocation?.latitude ?? 0;
  const lon = userLocation?.longitude ?? 0;
  fetchNearbyFarmers(lat, lon, searchType, filters);
  setShowFilter(false);
};

  if (!mounted || loading || !isAuthenticated) {
    return (
      <div className="w-full min-h-[100dvh] bg-brand-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pt-4 text-gray-800 relative min-min-h-[100dvh]" suppressHydrationWarning>
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
              <h1 className="text-2xl font-bold text-gray-900">
{searchType === 'farmers'  ? 'Nearby Farmers'    :
 searchType === 'buyers'   ? 'Nearby Buyers'     :
 searchType === 'wastage'  ? 'Crop Waste Buyers' :
 searchType === 'supplier' ? 'Nearby Suppliers'  :
 searchType === 'fpo'      ? 'Nearby FPOs'       : 'Nearby'}
              </h1>
            </div>
            <button
              className="relative w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-brand-700 active:scale-95 transition-transform"
              onClick={() => setShowFilter(!showFilter)}
            >
              <i className="ph-bold ph-sliders-horizontal text-lg"></i>
            </button>
          </div>

          {/* Tab toggle */}
<div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-1">
  {([
    { key: 'farmers',  label: 'Farmers',   emoji: '🌾', active: 'bg-brand-700'  },
    { key: 'buyers',   label: 'Buyers',    emoji: '🛒', active: 'bg-brand-700'  },
    { key: 'wastage',  label: 'Wastage',   emoji: '♻️', active: 'bg-amber-600'  },
    { key: 'supplier', label: 'Suppliers', emoji: '🏭', active: 'bg-purple-600' },
    { key: 'fpo',      label: 'FPOs',      emoji: '🏢', active: 'bg-teal-600'   },
  ] as const).map(tab => (
    <button
      key={tab.key}
onClick={() => {
  setSearchType(tab.key as any);
  setSortBy('nearby');
  sessionStorage.removeItem(SCROLL_KEY);
  sessionStorage.removeItem(VISIBLE_KEY);
  // Only remove TYPE_KEY if we're switching tabs manually (not from URL)
  if (!rawType) {
    sessionStorage.removeItem(TYPE_KEY);
  }
}}
      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap flex-shrink-0
        ${searchType === tab.key
          ? `${tab.active} text-white shadow-md`
          : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
        }`}
    >
      <span>{tab.emoji}</span>
      {tab.label}
    </button>
  ))}
</div>

          {/* Search */}
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search by name, location, crops... (e.g. Rice, Wheat)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-brand-600 text-sm"
            />
            <i className="ph-bold ph-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none"></i>
          </div>

          {locationError && (
            <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">{locationError}</div>
          )}
        </header>

        {/* Filter modal */}
        {showFilter && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowFilter(false)}>
            <div className="w-full mx-4 bg-white rounded-2xl p-6 max-w-sm shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pb-4">
                <h2 className="text-xl font-bold text-gray-900">Filters</h2>
                <button onClick={() => setShowFilter(false)} className="text-gray-500 hover:text-gray-900">
                  <i className="ph-bold ph-x text-xl"></i>
                </button>
              </div>

              {/* Distance */}
              <div className="mb-8">
                <label className="flex items-center gap-3 mb-4 cursor-pointer">
                  <input type="checkbox" checked={filters.enableDistance} onChange={e => setFilters(p => ({ ...p, enableDistance: e.target.checked }))} className="w-5 h-5 rounded accent-brand-700" />
                  <span className="text-sm font-bold text-gray-900">Apply Distance Filter</span>
                </label>
                {filters.enableDistance && (
                  <>
                    <label className="block text-sm font-bold text-gray-900 mb-3">Distance: {filters.distance} km</label>
                    <input type="range" min="5" max="100" value={filters.distance} onChange={e => setFilters(p => ({ ...p, distance: parseInt(e.target.value) }))} className="w-full h-2 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-700" />
                  </>
                )}
              </div>

              {/* Rating */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-900 mb-3">Minimum Rating: {filters.minRating.toFixed(1)} ⭐</label>
                <input type="range" min="0" max="5" step="0.5" value={filters.minRating} onChange={e => setFilters(p => ({ ...p, minRating: parseFloat(e.target.value) }))} className="w-full h-2 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-700" />
              </div>

              {/* Date range */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  {searchType === 'farmers' ? 'Harvest' : 'Purchase'} Date Range
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">From Date</label>
                    <input type="date" min={today} value={filters.yieldDateFrom} onChange={e => setFilters(p => ({ ...p, yieldDateFrom: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-brand-600" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">To Date</label>
                    <input type="date" min={filters.yieldDateFrom || today} value={filters.yieldDateTo} onChange={e => setFilters(p => ({ ...p, yieldDateTo: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-brand-600" />
                  </div>
                </div>
              </div>

              {/* Crop waste (buyers only) */}
              {searchType === 'buyers' && (
                <div className="mb-8">
                  <label className="flex items-center gap-3 mb-4 cursor-pointer">
                    <input type="checkbox" checked={filters.wasteOnly} onChange={e => setFilters(p => ({ ...p, wasteOnly: e.target.checked }))} className="w-5 h-5 rounded accent-orange-600" />
                    <div>
                      <span className="text-sm font-bold text-gray-900">🌾 Crop Waste Buyers Only</span>
                      <p className="text-xs text-gray-600 mt-0.5">Find buyers of agricultural waste, straw & husks</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Crops */}
// REPLACE in the filter modal crops section:
<div className="mb-8">
  <label className="block text-sm font-bold text-gray-900 mb-3">
    Crops (select any)
    {availableCrops.length > 0 && (
      <span className="ml-2 text-xs font-normal text-gray-400">
        {availableCrops.length} available
      </span>
    )}
  </label>

  {availableCrops.length === 0 ? (
    <p className="text-xs text-gray-400 italic">
      No crops found — load farmers first
    </p>
  ) : (
    <div className="flex flex-wrap gap-2">
      {availableCrops.map(crop => (
        <button
          key={crop}
          onClick={() => toggleCropFilter(crop)}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            filters.crops.includes(crop)
              ? 'bg-brand-700 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {crop}
        </button>
      ))}
    </div>
  )}
</div>

              {/* Grade */}
              {(searchType === 'farmers' || searchType === 'buyers'|| searchType === 'fpo') && (
                <div className="mb-8">
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Crop Grade <span className="text-xs text-gray-400 font-normal">(select any)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GRADE_OPTIONS.map(grade => (
                      <button key={grade} onClick={() => toggleGradeFilter(grade)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${filters.grades.includes(grade) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Certification */}
              {searchType === 'farmers' || searchType === 'buyers'|| searchType === 'fpo' && (
                <div className="mb-8">
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Certification Type <span className="text-xs text-gray-400 font-normal">(select any)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CERTIFICATION_TYPES.map(cert => (
                      <button key={cert.value} onClick={() => toggleCertFilter(cert.value)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${filters.certTypes.includes(cert.value) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                        <span>{cert.icon}</span>{cert.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipment */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-900 mb-3">Equipment (select any)</label>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_OPTIONS.map(equip => (
                    <button key={equip} onClick={() => toggleEquipmentFilter(equip)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${filters.equipment.includes(equip) ? 'bg-brand-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {equip}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleApplyFilters} disabled={loadingFarmers} className="w-full py-3.5 bg-brand-700 text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50">
                {loadingFarmers ? 'Searching...' : 'Apply Filters'}
              </button>
            </div>
          </div>
        )}

        {/* Active filter chips — BUG FIX E: pass refetch=true so removing a chip immediately re-fetches */}
        {(filters.crops.length > 0 || filters.equipment.length > 0 || filters.grades.length > 0 || filters.certTypes.length > 0) && (
          <section className="px-6 mb-4 relative z-10">
            <div className="flex flex-wrap gap-2">
              {filters.crops.map(crop => (
                <button key={`crop-${crop}`} onClick={() => toggleCropFilter(crop, true)} className="px-3 py-1.5 bg-brand-100 text-brand-700 rounded-full text-xs font-medium flex items-center gap-2 active:scale-95 transition-transform">
                  {crop}<i className="ph-bold ph-x text-sm"></i>
                </button>
              ))}
              {filters.grades.map(grade => (
                <button key={`grade-${grade}`} onClick={() => toggleGradeFilter(grade, true)} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium flex items-center gap-2 active:scale-95 transition-transform">
                  {grade} Grade<i className="ph-bold ph-x text-sm"></i>
                </button>
              ))}
              {filters.certTypes.map(cert => {
                const found = CERTIFICATION_TYPES.find(c => c.value === cert);
                return found ? (
                  <button key={`cert-${cert}`} onClick={() => toggleCertFilter(cert, true)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-2 active:scale-95 transition-transform">
                    {found.icon} {found.label}<i className="ph-bold ph-x text-sm"></i>
                  </button>
                ) : null;
              })}
              {filters.equipment.map(equip => (
                <button key={`equip-${equip}`} onClick={() => toggleEquipmentFilter(equip, true)} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-2 active:scale-95 transition-transform">
                  {equip}<i className="ph-bold ph-x text-sm"></i>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Sort bottom sheet */}
        {showSortMenu && (
          <div className="fixed inset-0 z-[9999] flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={() => setShowSortMenu(false)}>
            <div className="bg-white rounded-t-3xl px-4 pb-8 pt-4" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5"></div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Sort By</p>
              {(searchType === 'farmers' ? [
                { key: 'nearby',     label: 'Nearby First',    sub: 'Sort by distance from you',     icon: 'ph-map-pin' },
                { key: 'experience', label: 'Most Experienced', sub: 'Sort by years of experience',  icon: 'ph-medal'   },
              ] : [
                { key: 'nearby', label: 'Nearby First', sub: 'Sort by distance from you', icon: 'ph-map-pin' },
                { key: 'active', label: 'Most Active',  sub: 'Sort by equipment & activity', icon: 'ph-lightning' },
              ]).map(opt => (
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

        {/* Results header */}
        <section className="px-6 mb-4 relative z-10 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500">
{loadingFarmers ? 'Searching...' : `Found ${farmers.length} ${
  searchType === 'farmers'  ? 'farmer'       :
  searchType === 'wastage'  ? 'wastage buyer':
  searchType === 'supplier' ? 'supplier'     :
  searchType === 'fpo'      ? 'FPO'          : 'buyer'
}${farmers.length !== 1 ? 's' : ''}`}
          </p>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-gray-900 shadow-soft font-medium text-sm" onClick={() => setShowSortMenu(true)}>
            <i className="ph-bold ph-funnel text-base"></i>
            {sortBy === 'nearby' ? 'Nearby' : sortBy === 'experience' ? 'Experience' : 'Most Active'}
            <i className="ph-bold ph-caret-down text-sm"></i>
          </button>
        </section>

        {/* Results list */}
        <section className="px-6 relative z-10 flex flex-col gap-5">
          {loadingFarmers ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin"></div>
            </div>
          ) : (() => {
            const filteredFarmers = farmers
                .filter(farmer => {
                  if (!searchQuery.trim()) return true;

                  // Split by comma, trim, drop empty parts
                  const terms = searchQuery
                    .split(',')
                    .map(t => t.trim().toLowerCase())
                    .filter(Boolean);

                  // Every term must match at least one field (AND logic across terms)
                  return terms.every(term =>
                    farmer.name?.toLowerCase().includes(term) ||
                    farmer.location?.toLowerCase().includes(term) ||
                    farmer.crops?.some(c => c.crop_name?.toLowerCase().includes(term))
                  );
                })
              .sort((a, b) => {
                if (sortBy === 'nearby') {
                  const ad = (!a.distance || a.distance >= 9999) ? 999999 : a.distance;
                  const bd = (!b.distance || b.distance >= 9999) ? 999999 : b.distance;
                  return ad - bd;
                }
                if (sortBy === 'experience') {
                  const ae = a.crops?.reduce((s, c) => s + ((c as any).years_of_experience || 0), 0) || 0;
                  const be = b.crops?.reduce((s, c) => s + ((c as any).years_of_experience || 0), 0) || 0;
                  return be - ae;
                }
                if (sortBy === 'active') return (b.equipment_count || 0) - (a.equipment_count || 0);
                return 0;
              });

            return filteredFarmers.length === 0 ? (
              <div className="text-center py-10">
                <i className="ph-bold ph-magnifying-glass text-4xl text-gray-300 mb-3 block"></i>
                <p className="text-gray-500 font-medium">
                  {(() => {
  const label =
    searchType === 'farmers'  ? 'farmers'       :
    searchType === 'wastage'  ? 'wastage buyers' :
    searchType === 'supplier' ? 'suppliers'      :
    searchType === 'fpo'      ? 'FPOs'           : 'buyers';
  return searchQuery
    ? `No ${label} found matching "${searchQuery}"`
    : `No ${label} found with selected filters`;
})()}
                </p>
              </div>
            ) : (
              <>
                {filteredFarmers.slice(0, visibleCount).map(farmer => (
                  <div key={farmer.id} className="bg-white rounded-[24px] p-5 shadow-soft hover:shadow-lg transition-shadow cursor-pointer active:scale-[0.98]" onClick={() => {
sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
sessionStorage.setItem(TYPE_KEY, searchType);   // ← ADD THIS
router.push(`/farmer-profile?id=${farmer.id}`);
}}>

                    {/* Header row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1">
                        <UserAvatar image={farmer.image} name={farmer.name} size={48} className="rounded-full" />
<div className="flex-1 min-w-0 overflow-hidden">
  <h3
    className="font-bold text-gray-900 leading-snug break-words overflow-hidden"
    style={{
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
    }}
  >
    {farmer.name}
  </h3>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <i className="ph-fill ph-map-pin text-brand-600"></i>
                            {farmer.distance >= 9999
                              ? (farmer.location || 'Location not set')
                              : farmer.location
                                ? `${farmer.location} · ${Math.round(farmer.distance)} km away`
                                : `${Math.round(farmer.distance)} km away`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
  searchType === 'farmers'  ? 'bg-green-100 text-green-700'  :
  searchType === 'wastage'  ? 'bg-amber-100 text-amber-700'  :
  searchType === 'supplier' ? 'bg-purple-100 text-purple-700':
  searchType === 'fpo'      ? 'bg-teal-100 text-teal-700'    :
  'bg-blue-100 text-blue-700'}`}>
  {searchType === 'farmers'  ? '🌾 Farmer'        :
   searchType === 'wastage'  ? '♻️ Wastage Buyer' :
   searchType === 'supplier' ? '🏭 Supplier'      :
   searchType === 'fpo'      ? '🏢 FPO'           :
   '🛒 Buyer'}
</span>
                        {farmer.rating && (
                          <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                            <i className="ph-fill ph-star text-amber-500 text-sm"></i>
                            <span className="text-sm font-bold text-gray-900">{farmer.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Followers */}
                    <div className="flex gap-3 mb-4">
                      <button // e.g. Crops button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);  
  router.push(`/farmer-profile?id=${farmer.id}&tab=followers`);
}} className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors active:scale-95">
                        <i className="ph-bold ph-user-circle text-brand-600 text-sm"></i>
                        <span className="text-xs font-bold text-gray-900">{farmer.followers_count || 0} Followers</span>
                      </button>
                      <button // e.g. Crops button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);  
  router.push(`/farmer-profile?id=${farmer.id}&tab=following`);
}} className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors active:scale-95">
                        <i className="ph-bold ph-user-check text-blue-600 text-sm"></i>
                        <span className="text-xs font-bold text-gray-900">{farmer.following_count || 0} Following</span>
                      </button>
                    </div>

                    {/* Crop tags */}
                    {farmer.crops && farmer.crops.length > 0 && (() => {
                      const displayCrops = searchType === 'wastage'
                        ? farmer.crops.filter((c: any) => c.is_crop_waste)
                        : farmer.crops;
                      return displayCrops.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {displayCrops.slice(0, 5).map((crop, i) => (
                            <span key={i} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
  searchType === 'farmers'  ? 'bg-green-100 text-green-800'  :
  searchType === 'wastage'  ? 'bg-amber-100 text-amber-800'  :
  searchType === 'supplier' ? 'bg-purple-100 text-purple-800':
  searchType === 'fpo'      ? 'bg-teal-100 text-teal-800'    :
  'bg-orange-100 text-orange-800'}`}>
                              {searchType === 'farmers'  ? '🌾' :
                               searchType === 'wastage'  ? '♻️' :
                               searchType === 'supplier' ? '🏭' : '🛒'} {crop.crop_name}
                              {crop.certification_type && (() => {
                                const cert = CERTIFICATION_TYPES.find(c => c.value === crop.certification_type);
                                return cert ? <span className="ml-1 text-[9px] font-black opacity-80">{cert.icon}</span> : null;
                              })()}
                              {crop.grade && <span className="ml-1 text-[9px] font-black opacity-70">·{crop.grade}</span>}
                            </span>
                          ))}
                          {displayCrops.length > 5 && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">+{displayCrops.length - 5} more</span>
                          )}
                        </div>
                      ) : null;
                    })()}

                    {/* Stats row */}
                    <div className="flex gap-3 mb-4">
                      {searchType === 'farmers' ? (
                        <>
                          <button // e.g. Crops button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);
  router.push(`/farmer-profile?id=${farmer.id}&tab=crops`);
}} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 rounded-lg hover:bg-green-100 transition-colors active:scale-95">
                            <i className="ph-bold ph-plant text-green-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.crops_count || 0} Crops</span>
                          </button>
                          <button // e.g. Crops button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);
  router.push(`/farmer-profile?id=${farmer.id}&tab=equipment`);
}} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors active:scale-95">
                            <i className="ph-bold ph-wrench text-blue-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.equipment_count || 0} Equipment</span>
                          </button>
                        </>
                      ) : searchType === 'supplier' ? (
                        <>
                          <button // e.g. Crops button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);
  router.push(`/farmer-profile?id=${farmer.id}&tab=equipment`);
}} className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors active:scale-95">
                            <i className="ph-bold ph-package text-purple-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.equipment_count || 0} Products</span>
                          </button>
                          <button // e.g. Crops button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);
  router.push(`/farmer-profile?id=${farmer.id}&tab=followers`);
}} className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors active:scale-95">
                            <i className="ph-bold ph-users text-gray-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.followers_count || 0} Followers</span>
                          </button>
                        </>
                      ) :  searchType === 'fpo' ? (
  <>
    <button // e.g. Crops button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);  
  router.push(`/farmer-profile?id=${farmer.id}&tab=equipment`);
}}
      className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors active:scale-95">
      <i className="ph-bold ph-package text-teal-600 text-sm"></i>
      <span className="text-xs font-bold text-gray-900">{farmer.equipment_count || 0} Equipment</span>
    </button>
    <button // e.g. Crops button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);  
  router.push(`/farmer-profile?id=${farmer.id}&tab=followers`);
}}
      className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors active:scale-95">
      <i className="ph-bold ph-users text-gray-600 text-sm"></i>
      <span className="text-xs font-bold text-gray-900">{farmer.followers_count || 0} Followers</span>
    </button>
  </>) :(
                        <>
                          <button // e.g. Crops button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);  
  router.push(`/farmer-profile?id=${farmer.id}&tab=crops`);
}} className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors active:scale-95">
                            <i className="ph-bold ph-shopping-bag text-orange-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.crops_count || 0} Buying Interests</span>
                          </button>
                          <button // e.g. Crops button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);  
  router.push(`/farmer-profile?id=${farmer.id}&tab=followers`);
}} className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors active:scale-95">
                            <i className="ph-bold ph-users text-purple-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.followers_count || 0} Followers</span>
                          </button>
                        </>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3" onClick={e => e.stopPropagation()}>
                      <button onClick={e => { e.preventDefault(); e.stopPropagation(); const p = (farmer as any).phone; if (p) window.location.href = `tel:${p}`; else alert('Phone number not available.'); }}
                        className="flex-1 py-3 bg-green-50 text-green-700 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform hover:bg-green-100 flex items-center justify-center gap-2">
                        <i className="ph-bold ph-phone"></i>Call
                      </button>
                      <button onClick={e => { e.preventDefault(); e.stopPropagation(); router.push(`/messages?ownerId=${farmer.id}&ownerName=${encodeURIComponent(farmer.name)}`); }}
                        className="flex-1 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform hover:bg-blue-100 flex items-center justify-center gap-2">
                        <i className="ph-bold ph-chat-circle"></i>Chat
                      </button>
                      <button onClick={e => {
                        e.preventDefault(); e.stopPropagation();
                        const dest = farmer.latitude && farmer.longitude
                          ? `${farmer.latitude},${farmer.longitude}`
                          : farmer.location ? encodeURIComponent(farmer.location) : null;
                        if (!dest) { alert('This user has not set a location yet.'); return; }
                        const origin = userLocation ? `${userLocation.latitude},${userLocation.longitude}` : '';
                        window.open(`https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin}` : ''}&destination=${dest}`, '_blank');
                      }} className="flex-1 py-3 bg-purple-50 text-purple-700 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform hover:bg-purple-100 flex items-center justify-center gap-2">
                        <i className="ph-bold ph-directions"></i>Maps
                      </button>
                    </div>
                  </div>
                ))}

                {filteredFarmers.length > visibleCount && (
                  <div className="flex justify-center mt-6">
                    <button onClick={() => setVisibleCount(p => p + 50)} className="px-6 py-3 bg-brand-700 text-white rounded-xl font-bold text-sm hover:bg-brand-800 active:scale-95 transition">
                      Load More
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </section>
      </div>
    </>
  );
}

export default function NearbyFarmersPage() {
  return (
    <Suspense fallback={
      <div className="w-full min-h-[100dvh] bg-brand-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    }>
      <NearbyFarmersContent />
    </Suspense>
  );
}