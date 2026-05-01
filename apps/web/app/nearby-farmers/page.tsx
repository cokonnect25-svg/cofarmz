'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';


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

function NearbyFarmersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loadingFarmers, setLoadingFarmers] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const rawType = searchParams.get('type');
  const initialType =
    rawType === 'buyers' ? 'buyers' :
    rawType === 'wastage' ? 'wastage' :
    rawType === 'supplier' ?
    'supplier' :
    'farmers';

  const [searchType, setSearchType] = useState<
    'farmers' | 'buyers' | 'wastage' | 'supplier'
  >(initialType);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('nearby');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [filters, setFilters] = useState({
    distance: 50,
    minRating: 0,
    crops: [] as string[],
    equipment: [] as string[],
    enableDistance: false,
    yieldDateFrom: '',
    yieldDateTo: '',
    wasteOnly: false
  });
  const [visibleCount, setVisibleCount] = useState(50);

  const today = new Date().toISOString().split('T')[0];


  useEffect(() => {
    setVisibleCount(50);
  }, [searchType, filters, searchQuery]);

  // No in-app call - using native tel: dial

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
    if (!mounted || !isAuthenticated) return;
    const lat = userLocation?.latitude ?? 0;
    const lon = userLocation?.longitude ?? 0;
    fetchNearbyFarmers(lat, lon, searchType);
  }, [searchType, userLocation, mounted, isAuthenticated]);

  // Listen for location update from popup
  useEffect(() => {
    const handler = (e: any) => {
      const { latitude, longitude } = e.detail;
      setUserLocation({ latitude, longitude });
      fetchNearbyFarmers(latitude, longitude, searchType);
    };
    window.addEventListener('userLocationUpdated', handler);
    return () => window.removeEventListener('userLocationUpdated', handler);
  }, [searchType]);

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
        // Web fallback with timeout
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

      if (hasLocation && position) {
        const pos = position as any;
        const lat = pos.coords?.latitude || pos.latitude;
        const lon = pos.coords?.longitude || pos.longitude;
        setUserLocation({ latitude: lat, longitude: lon });
        fetchNearbyFarmers(lat, lon, searchType);
      } else {
        // GPS failed — try stored location from DB
        await useStoredLocation();
      }
    } catch (error: any) {
      await useStoredLocation();
    }
  };

  const useStoredLocation = async () => {
    if (!user?.id) {
      fetchNearbyFarmers(0, 0, searchType);
      return;
    }
    try {
      const res = await fetch(getApiUrl(`/api/farmers/profile?farmerId=${user.id}`), { headers: { 'x-user-id': user.id } });
      if (res.ok) {
        const data = await res.json();
        if (data.latitude && data.longitude) {
          const lat = parseFloat(data.latitude);
          const lon = parseFloat(data.longitude);
          if (lat !== 0 || lon !== 0) {
            setUserLocation({ latitude: lat, longitude: lon });
            fetchNearbyFarmers(lat, lon, searchType);
            return;
          }
        }
      }
    } catch { }
    // No valid location found — fetch list without distance (all 9999, sorted by name)
    setUserLocation(null);
    fetchNearbyFarmers(0, 0, searchType);
  };

  const fetchNearbyFarmers = async (latitude: number, longitude: number, type: 'farmers' | 'buyers' | 'wastage' | 'supplier' = 'farmers') => {
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
      if (type === 'wastage' || (type === 'buyers' && filters.wasteOnly)) params.append('wasteOnly', 'true');

      const url = getApiUrl(`/api/nearby-farmers?${params.toString()}`);
      console.log('Fetching', type, 'from:', url);

      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      console.log(type, 'fetched successfully:', data?.length || 0, type);
      setFarmers(Array.isArray(data) ? data : data.farmers || []);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching', type + ':', errorMsg);
      setFarmers([]);
    } finally {
      setLoadingFarmers(false);
    }
  };

  const handleApplyFilters = () => {
    const lat = userLocation?.latitude ?? 0;
    const lon = userLocation?.longitude ?? 0;
    fetchNearbyFarmers(lat, lon, searchType);
    setShowFilter(false);
  };

  const toggleCropFilter = (crop: string) => {
    setFilters(prev => ({
      ...prev,
      crops: prev.crops.includes(crop)
        ? prev.crops.filter(c => c !== crop)
        : [...prev.crops, crop]
    }));
  };

  const toggleEquipmentFilter = (equipment: string) => {
    setFilters(prev => ({
      ...prev,
      equipment: prev.equipment.includes(equipment)
        ? prev.equipment.filter(e => e !== equipment)
        : [...prev.equipment, equipment]
    }));
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
                {searchType === 'farmers'
                  ? 'Nearby Farmers'
                  : searchType === 'buyers'
                  ? 'Nearby Buyers'
                  : searchType === 'wastage'
                  ? 'Crop Waste Buyers'
                  : searchType === 'supplier'
                  ? 'Nearby supplier'
                  : 'Nearby'}
              </h1>
            </div>
            <button
              className="relative w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-brand-700 active:scale-95 transition-transform"
              onClick={() => setShowFilter(!showFilter)}
            >
              <i className="ph-bold ph-sliders-horizontal text-lg"></i>
            </button>
          </div>

          {/* Toggle Farmers/Buyers/Wastage/suppliers */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setSearchType('farmers'); setSortBy('nearby'); }}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${searchType === 'farmers'
                ? 'bg-brand-700 text-white'
                : 'bg-gray-100 text-gray-700'
                }`}
            >
              <i className="ph-bold ph-leaf mr-1"></i>Farmers
            </button>
            <button
              onClick={() => { setSearchType('buyers'); setSortBy('nearby'); }}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${searchType === 'buyers'
                ? 'bg-brand-700 text-white'
                : 'bg-gray-100 text-gray-700'
                }`}
            >
              <i className="ph-bold ph-shopping-cart mr-1"></i>Buyers
            </button>
            <button
              onClick={() => { setSearchType('wastage'); setSortBy('nearby'); }}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${searchType === 'wastage'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700'
                }`}
            >
              <i className="ph-bold ph-recycle mr-1"></i>Wastage
            </button>

            <button
              onClick={() => { setSearchType('supplier'); setSortBy('nearby'); }}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${searchType === 'supplier'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700'
                }`}
            >
              🏭 suppliers
            </button>
          </div>

          {/* Search Input */}
          <div className="relative mb-4">
            <input
              type="text"
              placeholder={`Search by name or location or crops...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-brand-600 text-sm"
            />
            <i className="ph-bold ph-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none"></i>
          </div>

          {locationError && (
            <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              {locationError}
            </div>
          )}
        </header>

        {/* Filter Modal */}
        {showFilter && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={() => setShowFilter(false)}
          >
            <div
              className="w-full mx-4 bg-white rounded-2xl p-6 max-w-sm shadow-2xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pb-4">
                <h2 className="text-xl font-bold text-gray-900">Filters</h2>
                <button onClick={() => setShowFilter(false)} className="text-gray-500 hover:text-gray-900">
                  <i className="ph-bold ph-x text-xl"></i>
                </button>
              </div>

              {/* Distance Filter */}
              <div className="mb-8">
                <label className="flex items-center gap-3 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.enableDistance}
                    onChange={(e) => setFilters({ ...filters, enableDistance: e.target.checked })}
                    className="w-5 h-5 rounded accent-brand-700"
                  />
                  <span className="text-sm font-bold text-gray-900">Apply Distance Filter</span>
                </label>
                {filters.enableDistance && (
                  <>
                    <label className="block text-sm font-bold text-gray-900 mb-3">
                      Distance: {filters.distance} km
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={filters.distance}
                      onChange={(e) => setFilters({ ...filters, distance: parseInt(e.target.value) })}
                      className="w-full h-2 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-700"
                    />
                  </>
                )}
              </div>

              {/* Rating Filter */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  Minimum Rating: {filters.minRating.toFixed(1)} ⭐
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={filters.minRating}
                  onChange={(e) => setFilters({ ...filters, minRating: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-700"
                />
              </div>

              {/* Yield Date Filter (for both farmers and buyers) */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  {searchType === 'farmers' ? 'Harvest' : 'Purchase'} Date Range
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">From Date</label>
                    <input
                      type="date"
                      min={today}
                      value={filters.yieldDateFrom}
                      onChange={(e) => setFilters({ ...filters, yieldDateFrom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-brand-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">To Date</label>
                    <input
                      type="date"
                      min={filters.yieldDateFrom || today}
                      value={filters.yieldDateTo}
                      onChange={(e) => setFilters({ ...filters, yieldDateTo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-brand-600"
                    />
                  </div>
                </div>
              </div>

              {/* Crop Waste Filter - only for buyers */}
              {searchType === 'buyers' && (
                <div className="mb-8">
                  <label className="flex items-center gap-3 mb-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.wasteOnly}
                      onChange={(e) => setFilters({ ...filters, wasteOnly: e.target.checked })}
                      className="w-5 h-5 rounded accent-orange-600"
                    />
                    <div>
                      <span className="text-sm font-bold text-gray-900">🌾 Crop Waste Buyers Only</span>
                      <p className="text-xs text-gray-600 mt-0.5">Find buyers of agricultural waste, straw & husks</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Crop Filter */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-900 mb-3">Crops (select any)</label>
                <div className="flex flex-wrap gap-2">
                  {CROP_OPTIONS.map((crop) => (
                    <button
                      key={crop}
                      onClick={() => toggleCropFilter(crop)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${filters.crops.includes(crop)
                        ? 'bg-brand-700 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {crop}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment Filter */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-900 mb-3">Equipment (select any)</label>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_OPTIONS.map((equip) => (
                    <button
                      key={equip}
                      onClick={() => toggleEquipmentFilter(equip)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${filters.equipment.includes(equip)
                        ? 'bg-brand-700 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {equip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply Button */}
              <button
                onClick={handleApplyFilters}
                disabled={loadingFarmers}
                className="w-full py-3.5 bg-brand-700 text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {loadingFarmers ? 'Searching...' : 'Apply Filters'}
              </button>
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {(filters.crops.length > 0 || filters.equipment.length > 0) && (
          <section className="px-6 mb-4 relative z-10">
            <div className="flex flex-wrap gap-2">
              {filters.crops.map((crop) => (
                <button
                  key={`crop-${crop}`}
                  onClick={() => toggleCropFilter(crop)}
                  className="px-3 py-1.5 bg-brand-100 text-brand-700 rounded-full text-xs font-medium flex items-center gap-2 active:scale-95 transition-transform"
                >
                  {crop}
                  <i className="ph-bold ph-x text-sm"></i>
                </button>
              ))}
              {filters.equipment.map((equip) => (
                <button
                  key={`equip-${equip}`}
                  onClick={() => toggleEquipmentFilter(equip)}
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-2 active:scale-95 transition-transform"
                >
                  {equip}
                  <i className="ph-bold ph-x text-sm"></i>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Sort Bottom Sheet */}
        {showSortMenu && (
          <div className="fixed inset-0 z-[9999] flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={() => setShowSortMenu(false)}>
            <div className="bg-white rounded-t-3xl px-4 pb-8 pt-4" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5"></div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Sort By</p>
              {(searchType === 'farmers' ? [
                { key: 'nearby', label: 'Nearby First', sub: 'Sort by distance from you', icon: 'ph-map-pin' },
                { key: 'experience', label: 'Most Experienced', sub: 'Sort by years of experience', icon: 'ph-medal' },
              ] : [
                { key: 'nearby', label: 'Nearby First', sub: 'Sort by distance from you', icon: 'ph-map-pin' },
                { key: 'active', label: 'Most Active', sub: 'Sort by equipment & activity', icon: 'ph-lightning' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { setSortBy(opt.key); setShowSortMenu(false); }}
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


        {/* Results Header */}
        <section className="px-6 mb-4 relative z-10 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500">
            {loadingFarmers ? 'Searching...' : `Found ${farmers.length} ${
              searchType === 'farmers' ? 'farmer' :
              searchType === 'wastage' ? 'wastage buyer' :
              searchType === 'supplier' ? 'supplier' :
              'buyer'
            }${farmers.length !== 1 ? 's' : ''}`}
          </p>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-gray-900 shadow-soft font-medium text-sm"
            onClick={() => setShowSortMenu(true)}
          >
            <i className="ph-bold ph-funnel text-base"></i>
            {sortBy === 'nearby' ? 'Nearby' : sortBy === 'experience' ? 'Experience' : 'Most Active'}
            <i className="ph-bold ph-caret-down text-sm"></i>
          </button>
        </section>

        {/* Farmers List */}
        <section className="px-6 relative z-10 flex flex-col gap-5">
          {loadingFarmers ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin"></div>
            </div>
          ) : (() => {
            const filteredFarmers = farmers
              .filter((farmer) => {
                const query = searchQuery.toLowerCase();

                return query === '' ||
                  farmer.name?.toLowerCase().includes(query) ||
                  farmer.location?.toLowerCase().includes(query) ||
                  farmer.crops?.some(crop =>
                    crop.crop_name?.toLowerCase().includes(query)
                  );
              })
              .sort((a, b) => {
                if (sortBy === 'nearby') {
                  const aDist = (!a.distance || a.distance >= 9999) ? 999999 : a.distance;
                  const bDist = (!b.distance || b.distance >= 9999) ? 999999 : b.distance;
                  return aDist - bDist;
                }
                if (sortBy === 'experience') {
                  const aExp = a.crops?.reduce((sum: number, c: any) => sum + (c.years_of_experience || 0), 0) || 0;
                  const bExp = b.crops?.reduce((sum: number, c: any) => sum + (c.years_of_experience || 0), 0) || 0;
                  return bExp - aExp;
                }
                if (sortBy === 'active') return (b.equipment_count || 0) - (a.equipment_count || 0);
                return 0;
              });

            return filteredFarmers.length === 0 ? (
              <div className="text-center py-10">
                <i className="ph-bold ph-magnifying-glass text-4xl text-gray-300 mb-3 block"></i>
                <p className="text-gray-500 font-medium">
                  {searchQuery
                    ? `No ${
                        searchType === 'farmers' ? 'farmers' :
                        searchType === 'wastage' ? 'wastage crop buyers' :
                        searchType === 'supplier' ? 'supplier' :
                        'buyers'
                      } found matching "${searchQuery}"`
                    : `No ${
                        searchType === 'farmers' ? 'farmers' :
                        searchType === 'wastage' ? 'wastage crop buyers' :
                        searchType === 'supplier' ? 'suppliers' :
                        'buyers'
                      } found with selected filters`}
                </p>
              </div>
            ) : (
              <>
                {/* 🔹 LIST */}
                {filteredFarmers.slice(0, visibleCount).map((farmer) => (
                  <div
                    key={farmer.id}
                    className="bg-white rounded-[24px] p-5 shadow-soft hover:shadow-lg transition-shadow cursor-pointer active:scale-[0.98]"
                    onClick={() => router.push(`/farmer-profile?id=${farmer.id}`)}
                  >
                    {/* Farmer Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1">
                        <img
                          src={farmer.image || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + farmer.id}
                          alt={farmer.name}
                          className="w-12 h-12 rounded-full object-cover bg-gray-100"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">{farmer.name}</h3>
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
                          searchType === 'farmers'
                            ? 'bg-green-100 text-green-700'
                            : searchType === 'wastage'
                            ? 'bg-amber-100 text-amber-700'
                            : searchType === 'supplier'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                          }`}>
                          {searchType === 'farmers' ? '🌾 Farmer' :
                           searchType === 'wastage' ? '♻️ Wastage Buyer' :
                           searchType === 'supplier' ? '🏭 supplier' :
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

                    {/* Followers/Following */}
                    <div className="flex gap-3 mb-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/farmer-profile?id=${farmer.id}&tab=followers`);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors active:scale-95"
                      >
                        <i className="ph-bold ph-user-circle text-brand-600 text-sm"></i>
                        <span className="text-xs font-bold text-gray-900">{farmer.followers_count || 0} Followers</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/farmer-profile?id=${farmer.id}&tab=following`);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors active:scale-95"
                      >
                        <i className="ph-bold ph-user-check text-blue-600 text-sm"></i>
                        <span className="text-xs font-bold text-gray-900">{farmer.following_count || 0} Following</span>
                      </button>
                    </div>

                    {/* Crop Tags */}
                    {farmer.crops && farmer.crops.length > 0 && (() => {
                      const displayCrops = searchType === 'wastage'
                        ? farmer.crops.filter((crop: any) => crop.is_crop_waste)
                        : farmer.crops;

                      return displayCrops.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {displayCrops.slice(0, 5).map((crop, i) => (
                            <span
                              key={i}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                searchType === 'farmers'
                                  ? 'bg-green-100 text-green-800'
                                  : searchType === 'wastage'
                                  ? 'bg-amber-100 text-amber-800'
                                  : searchType === 'supplier'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}
                            >
                              {searchType === 'farmers' ? '🌾' :
                               searchType === 'wastage' ? '♻️' :
                               searchType === 'supplier' ? '🏭' :
                               '🛒'} {crop.crop_name}
                            </span>
                          ))}
                          {displayCrops.length > 5 && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                              +{displayCrops.length - 5} more
                            </span>
                          )}
                        </div>
                      ) : null;
                    })()}

                    {/* Stats Row — different for farmers vs buyers vs supplier */}
                    <div className="flex gap-3 mb-4">
                      {searchType === 'farmers' ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/farmer-profile?id=${farmer.id}&tab=crops`); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-green-50 rounded-lg hover:bg-green-100 transition-colors active:scale-95"
                          >
                            <i className="ph-bold ph-plant text-green-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.crops_count || 0} Crops</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/farmer-profile?id=${farmer.id}&tab=equipment`); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors active:scale-95"
                          >
                            <i className="ph-bold ph-wrench text-blue-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.equipment_count || 0} Equipment</span>
                          </button>
                        </>
                      ) : searchType === 'supplier' ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/farmer-profile?id=${farmer.id}&tab=equipment`); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors active:scale-95"
                          >
                            <i className="ph-bold ph-package text-purple-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.equipment_count || 0} Products</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/farmer-profile?id=${farmer.id}&tab=followers`); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors active:scale-95"
                          >
                            <i className="ph-bold ph-users text-gray-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.followers_count || 0} Followers</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/farmer-profile?id=${farmer.id}&tab=crops`); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors active:scale-95"
                          >
                            <i className="ph-bold ph-shopping-bag text-orange-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.crops_count || 0} Buying Interests</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/farmer-profile?id=${farmer.id}&tab=followers`); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors active:scale-95"
                          >
                            <i className="ph-bold ph-users text-purple-600 text-sm"></i>
                            <span className="text-xs font-bold text-gray-900">{farmer.followers_count || 0} Followers</span>
                          </button>
                        </>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                      {/* Call Button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const phone = (farmer as any).phone;
                          if (phone) {
                            window.location.href = `tel:${phone}`;
                          } else {
                            alert('Phone number not available for this user.');
                          }
                        }}
                        className="flex-1 py-3 bg-green-50 text-green-700 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform hover:bg-green-100 flex items-center justify-center gap-2"
                      >
                        <i className="ph-bold ph-phone"></i>
                        Call
                      </button>

                      {/* Chat Button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/messages?ownerId=${farmer.id}&ownerName=${encodeURIComponent(farmer.name)}`);
                        }}
                        className="flex-1 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform hover:bg-blue-100 flex items-center justify-center gap-2"
                      >
                        <i className="ph-bold ph-chat-circle"></i>
                        Chat
                      </button>

                      {/* Directions Button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const destination = farmer.latitude && farmer.longitude
                            ? `${farmer.latitude},${farmer.longitude}`
                            : farmer.location
                              ? encodeURIComponent(farmer.location)
                              : null;
                          if (!destination) { alert('This user has not set a location yet.'); return; }
                          const origin = userLocation
                            ? `${userLocation.latitude},${userLocation.longitude}`
                            : '';
                          const url = origin
                            ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
                            : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
                          window.open(url, '_blank');
                        }}
                        className="flex-1 py-3 bg-purple-50 text-purple-700 rounded-xl font-bold text-sm active:scale-[0.98] transition-transform hover:bg-purple-100 flex items-center justify-center gap-2"
                      >
                        <i className="ph-bold ph-directions"></i>
                        Maps
                      </button>
                    </div>
                  </div>
                ))}

                {/* 🔹 LOAD MORE BUTTON */}
                {filteredFarmers.length > visibleCount && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => setVisibleCount(prev => prev + 50)}
                      className="px-6 py-3 bg-brand-700 text-white rounded-xl font-bold text-sm hover:bg-brand-800 active:scale-95 transition"
                    >
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