'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';
import { normalizePhoneNumber } from '@/lib/phone';

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import UserAvatar from '@/app/components/UserAvatar';

  const SCROLL_KEY = 'nearbyFarmers_scrollY';
const VISIBLE_KEY = 'nearbyFarmers_visibleCount';
const TYPE_KEY = 'nearbyFarmers_searchType'; 
const LOCATION_KEY = 'nearbyFarmers_userLocation';
const FILTERS_KEY = 'nearbyFarmers_filters';
const SEARCH_KEY = 'nearbyFarmers_searchQuery';

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
  products_count: number;
  crops_count: number;
  crops: FarmerCrop[];
  equipment: Equipment[];
  products?: Array<{ id: number; name: string; category?: string; price: number; unit: string; quantity?: number; image_url?: string }>;
  followers_count?: number;
  following_count?: number;
  phone?: string;
  has_phone?: boolean;
  calling_enabled?: boolean;
  can_call?: boolean;
  followStatus?: 'none' | 'pending' | 'accepted';
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

const COUNTRY_OPTIONS = [
  'All countries',
  'India',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'United Arab Emirates',
  'Saudi Arabia',
  'Singapore',
  'Malaysia',
];

// ── Online Status Hook (batch check) — same as chat page ───────────────────
function useOnlineStatuses(userIds: string[]) {
  const [statuses, setStatuses] = useState<Record<string, { isOnline: boolean; lastSeen: string | null }>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (userIds.length === 0) return;
    let shouldReconnect = true;

    const connect = () => {
      if (!shouldReconnect) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/socket`);

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'subscribe_batch', userIds }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'presence_batch') {
              setStatuses(data.statuses);
            } else if (data.type === 'presence') {
              setStatuses(prev => ({
                ...prev,
                [data.userId]: { isOnline: data.isOnline, lastSeen: data.lastSeen }
              }));
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          if (!shouldReconnect) return;
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };

        wsRef.current = ws;
      } catch (e) {}
    };

    connect();

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl(`/api/users/online-batch?userIds=${userIds.join(',')}`));
        if (res.ok) {
          const data = await res.json();
          setStatuses(data.statuses || {});
        }
      } catch {}
    }, 15000);

    return () => {
      shouldReconnect = false;
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      clearInterval(pollInterval);
    };
  }, [userIds.join(',')]);

  return statuses;
}

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
const rawSupplierType = searchParams.get('supplierType');
const rawCrops = searchParams.get('crops');

// Parse crops from URL query param
const urlCropFilters = rawCrops 
  ? rawCrops.split(',').map(c => c.trim()).filter(Boolean) 
  : [];

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
const [supplierType, setSupplierType] = useState<'commodities' | 'equipment'>(
  rawSupplierType === 'equipment' ? 'equipment' : 'commodities'
);
  const [searchQuery, setSearchQuery] = useState(() => {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(SEARCH_KEY) || '';
  }
  return '';
});
  const [sortBy, setSortBy]           = useState('nearby');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [cropFilterSearch, setCropFilterSearch] = useState('');
  const [equipmentFilterSearch, setEquipmentFilterSearch] = useState('');

const defaultFilters = {
  distance:        50,
  minRating:       0,
  crops:           urlCropFilters,
  equipment:       [] as string[],
  enableDistance:  false,
  country:         'India',
  yieldDateFrom:   '',
  yieldDateTo:     '',
  wasteOnly:       initialType === 'wastage', // <-- AUTO-SET FOR WASTAGE
  grades:          [] as string[],
  certTypes:       [] as string[],
};

const [filters, setFilters] = useState(() => {
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem(FILTERS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaultFilters,
          ...parsed,
          country: parsed.country || 'India',
          crops: Array.isArray(parsed.crops) ? parsed.crops : defaultFilters.crops,
          equipment: Array.isArray(parsed.equipment) ? parsed.equipment : [],
          grades: Array.isArray(parsed.grades) ? parsed.grades : [],
          certTypes: Array.isArray(parsed.certTypes) ? parsed.certTypes : [],
        };
      } catch {}
    }
  }
  return defaultFilters;
});

const [visibleCount, setVisibleCount] = useState(() => {
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem(VISIBLE_KEY);
    if (saved) return parseInt(saved);
  }
  return 50;
});
const isRestoringRef = useRef(false); 
const scrollContainerRef = useRef<HTMLDivElement>(null);

const pendingScrollRef = useRef<number | null>(null);

// Only track presence for farmers currently loaded — avoids subscribing to huge/unbounded ID lists
const farmerIds = useMemo(() => farmers.map(f => f.id), [farmers]);
const onlineStatuses = useOnlineStatuses(farmerIds);

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

  const cropPickerOptions = useMemo(() => {
    const query = cropFilterSearch.trim().toLowerCase();
    const options = Array.from(new Set([...filters.crops, ...availableCrops, ...CROP_OPTIONS]));
    return options
      .filter(crop => !query || crop.toLowerCase().includes(query))
      .sort((a, b) => {
        const aSelected = filters.crops.includes(a);
        const bSelected = filters.crops.includes(b);
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        return a.localeCompare(b);
      });
  }, [availableCrops, cropFilterSearch, filters.crops]);

  const equipmentPickerOptions = useMemo(() => {
    const query = equipmentFilterSearch.trim().toLowerCase();
    return Array.from(new Set([...filters.equipment, ...EQUIPMENT_OPTIONS]))
      .filter(equip => !query || equip.toLowerCase().includes(query))
      .sort((a, b) => {
        const aSelected = filters.equipment.includes(a);
        const bSelected = filters.equipment.includes(b);
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        return a.localeCompare(b);
      });
  }, [equipmentFilterSearch, filters.equipment]);

  useEffect(() => {
  if (isRestoringRef.current) return; // don't reset while restoring
  setVisibleCount(50);
}, [searchType, filters, searchQuery]);

  useEffect(() => { setMounted(true); }, []);

  // Restore scroll position when returning to this page
// REPLACE the existing restore useEffect with this:
// Restore scroll position when returning to this page

// Auto-apply URL crop filters when location is ready
useEffect(() => {
  if (!mounted) return;

  const savedVisible = sessionStorage.getItem(VISIBLE_KEY);
  const savedScroll  = sessionStorage.getItem(SCROLL_KEY);
  const savedType    = sessionStorage.getItem(TYPE_KEY);
  const savedFilters = sessionStorage.getItem(FILTERS_KEY); // ← READ FILTERS
  
  // Remove them so they don't persist across unrelated visits
  sessionStorage.removeItem(VISIBLE_KEY);
  sessionStorage.removeItem(SCROLL_KEY);
  // Only remove TYPE_KEY if URL doesn't have one (so we preserve back-nav)
  if (!rawType) {
    sessionStorage.removeItem(TYPE_KEY);
  }
  sessionStorage.removeItem(FILTERS_KEY); // ← REMOVE FILTERS

  // Restore filters FIRST (before any fetch triggers)
  if (savedFilters) {
    try {
      const parsed = JSON.parse(savedFilters);
      const restoredFilters = {
        ...defaultFilters,
        ...parsed,
        country: parsed.country || 'India',
        crops: Array.isArray(parsed.crops) ? parsed.crops : defaultFilters.crops,
        equipment: Array.isArray(parsed.equipment) ? parsed.equipment : [],
        grades: Array.isArray(parsed.grades) ? parsed.grades : [],
        certTypes: Array.isArray(parsed.certTypes) ? parsed.certTypes : [],
      };
      setFilters(restoredFilters);
      filtersRef.current = restoredFilters; // keep ref in sync
    } catch {}
  }

  if (savedVisible) {
    isRestoringRef.current = true;
    setVisibleCount(parseInt(savedVisible));
  }
  if (savedScroll) {
    pendingScrollRef.current = parseInt(savedScroll);
  }
}, [mounted, rawType]);

  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, loading, mounted, router]);

  useEffect(() => {
    if (mounted && isAuthenticated) getUserLocation();
  }, [mounted, isAuthenticated]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    if (!userLocation) return;
    fetchNearbyFarmers(userLocation.latitude, userLocation.longitude, searchType);
  }, [searchType, supplierType, userLocation, mounted, isAuthenticated]);

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
  sessionStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  sessionStorage.setItem(SEARCH_KEY, searchQuery); // ← add this
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
    setLocationError('Location is required. Please allow location access to continue.');
    setFarmers([]);
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
  setFarmers([]);
  setLocationError('Location is required. Please allow location access to continue.');
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
    if (!latitude || !longitude || (latitude === 0 && longitude === 0)) {
      setFarmers([]);
      setLoadingFarmers(false);
      setLocationError('Location is required. Please allow location access to continue.');
      return;
    }
    setLoadingFarmers(true);
    try {
      const params = new URLSearchParams();
      params.append('latitude',  latitude.toString());
      params.append('longitude', longitude.toString());
      params.append('type', type);
      if (type === 'supplier') params.append('supplierType', supplierType);
      if (user?.id) params.append('currentUserId', user.id);
      if (f.enableDistance) params.append('distance', f.distance.toString());
      if (f.country && f.country !== 'All countries') params.append('country', f.country);
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

      const response = await fetch(url, user?.id ? { headers: { 'x-user-id': user.id } } : undefined);
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

const handleCountryChange = (country: string) => {
  const next = { ...filters, country };
  setFilters(next);
  sessionStorage.removeItem(SCROLL_KEY);
  sessionStorage.removeItem(VISIBLE_KEY);
  sessionStorage.removeItem(TYPE_KEY);

  const lat = userLocation?.latitude ?? 0;
  const lon = userLocation?.longitude ?? 0;
  fetchNearbyFarmers(lat, lon, searchType, next);
};

  const trackNearbyCall = (farmer: any) => {
    fetch(getApiUrl('/api/analytics'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'call_contact',
        userId: user?.id || null,
        userName: user?.name || null,
        userEmail: user?.email || null,
        pagePath: `/nearby-farmers?type=${searchType}`,
        entityType: 'user',
        entityId: farmer.id,
        entityName: farmer.name,
        metadata: {
          source: 'nearby_farmers',
          type: searchType,
          distance: farmer.distance ?? null,
        },
      }),
    }).catch(() => {});
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
 searchType === 'supplier' ? (supplierType === 'commodities' ? 'Commodity Suppliers' : 'Equipment Suppliers')  :
 searchType === 'fpo'      ? 'Nearby FPOs'       : 'Nearby'}
              </h1>
            </div>
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

{searchType === 'supplier' && (
  <div className="flex gap-2 mb-4">
    {([
      { key: 'commodities', label: 'Commodities', icon: 'ph-package' },
      { key: 'equipment', label: 'Equipment', icon: 'ph-tractor' },
    ] as const).map(tab => (
      <button
        key={tab.key}
        onClick={() => {
          setSupplierType(tab.key);
          setSortBy('nearby');
          sessionStorage.removeItem(SCROLL_KEY);
          sessionStorage.removeItem(VISIBLE_KEY);
        }}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
          supplierType === tab.key ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-purple-700 shadow-soft'
        }`}
      >
        <i className={`ph-bold ${tab.icon}`}></i>
        {tab.label}
      </button>
    ))}
  </div>
)}

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

              {/* Country */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-900 mb-3">Country</label>
                <div className="relative">
                  <select
                    value={filters.country}
                    onChange={e => setFilters(p => ({ ...p, country: e.target.value }))}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-3 pr-10 text-sm font-medium text-gray-900 outline-none focus:border-brand-600"
                  >
                    {COUNTRY_OPTIONS.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                  <i className="ph-bold ph-caret-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                </div>
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
<div className="mb-8">
  <label className="block text-sm font-bold text-gray-900 mb-3">
    Crops (search and select any)
    {cropPickerOptions.length > 0 && (
      <span className="ml-2 text-xs font-normal text-gray-400">
        {cropPickerOptions.length} shown
      </span>
    )}
  </label>

  {filters.crops.length > 0 && (
    <div className="mb-3 flex flex-wrap gap-2 rounded-xl bg-brand-50 p-3">
      {filters.crops.map(crop => (
        <button
          key={`selected-crop-${crop}`}
          onClick={() => toggleCropFilter(crop)}
          className="px-3 py-1.5 bg-white text-brand-700 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm"
        >
          {crop}<i className="ph-bold ph-x text-sm"></i>
        </button>
      ))}
    </div>
  )}

  <div className="relative mb-3">
    <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
    <input
      type="text"
      value={cropFilterSearch}
      onChange={e => setCropFilterSearch(e.target.value)}
      placeholder="Search crops"
      className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-brand-600"
    />
  </div>

  {cropPickerOptions.length === 0 ? (
    <p className="text-xs text-gray-400 italic">
      No crops match your search
    </p>
  ) : (
    <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-gray-100 p-2">
      {cropPickerOptions.map(crop => (
        <button
          key={crop}
          onClick={() => {
            toggleCropFilter(crop);
            setCropFilterSearch('');
          }}
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
                <label className="block text-sm font-bold text-gray-900 mb-3">Equipment (search and select any)</label>

                {filters.equipment.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2 rounded-xl bg-blue-50 p-3">
                    {filters.equipment.map(equip => (
                      <button
                        key={`selected-equip-${equip}`}
                        onClick={() => toggleEquipmentFilter(equip)}
                        className="px-3 py-1.5 bg-white text-blue-700 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm"
                      >
                        {equip}<i className="ph-bold ph-x text-sm"></i>
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative mb-3">
                  <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input
                    type="text"
                    value={equipmentFilterSearch}
                    onChange={e => setEquipmentFilterSearch(e.target.value)}
                    placeholder="Search equipment"
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-brand-600"
                  />
                </div>

                {equipmentPickerOptions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No equipment matches your search</p>
                ) : (
                  <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-gray-100 p-2">
                    {equipmentPickerOptions.map(equip => (
                      <button
                        key={equip}
                        onClick={() => {
                          toggleEquipmentFilter(equip);
                          setEquipmentFilterSearch('');
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${filters.equipment.includes(equip) ? 'bg-brand-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {equip}
                      </button>
                    ))}
                  </div>
                )}
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
        <section className="px-6 mb-4 relative z-10 flex items-center justify-end overflow-x-auto hide-scrollbar">
          <div className="ml-auto flex max-w-full flex-nowrap items-center justify-end gap-1.5 rounded-2xl border border-white/80 bg-white/85 p-1.5 shadow-soft backdrop-blur">
            <button
              className="flex h-10 flex-shrink-0 items-center gap-2 rounded-xl border border-transparent px-3.5 text-sm font-bold text-gray-900 transition hover:border-gray-100 hover:bg-gray-50 active:scale-[0.98]"
              onClick={() => setShowSortMenu(true)}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <i className="ph-bold ph-map-pin text-base"></i>
              </span>
              <span className="whitespace-nowrap">{sortBy === 'nearby' ? 'Nearby' : sortBy === 'experience' ? 'Experience' : 'Most Active'}</span>
              <i className="ph-bold ph-caret-down text-xs text-gray-400"></i>
            </button>
            <button
              className="relative flex h-10 flex-shrink-0 items-center gap-2 rounded-xl border border-transparent px-3.5 text-sm font-bold text-brand-700 transition hover:border-brand-100 hover:bg-brand-50 active:scale-[0.98]"
              onClick={() => setShowFilter(true)}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <i className="ph-bold ph-sliders-horizontal text-base"></i>
              </span>
              <span>Filter</span>
              {(filters.crops.length > 0 || filters.equipment.length > 0 || filters.grades.length > 0 || filters.certTypes.length > 0) && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand-700"></span>
              )}
            </button>
            <label className="sr-only" htmlFor="nearby-country">Country</label>
            <div className="relative h-10 w-[142px] flex-shrink-0 sm:w-[168px]">
              <i className="ph-bold ph-globe-hemisphere-east pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-gray-400"></i>
              <select
                id="nearby-country"
                value={filters.country}
                onChange={e => handleCountryChange(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-gray-100 bg-white pl-9 pr-8 text-sm font-bold text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                {COUNTRY_OPTIONS.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              <i className="ph-bold ph-caret-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400"></i>
            </div>
          </div>
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
saveStateAndNavigate(`/farmer-profile?id=${farmer.id}`);
}}>

                    {/* Header row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="relative flex-shrink-0">
<div className="relative flex-shrink-0">
  <UserAvatar image={farmer.image} name={farmer.name} size={48} className="rounded-full" />
  <span
    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
      onlineStatuses[farmer.id]?.isOnline ? 'bg-green-500' : 'bg-gray-300'
    }`}
    title={onlineStatuses[farmer.id]?.isOnline ? 'Online' : 'Offline'}
  />
</div>  <span
    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
      onlineStatuses[farmer.id]?.isOnline ? 'bg-green-500' : 'bg-gray-300'
    }`}
    title={onlineStatuses[farmer.id]?.isOnline ? 'Online' : 'Offline'}
  />
</div>
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
  sessionStorage.setItem(SEARCH_KEY, searchQuery);   
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
  sessionStorage.setItem(SEARCH_KEY, searchQuery); 
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
                    <div className="flex flex-wrap gap-2 mb-4">
                      {searchType === 'farmers' ? (
                        <>
                          <button // e.g. Crops button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);
  saveStateAndNavigate(`/farmer-profile?id=${farmer.id}&tab=crops`);
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
  saveStateAndNavigate(`/farmer-profile?id=${farmer.id}&tab=equipment`);
}} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors active:scale-95">
                            <i className="ph-bold ph-wrench text-blue-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.equipment_count || 0} Equipment</span>
                          </button>
                          <button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);
  saveStateAndNavigate(`/farmer-profile?id=${farmer.id}&tab=products`);
}} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors active:scale-95">
                            <i className="ph-bold ph-package text-emerald-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.products_count || 0} Products</span>
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
  saveStateAndNavigate(`/farmer-profile?id=${farmer.id}&tab=${supplierType === 'commodities' ? 'crops' : 'equipment'}`);
}} className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors active:scale-95">
                            <i className={`ph-bold ${supplierType === 'commodities' ? 'ph-package' : 'ph-tractor'} text-purple-600 text-sm`}></i>
                            <span className="text-xs font-bold text-gray-900">{supplierType === 'commodities' ? (farmer.crops_count || 0) : (farmer.equipment_count || 0)} {supplierType === 'commodities' ? 'Commodities' : 'Equipment'}</span>
                          </button>
                          <button // e.g. Crops button
onClick={e => {
  e.stopPropagation();
  sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
  sessionStorage.setItem(VISIBLE_KEY, visibleCount.toString());
  sessionStorage.setItem(TYPE_KEY, searchType);
  saveStateAndNavigate(`/farmer-profile?id=${farmer.id}&tab=followers`);
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
  sessionStorage.setItem(SEARCH_KEY, searchQuery); 
  saveStateAndNavigate(`/farmer-profile?id=${farmer.id}&tab=equipment`);
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
  sessionStorage.setItem(SEARCH_KEY, searchQuery);  
  saveStateAndNavigate(`/farmer-profile?id=${farmer.id}&tab=followers`);
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
  sessionStorage.setItem(SEARCH_KEY, searchQuery);  
  saveStateAndNavigate(`/farmer-profile?id=${farmer.id}&tab=crops`);
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
  sessionStorage.setItem(SEARCH_KEY, searchQuery);  
  saveStateAndNavigate(`/farmer-profile?id=${farmer.id}&tab=followers`);
}} className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors active:scale-95">
                            <i className="ph-bold ph-users text-purple-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.followers_count || 0} Followers</span>
                          </button>
                        </>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3" onClick={e => e.stopPropagation()}>
                      <button onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (farmer.can_call && farmer.phone) {
                          trackNearbyCall(farmer);
                          window.location.href = `tel:${normalizePhoneNumber(farmer.phone)}`;
                        } else {
                          alert(farmer.has_phone === false ? 'Phone number is not available.' : farmer.calling_enabled === false ? 'Calls are off.' : farmer.followStatus === 'pending' ? 'Waiting for approval.' : 'Follow to call.');
                        }
                      }}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 ${farmer.can_call ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
                        <i className="ph-bold ph-phone"></i>Call
                      </button>
                      <button onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        saveStateAndNavigate(`/messages?ownerId=${farmer.id}&ownerName=${encodeURIComponent(farmer.name)}`);
                      }}
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
