'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Capacitor } from '@capacitor/core';
import { getApiUrl } from '@/lib/api';

interface Machinery {
  id: string;
  name: string;
  model: string;
  daily_rate: number;
  image_url: string;
  location: string;
  year: number;
  is_unavailable: boolean;
}

interface Farmer {
  id: string;
  name: string;
  image: string | null;
  location: string | null;
  crops: { crop_name: string; is_crop_waste: boolean }[];
  distance: number;
  role: string;
}

interface CropEntry {
  crop_name: string;
  crop_type: string;
  is_crop_waste: boolean;
}

interface UserProfile {
  id: string;
  name: string;
  role: string;
  crops: CropEntry[];
  location: string;
}

const CATEGORIES = [
  { label: 'All', icon: 'ph-squares-four' },
  { label: 'Tractors', icon: 'ph-tractor' },
  { label: 'Harvesters', icon: 'ph-plant' },
  { label: 'Implements', icon: 'ph-wrench' },
  { label: 'Sprayers', icon: 'ph-drop' },
  { label: 'Loaders', icon: 'ph-truck' },
];


function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { user, isAuthenticated, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [machinery, setMachinery] = useState<Machinery[]>([]);
  const [loadingMachinery, setLoadingMachinery] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // New matching states
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [matchingResults, setMatchingResults] = useState<Farmer[]>([]);
  const [wasteBuyerResults, setWasteBuyerResults] = useState<Farmer[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [farmers, setFarmers] = useState<Farmer[]>([]);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [supplierResults, setSupplierResults] = useState<Farmer[]>([]);

  
 

  useEffect(() => { setMounted(true); }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);



  // Check if role is confirmed
  useEffect(() => {
    if (!user?.id) return;
    
    const checkRole = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/users/profile?userId=${user.id}`));
        if (res.ok) {
          const profile = await res.json();
          if (profile.role_confirmed !== true) {
            setShowRoleModal(true);
          }
        }
      } catch (err) {
        console.error("Error checking role:", err);
      }
    };
    checkRole();
  }, [user?.id]);

  const handleSelectRole = async (role: 'farmer' | 'buyer' | 'supplier') => {
    setRoleUpdating(true);
    try {
      const res = await fetch(getApiUrl('/api/users/profile'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, email: user?.email, role }),
      });
      if (res.ok) {
        setShowRoleModal(false);
        window.location.reload(); 
      }
    } catch (err) {
      console.error("Error setting role:", err);
    } finally {
      setRoleUpdating(false);
    }
  };


  useEffect(() => {
    const uid = user?.id;
    if (uid) {
      // 1. Fetch User Profile & Crops
      fetch(getApiUrl(`/api/farmers/profile?userId=${uid}`))
        .then(r => r.ok ? r.json() : null)
        .then(profile => {
          if (profile) {
            setUserProfile(profile);

            // 2. Fetch Relevant Crops
            const userCrops = profile.crops?.map((c: any) => c.crop_name) || [];

            if (userCrops.length > 0) {
              setLoadingMatches(true);
              const uniqueCrops = [...new Set(userCrops)];

              // Get real user location, fallback to 0,0 (shows all users sorted by distance=9999)
              const fetchMatches = (lat: number, lon: number) => {
                Promise.all([
                  fetch(getApiUrl(`/api/nearby-farmers?type=farmers&latitude=${lat}&longitude=${lon}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
                  fetch(getApiUrl(`/api/nearby-farmers?type=buyers&latitude=${lat}&longitude=${lon}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
                  fetch(getApiUrl(`/api/nearby-farmers?type=buyers&wasteOnly=true&latitude=${lat}&longitude=${lon}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
                    fetch(getApiUrl(`/api/nearby-farmers?type=suppliers&latitude=${lat}&longitude=${lon}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
                ]).then(([farmersData, buyersData, wasteBuyersData, suppliersData]) => {
                  const normalize = (arr: any[]) => arr.map((f: any) => ({
                    ...f,
                    crops: Array.isArray(f.crops)
                      ? f.crops.map((c: any) => ({ crop_name: c.crop_name || c, is_crop_waste: !!c.is_crop_waste }))
                      : [],
                    distance: parseFloat(f.distance) || 9999,
                  }));
                  setMatchingResults([
                    ...normalize(Array.isArray(farmersData) ? farmersData : []),
                    ...normalize(Array.isArray(buyersData) ? buyersData : []),
                  ]);
                  setWasteBuyerResults(normalize(Array.isArray(wasteBuyersData) ? wasteBuyersData : []));
                  setSupplierResults(normalize(Array.isArray(suppliersData) ? suppliersData : []));
                }).catch(() => {}).finally(() => setLoadingMatches(false));
              };

              // Try to get user's GPS location (native + web)
          const getLocation = async () => {
            try {
              let lat: number, lon: number;

              

              if (Capacitor.isNativePlatform()) {
                const { Geolocation } = await import('@capacitor/geolocation');

                // 🔥 request permission explicitly
                const permission = await Geolocation.requestPermissions();

                if (permission.location !== 'granted') {
                  throw new Error('Location permission denied');
                }

                const pos = await Geolocation.getCurrentPosition({
                  enableHighAccuracy: true,
                });

                lat = pos.coords.latitude;
                lon = pos.coords.longitude;

                console.log('User Location:', lat, lon);

              } else {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                  navigator.geolocation.getCurrentPosition(resolve, reject)
                );

                lat = pos.coords.latitude;
                lon = pos.coords.longitude;
              }

              console.log('User Location:', lat, lon);
              fetchMatches(lat, lon);

            } catch (err) {
              console.error('Location Error:', err);

              // fallback
              fetchMatches(0, 0);
            }
          };
              getLocation();
            }
          }
        });

      // Existing Machinery & Favorites fetches
      fetch(getApiUrl(`/api/machinery/featured`))
        .then(r => r.ok ? r.json() : [])
        .then(data => setMachinery(Array.isArray(data) ? data : []))
        .catch(() => setMachinery([]))
        .finally(() => setLoadingMachinery(false));

      fetch(getApiUrl(`/api/machinery/favorites`), { headers: { 'x-user-id': uid } })
        .then(r => r.ok ? r.json() : { favorites: [] })
        .then(data => {
          const ids = (data.favorites || []).map((f: any) => f.id || f.machinery_id);
          setFavorites(new Set(ids));
        })
        .catch(() => { });
    }
  }, [isAuthenticated, user?.id]);

  // Re-fetch matches when location popup grants permission
  useEffect(() => {
    const handler = (e: any) => {
      const { latitude, longitude } = e.detail;
      const uid = user?.id;
      if (!uid || !userProfile) return;
      const userCrops = userProfile.crops?.map((c: any) => c.crop_name) || [];
      if (userCrops.length === 0) return;
      const uniqueCrops = [...new Set(userCrops)];
      setLoadingMatches(true);
      Promise.all([
        fetch(getApiUrl(`/api/nearby-farmers?type=farmers&latitude=${latitude}&longitude=${longitude}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
        fetch(getApiUrl(`/api/nearby-farmers?type=buyers&latitude=${latitude}&longitude=${longitude}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
        fetch(getApiUrl(`/api/nearby-farmers?type=buyers&wasteOnly=true&latitude=${latitude}&longitude=${longitude}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
          fetch(getApiUrl(`/api/nearby-farmers?type=suppliers&latitude=${latitude}&longitude=${longitude}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
      ]).then(([farmersData, buyersData, wasteBuyersData, suppliersData]) => {
        const normalize = (arr: any[]) => arr.map((f: any) => ({
          ...f,
          crops: Array.isArray(f.crops)
            ? f.crops.map((c: any) => ({ crop_name: c.crop_name || c, is_crop_waste: !!c.is_crop_waste }))
            : [],
          distance: parseFloat(f.distance) || 9999,
        }));
        setMatchingResults([
          ...normalize(Array.isArray(farmersData) ? farmersData : []),
          ...normalize(Array.isArray(buyersData) ? buyersData : []),
        ]);
        setWasteBuyerResults(normalize(Array.isArray(wasteBuyersData) ? wasteBuyersData : []));
        setSupplierResults(normalize(Array.isArray(suppliersData) ? suppliersData : []));
      }).catch(() => {}).finally(() => setLoadingMatches(false));
    };
    window.addEventListener('userLocationUpdated', handler);
    return () => window.removeEventListener('userLocationUpdated', handler);
  }, [user?.id, userProfile]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/machinery-list?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const toggleFavorite = async (id: string) => {
    const uid = user?.id;
    if (!uid) return;
    // Optimistic update
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    // Save to DB
    try {
      await fetch(getApiUrl(`/api/machinery/${id}/favorite`), {
        method: 'POST',
        headers: { 'x-user-id': user.id },
      });
    } catch {
      // Revert on error
      setFavorites(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }
  };

  const effectiveUser = user;

  // Show splash/loading while checking auth
  if (!mounted || loading) {
    return (
      <div className="w-full min-h-[100dvh] bg-gradient-to-br from-green-800 to-emerald-600 flex flex-col items-center justify-center gap-4">
        <div className="w-20 h-20 bg-white rounded-3xl p-2 shadow-2xl mb-2">
          <img src="/assets/cofarmz-logo.png" alt="CoFarmz" className="w-full h-full rounded-2xl object-cover" />
        </div>
        <span className="text-white font-black text-2xl tracking-tight">CoFarmz</span>
        <div className="w-8 h-8 rounded-full border-4 border-white border-t-transparent animate-spin mt-4"></div>
      </div>
    );
  }

  // If not authenticated, show nothing (redirect is happening)
  if (!isAuthenticated) return null;

  const filteredMachinery = selectedCategory === 'All'
    ? machinery
    : machinery.filter(m => m.name.toLowerCase().includes(selectedCategory.toLowerCase()));

  return (
    <div className="min-min-h-[100dvh] bg-surface-muted">


      {/* ── HERO SECTION ── */}
     <section className="bg-hero-green px-6 pt-6 pb-8 rounded-b-[40px] shadow-xl">
  {/* Greeting */}
  <div className="flex items-center gap-2 text-green-100 mb-4">
    <i className="ph-fill ph-map-pin text-[12px] text-green-300"></i>
    <span className="text-sm font-bold">
      Welcome back, {effectiveUser?.name?.split(' ')[0] || 'Farmer'} 👋
    </span>
  </div>

</section>


      {/* ── MAIN CONTENT ── */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* ── DYNAMIC MATCHING SECTIONS ── */}
        <section className="mb-12">
          {loadingMatches ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin"></div>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Matching results...</p>
              </div>
            </div>
          ) : (
            <>
              {(() => {
                const userCropNames = userProfile?.crops?.map(c => c.crop_name.toLowerCase()) || [];
                const userWasteCropNames = userProfile?.crops?.filter(c => c.is_crop_waste).map(c => c.crop_name.toLowerCase()) || [];

                const userCropSet = new Set(userCropNames);
                const userWasteCropSet = new Set(userWasteCropNames);

                // 1. Buyers interested in your AGRICULTURAL WASTE (uses dedicated wasteOnly fetch)
                const matchedWasteBuyers = wasteBuyerResults
                  .map(r => {
                    const matchingWasteCrops = r.crops
                      .filter((c: any) => c.is_crop_waste && userCropSet.has(c.crop_name.toLowerCase()))
                      .map((c: any) => c.crop_name);
                    // Fallback: show buyer with all their waste crops if no specific match
                    const fallbackCrops = r.crops
                      .filter((c: any) => c.is_crop_waste)
                      .map((c: any) => c.crop_name);
                    const displayCrops = matchingWasteCrops.length > 0 ? matchingWasteCrops : fallbackCrops;
                    return displayCrops.length > 0 ? { ...r, matchingCrops: displayCrops } : null;
                  })
                  .filter(Boolean);

                // 2. ALL nearby buyers — show matching crops as tags, fallback to their own crops
                const matchedBuyers = matchingResults
                  .filter(r => r.role === 'buyer')
                  .map(r => {
                    const matchingCrops = r.crops
                      .filter((c: any) => !c.is_crop_waste && userCropSet.has(c.crop_name.toLowerCase()))
                      .map((c: any) => c.crop_name);
                    const fallbackCrops = r.crops.filter((c: any) => !c.is_crop_waste).slice(0, 3).map((c: any) => c.crop_name);
                    return { ...r, matchingCrops: matchingCrops.length > 0 ? matchingCrops : fallbackCrops, isExactMatch: matchingCrops.length > 0 };
                  })
                  .sort((a: any, b: any) => (b.isExactMatch ? 1 : 0) - (a.isExactMatch ? 1 : 0) || a.distance - b.distance);

                // 3. ALL nearby farmers — show matching crops as tags, fallback to their own crops
                const matchedFarmers = matchingResults
                  .filter(r => r.role === 'farmer')
                  .map(r => {
                    const matchingCrops = r.crops
                      .filter((c: any) => userCropSet.has(c.crop_name.toLowerCase()))
                      .map((c: any) => c.crop_name);
                    const fallbackCrops = r.crops.slice(0, 3).map((c: any) => c.crop_name);
                    return { ...r, matchingCrops: matchingCrops.length > 0 ? matchingCrops : fallbackCrops, isExactMatch: matchingCrops.length > 0 };
                  })
                  .sort((a: any, b: any) => (b.isExactMatch ? 1 : 0) - (a.isExactMatch ? 1 : 0) || a.distance - b.distance);

                const renderCard = (person: any, color: string) => (
                  <div key={person.id}
                    onClick={() => router.push(`/farmer-profile?id=${person.id}`)}
                    className="flex-shrink-0 w-44 bg-white rounded-[32px] p-5 shadow-premium border border-gray-50 cursor-pointer hover:shadow-float hover:-translate-y-1 transition-all text-center group">
                    <div className="relative mb-4 mx-auto w-20 h-20">
                      <img
                        src={person.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(person.name)}`}
                        alt={person.name}
                        className="w-full h-full rounded-full object-cover border-2 border-white shadow-sm"
                      />
                    </div>
                    <p className="text-base font-black text-gray-900 truncate mb-0.5">{person.name}</p>
                    <p className="text-[10px] text-gray-400 flex items-center justify-center gap-1 mb-3 font-bold">
                      <i className="ph-fill ph-map-pin text-brand-500 text-[10px]"></i>
                      {person.location
                        ? `${person.location} · ${Math.round(person.distance)} km away`
                        : `${Math.round(person.distance)} km away`}
                    </p>
                    {person.isExactMatch && (
                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-1">Crop Match</p>
                    )}
                    <div className="flex flex-wrap gap-1 justify-center">
                      {(person.matchingCrops || []).length > 0
                        ? person.matchingCrops.map((crop: string) => (
                            <span key={crop} className={`text-[10px] font-bold px-2 py-1 rounded-lg ${color}`}>
                              {crop}
                            </span>
                          ))
                        : <span className="text-[10px] text-gray-300 font-bold">No crops listed</span>
                      }
                    </div>
                  </div>
                );

                const renderEmpty = (msg: string) => (
                  <div className="w-full py-10 text-center bg-gray-50/50 rounded-[32px] border-2 border-dashed border-gray-100 flex flex-col items-center">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-3 shadow-sm text-gray-300">
                      <i className="ph-bold ph-plant text-2xl"></i>
                    </div>
                    <p className="text-gray-400 text-xs font-bold">{msg}</p>
                    <p className="text-[10px] text-gray-300 mt-1">We'll notify you when a match is found.</p>
                  </div>
                );

                return (
                  <div>
                    {/* Complete profile prompt when no crops */}
                    {userCropNames.length === 0 && (
                      <div className="bg-gradient-to-br from-brand-50 to-emerald-50 rounded-3xl p-8 text-center border border-brand-100 mb-6 shadow-premium relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                          <i className="ph-fill ph-plant text-3xl text-brand-500"></i>
                        </div>
                        <p className="text-gray-900 font-black text-lg mb-1">Complete your profile</p>
                        <p className="text-gray-500 text-xs mb-6">Add crops you produce to find buyers nearby!</p>
                        <button onClick={() => router.push('/user-profile?addCrop=true')}
                          className="bg-brand-600 text-white px-8 py-3.5 rounded-2xl text-sm font-black shadow-lg shadow-brand-600/30 active:scale-95 transition-transform">
                          Add Your Crops
                        </button>
                      </div>
                    )}

                    {/* Potential Buyers for your AGRICULTURAL WASTE */}
                    {userProfile?.role === 'farmer' && (
                      <div className="mb-12">
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Buyers Interest For Your Crops Wastage</h2>
                            <p className="text-amber-600 text-xs font-bold uppercase tracking-wider">Interested in your agricultural waste</p>
                          </div>
                          <button onClick={() => router.push('/nearby-farmers?type=buyers')}
                            className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 hover:bg-amber-600 hover:text-white transition-all shadow-sm">
                            <i className="ph-bold ph-arrow-right"></i>
                          </button>
                        </div>
                        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 pt-1 px-1 -mx-1">
                          {matchedWasteBuyers.length > 0
                            ? matchedWasteBuyers.slice(0, 10).map((p: any) => renderCard(p, 'bg-amber-100 text-amber-700'))
                            : renderEmpty('No buyers found for your waste crops yet')}
                        </div>
                      </div>
                    )}

                    {/* Buyers matching your regular crops */}
                    <div className="mb-10">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Buyers Matching Your Crops</h2>
                          <p className="text-blue-600 text-xs font-bold uppercase tracking-wider">
                            {matchedBuyers.some((b: any) => b.isExactMatch) ? 'Buyers interested in your crops' : 'Nearby buyers'}
                          </p>
                        </div>
                        <button onClick={() => router.push('/nearby-farmers?type=buyers')}
                          className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                          <i className="ph-bold ph-arrow-right"></i>
                        </button>
                      </div>
                      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 pt-1 px-1 -mx-1">
                        {matchedBuyers.length > 0
                          ? matchedBuyers.slice(0, 10).map((p: any) => renderCard(p, 'bg-blue-50 text-blue-700'))
                          : renderEmpty('No buyers registered yet in your area')}
                      </div>
                    </div>

                    {/* Nearby Farmers */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Nearby Farmers Interested In Your Crops</h2>
                          <p className="text-emerald-600 text-xs font-bold uppercase tracking-wider">
                            {matchedFarmers.some((f: any) => f.isExactMatch) ? 'Farmers growing your crops' : 'Nearby farmers'}
                          </p>
                        </div>
                        <button onClick={() => router.push('/nearby-farmers?type=farmers')}
                          className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                          <i className="ph-bold ph-arrow-right"></i>
                        </button>
                      </div>
                      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 pt-1 px-1 -mx-1">
                        {matchedFarmers.length > 0
                          ? matchedFarmers.slice(0, 10).map((p: any) => renderCard(p, 'bg-emerald-50 text-emerald-700'))
                          : renderEmpty('No farmers registered yet in your area')}
                      </div>
                    </div>
                    <div className="mb-4">
  <div className="flex items-center justify-between mb-5">
    <div>
      <h2 className="text-2xl font-black text-gray-900 tracking-tight">
        Nearby Equipment Suppliers
      </h2>
      <p className="text-purple-600 text-xs font-bold uppercase tracking-wider">
        Machinery providers near you
      </p>
    </div>

    <button
      onClick={() => router.push('/nearby-farmers?type=suppliers')}
      className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 hover:bg-purple-600 hover:text-white transition-all shadow-sm"
    >
      <i className="ph-bold ph-arrow-right"></i>
    </button>
  </div>

  <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 pt-1 px-1 -mx-1">
    {supplierResults.length > 0
      ? supplierResults.slice(0, 10).map((p: any) =>
          renderCard(p, 'bg-purple-50 text-purple-700')
        )
      : renderEmpty('No suppliers available nearby')}
  </div>
</div>
                  </div>
                );
              })()}
            </>
          )}
        </section>

        {/* ── WHAT WOULD YOU LIKE TO DO (Dynamic Action Grid) ── */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Shortcuts & Tools</h2>
          </div>
          <div className="grid grid-cols-2 gap-5">
            {/* Equipment Rentals */}
            <div onClick={() => router.push('/machinery-list')}
              className="bg-white/80 backdrop-blur-xl rounded-[36px] p-6 cursor-pointer hover:bg-brand-50 transition-all group border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 active:scale-95">
              <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-brand-700 rounded-[22px] flex items-center justify-center mb-5 shadow-lg shadow-brand-500/30 group-hover:scale-110 transition-transform">
                <i className="ph-fill ph-tractor text-white text-3xl"></i>
              </div>
              <h3 className="text-gray-900 font-extrabold text-xl leading-tight mb-1">Fleet & Hire</h3>
              <p className="text-gray-400 text-[10px] leading-relaxed mb-4 uppercase font-bold tracking-wider">Professional Equipment</p>
              <div className="flex items-center gap-1 text-brand-600 font-black text-xs opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                Explore <i className="ph-bold ph-arrow-right"></i>
              </div>
            </div>

            {/* Nearby Farmers */}
            <div onClick={() => router.push('/nearby-farmers?type=farmers')}
              className="bg-white/80 backdrop-blur-xl rounded-[36px] p-6 cursor-pointer hover:bg-blue-50 transition-all group border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 active:scale-95">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-[22px] flex items-center justify-center mb-5 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                <i className="ph-fill ph-users-three text-white text-3xl"></i>
              </div>
              <h3 className="text-gray-900 font-extrabold text-xl leading-tight mb-1">Farmer Hub</h3>
              <p className="text-gray-400 text-[10px] leading-relaxed mb-4 uppercase font-bold tracking-wider">Collaborate Nearby</p>
              <div className="flex items-center gap-1 text-blue-600 font-black text-xs opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                Discover <i className="ph-bold ph-arrow-right"></i>
              </div>
            </div>

            {/* Nearby Buyers */}
            <div onClick={() => router.push('/nearby-farmers?type=buyers')}
              className="bg-white/80 backdrop-blur-xl rounded-[36px] p-6 cursor-pointer hover:bg-amber-50 transition-all group border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 active:scale-95">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-600 rounded-[22px] flex items-center justify-center mb-5 shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                <i className="ph-fill ph-handshake text-white text-3xl"></i>
              </div>
              <h3 className="text-gray-900 font-extrabold text-xl leading-tight mb-1">Crop Market</h3>
              <p className="text-gray-400 text-[10px] leading-relaxed mb-4 uppercase font-bold tracking-wider">Find Active Buyers</p>
              <div className="flex items-center gap-1 text-amber-600 font-black text-xs opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                Sell Now <i className="ph-bold ph-arrow-right"></i>
              </div>
            </div>

            {/* Reels & Videos */}
            <div onClick={() => router.push('/reels')}
              className="bg-white/80 backdrop-blur-xl rounded-[36px] p-6 cursor-pointer hover:bg-purple-50 transition-all group border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 active:scale-95">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-700 rounded-[22px] flex items-center justify-center mb-5 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                <i className="ph-fill ph-video text-white text-3xl"></i>
              </div>
              <h3 className="text-gray-900 font-extrabold text-xl leading-tight mb-1">Farm Reels</h3>
              <p className="text-gray-400 text-[10px] leading-relaxed mb-4 uppercase font-bold tracking-wider">Showcase Your Work</p>
              <div className="flex items-center gap-1 text-purple-600 font-black text-xs opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                Watch <i className="ph-bold ph-arrow-right"></i>
              </div>
            </div>
          </div>
        </section>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto hide-scrollbar pb-2">
          {CATEGORIES.map(cat => (
            <button key={cat.label}
              onClick={() => setSelectedCategory(cat.label)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all border ${selectedCategory === cat.label
                ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-600/20'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600'
                }`}>
              <i className={`ph-fill ${cat.icon} text-base`}></i>
              {cat.label}
            </button>
          ))}
          <button
            onClick={() => router.push('/machinery-list')}
            className="ml-auto flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:text-brand-700 whitespace-nowrap">
            View all <i className="ph-bold ph-arrow-right"></i>
          </button>
        </div>

        {/* Equipment Grid */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-gray-900">Top Picks Near You</h2>
              <p className="text-gray-500 text-sm mt-1">Top-rated machinery available near you</p>
            </div>
          </div>

          {loadingMachinery ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-52 bg-gray-200"></div>
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredMachinery.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-dashed border-gray-200">
              <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ph-bold ph-tractor text-3xl text-brand-400"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No Equipment Found</h3>
              <p className="text-gray-500 text-sm mb-6">Be the first to list your equipment!</p>
              <button onClick={() => router.push('/rent-machinery')}
                className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-brand-700 transition-colors">
                + List Your Equipment
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMachinery.map(item => (
                <div key={item.id}
                  className={`bg-white rounded-2xl overflow-hidden shadow-soft transition-all duration-300 group border border-gray-100 ${item.is_unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-float cursor-pointer'}`}
                  onClick={() => { if (!item.is_unavailable) router.push(`/machinery-details?id=${item.id}`); }}>
                  {/* Image */}
                  <div className="relative h-52 overflow-hidden bg-gradient-to-br from-green-50 to-emerald-100">
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <div className="w-14 h-14 rounded-full bg-white/70 flex items-center justify-center shadow-sm">
                        <i className="ph-bold ph-tractor text-3xl text-green-400"></i>
                      </div>
                      <span className="text-xs text-green-600 font-semibold">No Image</span>
                    </div>
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none select-none"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        onContextMenu={(e) => e.preventDefault()}
                      />
                    )}

                    <button
                      onClick={e => { e.stopPropagation(); toggleFavorite(item.id); }}
                      className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform">
                      <i className={`${favorites.has(item.id) ? 'ph-fill text-red-500' : 'ph text-gray-400'} ph-heart text-lg`}></i>
                    </button>
                    <div className="absolute bottom-3 left-3 bg-brand-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md">
                      {item.year}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-gray-900 text-base leading-tight">{item.name}</h3>
                      {item.is_unavailable ? (
                        <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">Not Available</span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0 ml-2"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-3">{item.model}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
                      <i className="ph ph-map-pin text-brand-500"></i>
                      <span>{item.location}</span>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div>
                        <span className="text-2xl font-black text-gray-900">₹{Number(item.daily_rate).toLocaleString()}</span>
                        <span className="text-xs text-gray-400 font-medium"> / day</span>
                      </div>
                      <button
                        disabled={!!item.is_unavailable}
                        onClick={e => { e.stopPropagation(); if (!item.is_unavailable) router.push(`/machinery-details?id=${item.id}`); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${item.is_unavailable ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-600/20'}`}>
                        {item.is_unavailable ? 'Unavailable' : 'Rent Now'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── CTA BANNER ── */}
        <section className="bg-gradient-to-r from-brand-800 to-brand-600 rounded-3xl p-8 md:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-6 mb-12 overflow-hidden relative">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative">
            <span className="bg-accent text-white text-xs font-black uppercase px-3 py-1 rounded-full mb-3 inline-block">Season Deal</span>
            <h3 className="text-2xl md:text-3xl font-black mb-2">Spring Seeding Setup</h3>
            <p className="text-brand-100 text-sm">Get 15% off full tractor + seeder packages this season.</p>
          </div>
          <button
            onClick={() => router.push('/machinery-list')}
            className="relative bg-white text-brand-800 px-8 py-4 rounded-2xl font-black text-sm hover:bg-brand-50 transition-colors shadow-lg whitespace-nowrap flex items-center gap-2">
            Browse Deals <i className="ph-bold ph-arrow-right"></i>
          </button>
        </section>


      </div>

      {/* Role Selection Modal Overlay */}
      {showRoleModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-brand-50 rounded-3xl flex items-center justify-center mb-6">
                <i className="ph-fill ph-layout text-4xl text-brand-600"></i>
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Welcome to CoFarmz</h2>
              <p className="text-gray-500 mb-6 leading-relaxed text-sm">To personalize your experience, please tell us how you'll be using the platform.</p>
              
              {/* Terms & Conditions Summary */}
              <div className="w-full bg-gray-50 rounded-2xl p-4 mb-6 text-left border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Terms of Service</p>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="text-sm">🌾</span>
                    <p className="text-[11px] text-gray-600 leading-tight">By continuing, you agree to our <strong>Terms</strong> and <strong>Privacy Policy</strong></p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-sm">🔒</span>
                    <p className="text-[11px] text-gray-600 leading-tight">Your data is secure and used only for platform services</p>
                  </div>
                </div>

                <label className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200/60 cursor-pointer group">
                  <div 
                    onClick={() => setAgreedToTerms(!agreedToTerms)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${agreedToTerms ? 'bg-brand-600 border-brand-600' : 'border-gray-300 bg-white group-hover:border-brand-400'}`}
                  >
                    {agreedToTerms && <i className="ph-bold ph-check text-white text-[10px]"></i>}
                  </div>
                  <span className="text-[11px] font-bold text-gray-700">I agree to the Terms & Conditions</span>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 w-full">
                <button
                  onClick={() => agreedToTerms && handleSelectRole('farmer')}
                  disabled={roleUpdating || !agreedToTerms}
                  className={`group relative flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${agreedToTerms ? 'border-gray-100 hover:border-brand-600 hover:bg-brand-50 cursor-pointer' : 'border-gray-100 opacity-50 cursor-not-allowed'}`}
                >
                  <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-white transition-colors">
                    <i className="ph-fill ph-tractor text-2xl text-gray-600 group-hover:text-brand-600"></i>
                  </div>
                  <div>
                    <span className="block font-bold text-gray-900">I am a Farmer</span>
                    <span className="text-xs text-gray-400">I want to rent machinery & equipment</span>
                  </div>
                  {roleUpdating && <div className="absolute right-6 animate-spin w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full" />}
                </button>

                <button
                  onClick={() => agreedToTerms && handleSelectRole('buyer')}
                  disabled={roleUpdating || !agreedToTerms}
                  className={`group relative flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${agreedToTerms ? 'border-gray-100 hover:border-brand-600 hover:bg-brand-50 cursor-pointer' : 'border-gray-100 opacity-50 cursor-not-allowed'}`}
                >
                  <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-white transition-colors">
                    <i className="ph-fill ph-users text-2xl text-gray-600 group-hover:text-brand-600"></i>
                  </div>
                  <div>
                    <span className="block font-bold text-gray-900">I am a Buyer</span>
                    <span className="text-xs text-gray-400">I want to buy fresh produce</span>
                  </div>
                  {roleUpdating && <div className="absolute right-6 animate-spin w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full" />}
                </button>

                <button
                onClick={() => agreedToTerms && handleSelectRole('supplier')}
                disabled={roleUpdating || !agreedToTerms}
                className={`group relative flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                  agreedToTerms
                    ? 'border-gray-100 hover:border-brand-600 hover:bg-brand-50 cursor-pointer'
                    : 'border-gray-100 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-white transition-colors">
                  <i className="ph-fill ph-wrench text-2xl text-gray-600 group-hover:text-brand-600"></i>
                </div>
                <div>
                  <span className="block font-bold text-gray-900">I am a Supplier</span>
                  <span className="text-xs text-gray-400">I want to list and manage equipment</span>
                </div>
                {roleUpdating && (
                  <div className="absolute right-6 animate-spin w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full" />
                )}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="w-full min-h-[100dvh] flex items-center justify-center bg-surface-muted">
        <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
