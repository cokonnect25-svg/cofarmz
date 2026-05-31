'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { getApiUrl } from '@/lib/api';

const SCROLL_KEY = 'machinery_scrollY';
const FILTERS_KEY = 'machinery_filters';
const SEARCH_KEY = 'machinery_search';
const SORT_KEY = 'machinery_sort';
const VISIBLE_KEY = 'machinery_visibleCount';

export default function MachineryListPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const DEFAULT_FILTERS = {
    priceMin: 0,
    priceMax: 500000,
    distance: 5000,
    startDate: '',
    endDate: '',
    equipmentTypes: [] as string[]
  };

  // Check sessionStorage for saved state on initial load
  const getSavedFilters = () => {
    if (typeof window === 'undefined') return DEFAULT_FILTERS;
    const saved = sessionStorage.getItem(FILTERS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_FILTERS;
  };

  const getSavedSearch = () => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(SEARCH_KEY) || '';
  };

  const getSavedSort = () => {
    if (typeof window === 'undefined') return 'distance';
    return sessionStorage.getItem(SORT_KEY) || 'distance';
  };

  const [filters, setFilters] = useState(getSavedFilters);
  const [searchQuery, setSearchQuery] = useState(getSavedSearch);
  const [sortBy, setSortBy] = useState(getSavedSort);
  
  const [machineryData, setMachineryData] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [profileLocation, setProfileLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { user } = useAuth();

  const today = new Date().toISOString().split('T')[0];

  // Refs for scroll restoration
  const pendingScrollRef = useRef<number | null>(null);
  const isRestoringRef = useRef(false);

  // ✅ MOVE THIS UP
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
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Dynamic distance calculation
  const machineryWithDistances = React.useMemo(() => {
    const refLat = userLocation?.latitude ?? profileLocation?.latitude ?? null;
    const refLon = userLocation?.longitude ?? profileLocation?.longitude ?? null;
    return machineryData.map((item: any) => {
      let dist: number | null = null;
      if (refLat != null && refLon != null && item.latitude && item.longitude) {
        dist = calculateDistance(
          refLat, refLon,
          parseFloat(item.latitude), parseFloat(item.longitude)
        );
      }
      return { ...item, distance: dist };
    });
  }, [machineryData, userLocation, profileLocation]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Restore scroll position after data loads
  useEffect(() => {
    if (!mounted) return;

    const savedScroll = sessionStorage.getItem(SCROLL_KEY);
    const savedVisible = sessionStorage.getItem(VISIBLE_KEY);
    
    sessionStorage.removeItem(SCROLL_KEY);
    sessionStorage.removeItem(VISIBLE_KEY);
    sessionStorage.removeItem(FILTERS_KEY);
    sessionStorage.removeItem(SEARCH_KEY);
    sessionStorage.removeItem(SORT_KEY);

    if (savedScroll) {
      pendingScrollRef.current = parseInt(savedScroll);
    }
  }, [mounted]);

  // Apply scroll after machinery data is loaded
  useEffect(() => {
    if (machineryData.length === 0) return;
    if (pendingScrollRef.current === null) return;

    const target = pendingScrollRef.current;
    pendingScrollRef.current = null;
    isRestoringRef.current = false;

    // Multiple attempts to handle image paint time
    [50, 150, 350, 600].forEach(delay => {
      setTimeout(() => {
        window.scrollTo({ top: target, behavior: 'instant' });
      }, delay);
    });
  }, [machineryData]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchMachinery();
      fetchUserProfile();
      fetchUserFavorites();
      getUserLocation();
    }
  }, [isAuthenticated, user?.id]);

  const fetchUserProfile = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(getApiUrl(`/api/users/profile?userId=${user.id}`));
      if (response.ok) {
        const profile = await response.json();
        if (profile.latitude && profile.longitude) {
          setProfileLocation({
            latitude: parseFloat(profile.latitude),
            longitude: parseFloat(profile.longitude)
          });
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const getUserLocation = async () => {
    try {
      let position;
      let hasLocation = false;

      if (Capacitor.isNativePlatform()) {
        try {
          position = await Geolocation.getCurrentPosition();
          hasLocation = true;
        } catch (e) {
          console.warn('Native geolocation failed:', e);
        }
      } else {
        try {
          position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({
                coords: {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude
                }
              }),
              reject,
              { timeout: 5000 }
            );
          });
          hasLocation = true;
        } catch (e) {
          console.warn('Web geolocation failed:', e);
        }
      }

      if (hasLocation && position) {
        const pos = position as any;
        setUserLocation({
          latitude: pos.coords?.latitude || pos.latitude,
          longitude: pos.coords?.longitude || pos.longitude
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const fetchUserFavorites = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(getApiUrl(`/api/machinery/favorites`), {
        headers: {
          'x-user-id': user.id,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const favIds = new Set<string>(data.favorites?.map((fav: any) => fav.id) || []);
        setFavorites(favIds);
      } else {
        console.error('Favorites fetch failed with status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  // Filter and sort machinery
  const getFilteredAndSortedMachinery = () => {
    let filtered = [...machineryWithDistances];
    
    if (searchQuery.trim()) {
      filtered = filtered.filter(machine =>
        machine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (machine.model && machine.model.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    filtered = filtered.filter(machine => 
      machine.price >= filters.priceMin && machine.price <= filters.priceMax
    );
    
    filtered = filtered.filter(machine =>
      machine.distance == null || machine.distance <= filters.distance
    );
    
    if (filters.equipmentTypes.length > 0) {
      filtered = filtered.filter(machine => {
        const machineNameLower = machine.name.toLowerCase();
        const machineModelLower = (machine.model || '').toLowerCase();
        
        return filters.equipmentTypes.some(typeId => {
          const typeMap: { [key: string]: string[] } = {
            'tractors': ['tractor'],
            'harvesters': ['harvester', 'combine'],
            'implements': ['implement', 'plow', 'harrow'],
            'loaders': ['loader'],
            'excavators': ['excavator'],
            'pumps': ['pump']
          };
          
          const keywords = typeMap[typeId] || [typeId];
          return keywords.some(keyword => 
            machineNameLower.includes(keyword) || 
            machineModelLower.includes(keyword)
          );
        });
      });
    }
    
    if (sortBy === 'distance') {
      return filtered.sort((a, b) => (a.distance ?? 99999) - (b.distance ?? 99999));
    } else if (sortBy === 'price') {
      return filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'rating') {
      return filtered.sort((a, b) => b.rating - a.rating);
    }
    return filtered;
  };

  const sortedMachinery = getFilteredAndSortedMachinery();

  const equipmentOptions = [
    { id: 'tractors', label: 'Tractors' },
    { id: 'harvesters', label: 'Harvesters' },
    { id: 'implements', label: 'Implements' },
    { id: 'loaders', label: 'Loaders' },
    { id: 'excavators', label: 'Excavators' },
    { id: 'pumps', label: 'Pumps' }
  ];

  const toggleEquipmentType = (typeId: string) => {
    setFilters(prev => ({
      ...prev,
      equipmentTypes: prev.equipmentTypes.includes(typeId)
        ? prev.equipmentTypes.filter(t => t !== typeId)
        : [...prev.equipmentTypes, typeId]
    }));
  };

  const fetchMachinery = async () => {
    try {
      console.log('Starting fetchMachinery...');
      const response = await fetch(getApiUrl(`/api/machinery`));
      console.log('API response status:', response.status);
      
      if (!response.ok) {
        console.error('Machinery fetch failed with status:', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
        throw new Error(`Failed to fetch machinery: ${response.status}`)
      }
      
      const data = await response.json();
      console.log('Machinery data received:', data);
      
      if (!Array.isArray(data)) {
        console.error('Invalid machinery data format:', data);
        setMachineryData([]);
        return;
      }
      
      console.log('Formatting machinery data, count:', data.length);
      const formattedData = data.map((item: any) => {
        return {
          id: item.id,
          name: item.name || 'Unknown Equipment',
          model: item.model || 'Equipment',
          category: item.model || 'Equipment',
          price: parseFloat(item.daily_rate) || 0,
          latitude: item.effective_latitude ?? item.latitude,
          longitude: item.effective_longitude ?? item.longitude,
          availability: item.is_unavailable ? 'Not Available' : 'Available Now',
          is_unavailable: item.is_unavailable || false,
          image: (item.image_url && item.image_url.startsWith('http')) ? item.image_url : null,
          location: item.effective_location || item.location || null,
          power: item.power || null,
          fuel: item.fuel || null,
          year: item.year || null,
          description: item.description || null,
          rating: parseFloat(item.avg_rating) > 0 ? parseFloat(item.avg_rating) : null,
          review_count: item.review_count || 0
        };
      });
      console.log('Setting machinery data with', formattedData.length, 'items');
      setMachineryData(formattedData);
    } catch (error: any) {
      console.error('Error fetching machinery:', error?.message || error);
      console.error('Full error object:', error);
      setMachineryData([]);
    }
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery('');
  };

  // ✅ SAVE STATE before navigating to machinery details
  const saveStateAndNavigate = (machineId: string) => {
    sessionStorage.setItem(SCROLL_KEY, window.scrollY.toString());
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    sessionStorage.setItem(SEARCH_KEY, searchQuery);
    sessionStorage.setItem(SORT_KEY, sortBy);
    router.push(`/machinery-details?id=${machineId}&source=machinery-list`);
  };

  const handleFavorite = async (e: React.MouseEvent, machineryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.id) return;

    const wasLiked = favorites.has(machineryId);
    setFavorites(prev => {
      const next = new Set(prev);
      if (wasLiked) next.delete(machineryId);
      else next.add(machineryId);
      return next;
    });

    try {
      const response = await fetch(getApiUrl(`/api/machinery/${machineryId}/favorite`), {
        method: 'POST',
        headers: {
          'x-user-id': user.id,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        setFavorites(prev => {
          const next = new Set(prev);
          if (wasLiked) next.add(machineryId);
          else next.delete(machineryId);
          return next;
        });
      }
    } catch {
      setFavorites(prev => {
        const next = new Set(prev);
        if (wasLiked) next.add(machineryId);
        else next.delete(machineryId);
        return next;
      });
    }
  };

  // Show skeleton while auth is still loading (very brief)
  if (!mounted) return null;

    return (
      <>
        <div className="pt-4 text-gray-800 relative min-min-h-[100dvh]" suppressHydrationWarning>
          <div className="ambient-glow"></div>

    {/* Header */}
    <header className="w-full px-6 pb-6 relative z-10">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
                <button className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-gray-900 active:scale-95 transition-transform" onClick={() => router.push('/')}>
                    <i className="ph-bold ph-arrow-left text-lg"></i>
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Available Fleet</h1>
            </div>
            <button className="relative w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-brand-700 active:scale-95 transition-transform" onClick={() => setShowFilter(!showFilter)}>
                <i className="ph-bold ph-sliders-horizontal text-lg"></i>
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-accent border-2 border-white rounded-full"></span>
            </button>
        </div>
        
        {/* Search by Name */}
        <div className="relative">
            <input
              type="text"
              placeholder="Search machinery by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-5 pr-12 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/10 bg-white shadow-soft"
            />
            <i className="ph-bold ph-magnifying-glass absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none"></i>
        </div>
    </header>

    {/* Filter Modal - Top Popup */}
    {showFilter && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowFilter(false)}>
        <div className="w-full mx-4 bg-white rounded-2xl p-6 max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Filter Equipment</h2>
            <button onClick={() => setShowFilter(false)} className="text-gray-500 hover:text-gray-900">
              <i className="ph-bold ph-x text-xl"></i>
            </button>
          </div>

          {/* Price Range */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-900 mb-3">Daily Rate: ₹{filters.priceMin} – ₹{filters.priceMax.toLocaleString()}</label>
            <input
              type="range"
              min="0"
              max="500000"
              step="500"
              value={filters.priceMax}
              onChange={(e) => setFilters({...filters, priceMax: parseInt(e.target.value)})}
              className="w-full h-2 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-700"
            />
          </div>

          {/* Distance */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-900 mb-3">Distance: {filters.distance === 100 ? 'All' : `${filters.distance} km`}</label>
            <input
              type="range"
              min="0"
              max="100"
              value={filters.distance}
              onChange={(e) => setFilters({...filters, distance: parseInt(e.target.value)})}
              className="w-full h-2 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-700"
            />
          </div>

          {/* Equipment Types */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-900 mb-3">Equipment Types</label>
            <div className="grid grid-cols-2 gap-3">
              {equipmentOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => toggleEquipmentType(option.id)}
                  className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    filters.equipmentTypes.includes(option.id)
                      ? 'bg-brand-700 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
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
<input 
  type="date"
  min={today}
  value={filters.startDate}
  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-700"
/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">To Date</label>
<input 
  type="date"
  min={filters.startDate || today}
  value={filters.endDate}
  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-700"
/>
              </div>
            </div>
          </div>

          {/* Apply Filters */}
          <button 
            onClick={() => setShowFilter(false)}
            className="w-full py-3.5 bg-brand-700 text-white rounded-xl font-bold text-sm active:scale-[0.98] transition-transform"
          >
            Apply Filters
          </button>
        </div>
      </div>
    )}

    {/* Filter Chips */}
    <section className="mb-6 relative z-10 pl-6">
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pr-6 pb-2">
            <button 
              onClick={handleResetFilters}
              className={`px-5 py-2.5 rounded-[14px] text-sm font-bold whitespace-nowrap active:scale-95 transition-transform ${
                filters.equipmentTypes.length === 0
                  ? 'bg-brand-800 text-white shadow-lg shadow-brand-800/20'
                  : 'bg-white text-gray-600 shadow-soft'
              }`}>
                All Equipment
            </button>
            {equipmentOptions.map(option => (
              <button
                key={option.id}
                onClick={() => toggleEquipmentType(option.id)}
                className={`px-5 py-2.5 rounded-[14px] text-sm font-bold whitespace-nowrap active:scale-95 transition-transform ${
                  filters.equipmentTypes.includes(option.id)
                    ? 'bg-brand-800 text-white shadow-lg shadow-brand-800/20'
                    : 'bg-white text-gray-600 shadow-soft'
                }`}
              >
                {option.label}
              </button>
            ))}
        </div>
    </section>

    {/* Sort Bottom Sheet */}
    {showSortMenu && (
      <div className="fixed inset-0 z-[9999] flex flex-col justify-end" style={{backgroundColor:'rgba(0,0,0,0.45)'}} onClick={() => setShowSortMenu(false)}>
        <div className="bg-white rounded-t-3xl px-4 pb-8 pt-4" onClick={e => e.stopPropagation()}>
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5"></div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Sort By</p>
          {[
            { key: 'distance', label: 'Nearest First', sub: 'Sort by distance', icon: 'ph-map-pin' },
            { key: 'price', label: 'Lowest Price', sub: 'Sort by daily rate', icon: 'ph-currency-inr' },
            { key: 'rating', label: 'Top Rated', sub: 'Sort by rating', icon: 'ph-star' },
          ].map(opt => (
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

    {/* Quick Stats Bar */}
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

    {/* List View — 1 column */}
    <section className="px-4 relative z-10">
        {/* Skeleton cards while loading */}
        {machineryData.length === 0 && isAuthenticated && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-20">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-[24px] overflow-hidden border border-gray-100 animate-pulse">
                <div className="w-full aspect-[16/9] bg-gray-100" />
                <div className="p-3">
                  <div className="h-3 bg-gray-100 rounded-full w-1/2 mb-2" />
                  <div className="h-4 bg-gray-100 rounded-full w-3/4 mb-3" />
                  <div className="h-3 bg-gray-100 rounded-full w-1/3 mb-4" />
                  <div className="h-8 bg-gray-100 rounded-xl w-full" />
                </div>
              </div>
            ))}
          </div>
        )}
{sortedMachinery.length === 0 && machineryData.length > 0 && (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
      <i className="ph-bold ph-tractor text-4xl text-gray-400"></i>
    </div>

    <h3 className="text-lg font-bold text-gray-700 mb-1">
      No equipment found
    </h3>

    <p className="text-sm text-gray-400 mb-5">
      Try adjusting your filters or search term
    </p>

    {(searchQuery ||
      filters.equipmentTypes.length > 0 ||
      filters.priceMin !== DEFAULT_FILTERS.priceMin ||
      filters.priceMax !== DEFAULT_FILTERS.priceMax ||
      filters.distance !== DEFAULT_FILTERS.distance ||
      filters.startDate ||
      filters.endDate) && (
      <button
        onClick={handleResetFilters}
        className="px-5 py-2.5 bg-brand-700 text-white rounded-xl font-semibold text-sm active:scale-95"
      >
        Reset Filters
      </button>
    )}
  </div>
)}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-6 pb-20 mb-2">
        {sortedMachinery.map(machine => (
          <div
            key={machine.id}
            className={`group bg-white rounded-[24px] overflow-hidden shadow-sm transition-all duration-300 relative border border-gray-100 ${machine.is_unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl cursor-pointer active:scale-[0.98]'}`}
            onClick={() => { if (!machine.is_unavailable) saveStateAndNavigate(machine.id); }}
          >
            {/* Image Section — wide landscape */}
            <div className="relative w-full aspect-[16/9] overflow-hidden bg-gray-50">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-green-50/40 to-emerald-100/40">
                <div className="w-16 h-16 rounded-3xl bg-white/60 flex items-center justify-center shadow-inner backdrop-blur-xl border border-white/50">
                  <i className="ph-duotone ph-tractor text-4xl text-emerald-500/80"></i>
                </div>
              </div>
              {machine.image && (
                <img
                  src={machine.image}
                  alt={machine.name}
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105 pointer-events-none select-none"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  onContextMenu={(e) => e.preventDefault()}
                />
              )}
              {/* Transparent overlay to block browser native image actions */}
              <div className="absolute inset-0 z-[5]" />
              {/* Overlays */}
              <div className="absolute top-3 left-3 flex flex-row gap-2 z-10">
                <div className="bg-emerald-600/85 backdrop-blur-lg px-2.5 py-1.5 rounded-2xl flex items-center gap-1.5 shadow-md border border-emerald-400/30">
                  <i className="ph-fill ph-map-pin text-white text-xs"></i>
                  <span className="text-[12px] font-black text-white">
                    {machine.distance != null ? `${machine.distance.toFixed(1)} km` : (machine.location || 'Nearby')}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleFavorite(e, machine.id); }}
                className={`absolute top-3 right-3 w-10 h-10 rounded-full z-20 flex items-center justify-center transition-all duration-300 shadow-xl active:scale-90 backdrop-blur-xl border ${
                  favorites.has(machine.id) ? 'bg-red-500/90 border-red-400/50' : 'bg-white/50 border-white/60'
                }`}
              >
                {favorites.has(machine.id)
                  ? <i className="ph-fill ph-heart text-white text-lg"></i>
                  : <i className="ph ph-heart text-gray-700/80 text-lg"></i>}
              </button>
            </div>

            {/* Info Section */}
            <div className="p-3 md:p-5 flex flex-col justify-between flex-1">
              <div className="flex flex-col items-start justify-between mb-2">
                <div className="w-full">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[8px] md:text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                      {machine.category || 'Equipment'}
                    </span>
                    {machine.availability === 'Available Now' ? (
                      <span className="w-2 h-2X rounded-full bg-emerald-500 animate-pulse"></span>
                    ) : (
                      <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Not Available</span>
                    )}
                    {machine.rating ? (
                      <div className="flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded-md ml-auto">
                        <i className="ph-fill ph-star text-amber-500 text-[10px]"></i>
                        <span className="text-[10px] font-black text-amber-700">{machine.rating}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md ml-auto">New</span>
                    )}
                  </div>
                  <h3 className="font-black text-gray-900 text-sm md:text-xl leading-tight group-hover:text-emerald-700 transition-colors mt-0.5 truncate w-full">
                    {machine.name}
                  </h3>
                  
                  {/* Technical Specs Bar */}
                  <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1.5">
                    {machine.power && (
                      <div className="flex items-center gap-1">
                        <i className="ph ph-engine text-gray-400 text-xs"></i>
                        <span className="text-[11px] font-bold text-gray-500">{machine.power}</span>
                      </div>
                    )}
                    {machine.fuel && (
                      <div className="flex items-center gap-1">
                        <i className="ph ph-gas-pump text-gray-400 text-xs"></i>
                        <span className="text-[11px] font-bold text-gray-500">{machine.fuel}</span>
                      </div>
                    )}
                    {machine.year && (
                      <div className="flex items-center gap-1">
                        <i className="ph ph-calendar text-gray-400 text-xs"></i>
                        <span className="text-[11px] font-bold text-gray-500">{machine.year}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-left mt-3">
                  <span className="text-gray-400 text-[9px] md:text-[10px] font-bold uppercase tracking-tight block">Daily rate</span>
                  <span className="text-emerald-700 font-black text-lg md:text-2xl">₹{machine.price}</span>
                  <span className="text-gray-400 text-[10px] md:text-sm font-bold">/day</span>
                </div>
              </div>
              <button
                disabled={!!machine.is_unavailable}
                className={`w-full h-[36px] md:h-[50px] rounded-[12px] md:rounded-[18px] font-black text-[11px] md:text-[14px] transition-all flex items-center justify-center gap-1.5 mt-2 ${machine.is_unavailable ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md active:scale-95'}`}>
                {machine.is_unavailable ? 'Not Available' : 'Rent This Equipment'}
                {!machine.is_unavailable && <i className="ph-bold ph-arrow-right text-sm"></i>}
              </button>
            </div>
          </div>
        ))}
        </div>
    </section>

    {/* FLOATING BOTTOM NAVIGATION BAR */}
        </div>

      </>
    );
}