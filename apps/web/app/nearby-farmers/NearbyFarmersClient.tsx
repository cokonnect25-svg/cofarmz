'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { normalizePhoneNumber } from '@/lib/phone';

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { getApiUrl } from '@/lib/api';

interface FarmerCrop {
  crop_name: string;
  years_of_experience: number | null;
  expertise_level: string;
}

interface Equipment {
  id: string;
  name: string;
  model: string;
  daily_rate: number;
  image_url: string;
}

interface Farmer {
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
  phone?: string;
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

const NEARBY_STATE_KEY = 'cofarmz_nearby_farmers_state';

function getSavedNearbyState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(NEARBY_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function NearbyFarmersClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loadingFarmers, setLoadingFarmers] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const initialType = (searchParams.get('type') === 'buyers' ? 'buyers' : 'farmers');
  const savedState = getSavedNearbyState();
  const [searchType, setSearchType] = useState<'farmers' | 'buyers'>(
    savedState?.searchType === 'buyers' || savedState?.searchType === 'farmers'
      ? savedState.searchType
      : initialType
  );
  const [searchQuery, setSearchQuery] = useState(savedState?.searchQuery || '');
  const [sortBy, setSortBy] = useState(savedState?.sortBy || 'nearby');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [filters, setFilters] = useState({
    distance: savedState?.filters?.distance ?? 50,
    minRating: savedState?.filters?.minRating ?? 0,
    crops: Array.isArray(savedState?.filters?.crops) ? savedState.filters.crops : [] as string[],
    equipment: Array.isArray(savedState?.filters?.equipment) ? savedState.filters.equipment : [] as string[],
    enableDistance: savedState?.filters?.enableDistance ?? false,
    yieldDateFrom: savedState?.filters?.yieldDateFrom ?? '',
    yieldDateTo: savedState?.filters?.yieldDateTo ?? '',
    wasteOnly: savedState?.filters?.wasteOnly ?? false
  });
  const restoredScrollRef = useRef(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, mounted, router]);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      getUserLocation();
    }
  }, [mounted, isAuthenticated]);

  useEffect(() => {
    if (userLocation) {
      fetchNearbyFarmers(userLocation.latitude, userLocation.longitude, searchType);
    }
  }, [searchType, userLocation]);

  useEffect(() => {
    const saveOnLeave = () => saveNearbyState();
    window.addEventListener('pagehide', saveOnLeave);
    return () => {
      saveNearbyState();
      window.removeEventListener('pagehide', saveOnLeave);
    };
  }, [searchType, searchQuery, sortBy, filters]);

  const filteredFarmers = farmers
    .filter((farmer) => {
      const matchesSearch = searchQuery === '' ||
        (farmer.name && farmer.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (farmer.location && farmer.location.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'nearby') return (a.distance || 9999) - (b.distance || 9999);
      if (sortBy === 'experience') {
        const aExp = a.crops?.reduce((sum, c) => sum + (c.years_of_experience || 0), 0) || 0;
        const bExp = b.crops?.reduce((sum, c) => sum + (c.years_of_experience || 0), 0) || 0;
        return bExp - aExp;
      }
      if (sortBy === 'active') {
        return (b.equipment_count || 0) - (a.equipment_count || 0);
      }
      return 0;
    });

  useEffect(() => {
    if (loadingFarmers || restoredScrollRef.current || filteredFarmers.length === 0) return;
    const saved = getSavedNearbyState();
    if (!saved?.scrollY) return;

    restoredScrollRef.current = true;
    requestAnimationFrame(() => {
      window.scrollTo({ top: saved.scrollY, behavior: 'auto' });
    });
  }, [loadingFarmers, farmers.length]);

  const saveNearbyState = () => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(NEARBY_STATE_KEY, JSON.stringify({
      scrollY: window.scrollY,
      searchType,
      searchQuery,
      sortBy,
      filters,
      savedAt: Date.now(),
    }));
  };

  const navigateAndRemember = (href: string) => {
    saveNearbyState();
    router.push(href);
  };

  const getUserLocation = async () => {
    try {
      setLocationError(null);
      let position;
      let hasLocation = false;

      if (Capacitor.isNativePlatform()) {
        try {
          position = await Geolocation.getCurrentPosition();
          hasLocation = true;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn('Native geolocation failed:', msg);
        }
      } else {
        try {
          position = await Promise.race([
            new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                  coords: {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                  }
                }),
                reject,
                { timeout: 5000, enableHighAccuracy: false }
              );
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 6000))
          ]);
          hasLocation = true;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn('Web geolocation failed:', msg);
        }
      }

      let lat = 28.6139; // Default Delhi location
      let lon = 77.209;

      if (hasLocation && position) {
        const pos = position as any;
        lat = pos.coords?.latitude || pos.latitude || lat;
        lon = pos.coords?.longitude || pos.longitude || lon;
      }

      setUserLocation({ latitude: lat, longitude: lon });
      fetchNearbyFarmers(lat, lon);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Location error:', errorMsg);
      const defaultLat = 28.6139;
      const defaultLon = 77.209;
      setUserLocation({ latitude: defaultLat, longitude: defaultLon });
      fetchNearbyFarmers(defaultLat, defaultLon);
    }
  };

  const fetchNearbyFarmers = async (latitude: number, longitude: number, type: 'farmers' | 'buyers' = 'farmers') => {
    setLoadingFarmers(true);
    try {
      const params = new URLSearchParams();
      params.append('latitude', latitude.toString());
      params.append('longitude', longitude.toString());
      params.append('type', type);
      if (user?.id) params.append('currentUserId', user.id);
      if (filters.enableDistance) params.append('distance', filters.distance.toString());
      params.append('minRating', filters.minRating.toString());
      if (filters.crops.length > 0) params.append('crops', filters.crops.join(','));
      if (filters.equipment.length > 0) params.append('equipment', filters.equipment.join(','));
      if (filters.yieldDateFrom) params.append('yieldDateFrom', filters.yieldDateFrom);
      if (filters.yieldDateTo) params.append('yieldDateTo', filters.yieldDateTo);
      if (type === 'buyers' && filters.wasteOnly) params.append('wasteOnly', 'true');

      const url = getApiUrl(`/api/nearby-farmers?${params.toString()}`);
      const response = await fetch(url, user?.id ? { headers: { 'x-user-id': user.id } } : undefined);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      setFarmers(Array.isArray(data) ? data : data.farmers || []);
    } catch (error) {
      console.error('Error fetching', type + ':', error);
      setFarmers([]);
    } finally {
      setLoadingFarmers(false);
    }
  };

  const handleApplyFilters = () => {
    if (userLocation) {
      fetchNearbyFarmers(userLocation.latitude, userLocation.longitude, searchType);
      setShowFilter(false);
    }
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

  const toggleCropFilter = (crop: string) => {
    setFilters(prev => ({
      ...prev,
      crops: prev.crops.includes(crop) ? prev.crops.filter((c: string) => c !== crop) : [...prev.crops, crop]
    }));
  };

  const toggleEquipmentFilter = (equipment: string) => {
    setFilters(prev => ({
      ...prev,
      equipment: prev.equipment.includes(equipment) ? prev.equipment.filter((e: string) => e !== equipment) : [...prev.equipment, equipment]
    }));
  };

  if (!mounted || loading || !isAuthenticated) return null;

  return (
    <div className="pt-4 text-gray-800 relative min-min-h-[100dvh]">
      <header className="w-full px-6 pb-6 relative z-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-gray-900" onClick={() => router.push('/')}>
              <i className="ph-bold ph-arrow-left mt-0.5"></i>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{searchType === 'farmers' ? 'Nearby Farmers' : 'Nearby Buyers'}</h1>
          </div>
          <button className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-brand-700" onClick={() => setShowFilter(!showFilter)}>
            <i className="ph-bold ph-sliders-horizontal mt-0.5"></i>
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {[
            { id: 'farmers', icon: 'ph-leaf', label: 'Farmers' },
            { id: 'buyers', icon: 'ph-shopping-cart', label: 'Buyers' }
          ].map(type => (
            <button
              key={type.id}
              onClick={() => { setSearchType(type.id as any); setSortBy('nearby'); restoredScrollRef.current = false; window.scrollTo({ top: 0, behavior: 'auto' }); }}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${searchType === type.id ? 'bg-brand-700 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              <i className={`ph-bold ${type.icon} mr-2`}></i>{type.label}
            </button>
          ))}
        </div>

        <div className="relative mb-3">
          <input
            type="text"
            placeholder={`Search by name or location...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-900"
          />
          <i className="ph-bold ph-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
        </div>

        {/* Sort Bar */}
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-500">{farmers.filter(f => searchQuery === '' || f.name?.toLowerCase().includes(searchQuery.toLowerCase())).length} results</p>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-gray-900 shadow-soft font-medium text-sm"
            onClick={() => setShowSortMenu(true)}
          >
            <i className="ph-bold ph-funnel text-base"></i>
            {sortBy === 'nearby' ? 'Nearby' : sortBy === 'experience' ? 'Experience' : 'Most Active'}
            <i className="ph-bold ph-caret-down text-sm"></i>
          </button>
        </div>
      </header>

      {/* Sort Bottom Sheet */}
      {showSortMenu && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end" style={{backgroundColor:'rgba(0,0,0,0.45)'}} onClick={() => setShowSortMenu(false)}>
          <div className="bg-white rounded-t-3xl px-4 pb-8 pt-4" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5"></div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Sort By</p>
            {(searchType === 'farmers' ? [
              { key: 'nearby', label: 'Nearby First', sub: 'Sort by distance', icon: 'ph-map-pin' },
              { key: 'experience', label: 'Most Experienced', sub: 'Sort by years of experience', icon: 'ph-medal' },
            ] : [
              { key: 'nearby', label: 'Nearby First', sub: 'Sort by distance', icon: 'ph-map-pin' },
              { key: 'active', label: 'Most Active', sub: 'Sort by activity & listings', icon: 'ph-lightning' },
            ]).map(opt => (
              <button
                key={opt.key}
                onClick={() => { setSortBy(opt.key); setShowSortMenu(false); restoredScrollRef.current = false; window.scrollTo({ top: 0, behavior: 'auto' }); }}
                className={`flex w-full items-center gap-4 px-4 py-4 rounded-2xl mb-2 transition-all ${sortBy === opt.key ? 'bg-emerald-50 border-2 border-emerald-500' : 'bg-gray-50 border-2 border-transparent'}`}
              >
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

      {showFilter && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={() => setShowFilter(false)}>
          <div className="w-full mx-4 bg-white rounded-2xl p-6 max-w-sm shadow-2xl overflow-y-auto max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Filters</h2><button onClick={() => setShowFilter(false)}><i className="ph-bold ph-x"></i></button></div>
            <div className="mb-8 font-bold text-sm text-gray-600">Filters by Rating, Crops, and Equipment. Click Apply to results.</div>
            <button onClick={handleApplyFilters} className="w-full py-3.5 bg-brand-700 text-white rounded-xl font-bold">Apply Filters</button>
          </div>
        </div>
      )}

      <section className="px-6 relative z-10 flex flex-col gap-5">
        {loadingFarmers ? (
          <div className="flex items-center justify-center py-10"><div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin"></div></div>
        ) : filteredFarmers.length === 0 ? (
          <div className="text-center py-10 text-gray-500 font-bold">No results found</div>
        ) : (
          filteredFarmers.map(farmer => (
            <div key={farmer.id} className="bg-white rounded-[24px] p-5 shadow-soft border border-gray-50 cursor-pointer" onClick={() => navigateAndRemember(`/farmer-profile?id=${farmer.id}`)}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img src={farmer.image || `https://api.dicebear.com/7.x/initials/svg?seed=${farmer.name}`} className="w-12 h-12 rounded-full object-cover" />
                  <div>
                    <h3 className="font-bold text-gray-900 truncate">{farmer.name}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1"><i className="ph-fill ph-map-pin text-brand-600"></i>{farmer.distance?.toFixed(1)} km away</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                  <i className="ph-fill ph-star text-amber-500 text-xs"></i>
                  <span className="text-xs font-bold text-gray-900">{farmer.rating || 'New'}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  className={`flex-1 py-3 rounded-xl font-bold text-sm ${farmer.can_call ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}
                  onClick={e => {
                    e.stopPropagation();
                    saveNearbyState();
                    if (farmer.can_call && farmer.phone) {
                      trackNearbyCall(farmer);
                      window.location.href = `tel:${normalizePhoneNumber(farmer.phone)}`;
                    } else {
                      alert(
                        farmer.calling_enabled === false
                          ? 'Calls are off.'
                          : farmer.followStatus === 'pending'
                          ? 'Waiting for approval.'
                          : 'Follow to call.'
                      );
                    }
                  }}
                >
                  Call
                </button>
                <button className="flex-1 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm" onClick={e => { e.stopPropagation(); navigateAndRemember(`/messages?ownerId=${farmer.id}&ownerName=${encodeURIComponent(farmer.name)}`); }}>Chat</button>
                <button className="flex-1 py-3 bg-purple-50 text-purple-700 rounded-xl font-bold text-sm font-bold" onClick={e => { e.stopPropagation(); saveNearbyState(); window.open(`https://www.google.com/maps/search/${encodeURIComponent(farmer.location)}`, '_blank'); }}>Maps</button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
