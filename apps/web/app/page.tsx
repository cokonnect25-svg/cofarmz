'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Capacitor } from '@capacitor/core';
import { getApiUrl } from '@/lib/api';
import UserAvatar from '@/app/components/UserAvatar';
import PostCard, { SocialPost } from '@/app/components/PostCard';

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
  const [profilePosts, setProfilePosts] = useState<SocialPost[]>([]);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [supplierResults, setsupplierResults] = useState<Farmer[]>([]);
  const [commoditySupplierResults, setCommoditySupplierResults] = useState<Farmer[]>([]);
  const [equipmentSupplierResults, setEquipmentSupplierResults] = useState<Farmer[]>([]);
  const [spoResults, setSpoResults] = useState<Farmer[]>([]);
const [expandedId, setExpandedId] = useState<string | null>(null);
  
 

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetch(getApiUrl(`/api/posts?viewerId=${encodeURIComponent(user.id)}`))
      .then(response => response.ok ? response.json() : [])
      .then(data => setProfilePosts(Array.isArray(data) ? data : []))
      .catch(() => setProfilePosts([]));
  }, [user?.id]);

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

        // ✅ Superadmin bypasses terms/role modal → go straight to admin dashboard
        if (profile.role === 'superadmin' || profile.role_id === 5) {
          router.replace('/admin/dashboard');
          return;
        }

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

const handleSelectRole = async (role: 'farmer' | 'buyer' | 'supplier' | 'fpo') => {
    setRoleUpdating(true);
    try {
      const res = await fetch(getApiUrl('/api/users/profile'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          email: user?.email,
          role,
          supplier_types: role === 'supplier' ? ['commodities', 'equipment'] : [],
        }),
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

           if (userCrops.length > 0 || profile.role === 'supplier' || profile.role === 'fpo') {
setLoadingMatches(true);

const fetchMatches = (lat: number, lon: number) => {
  Promise.all([
    fetch(getApiUrl(`/api/nearby-farmers?type=farmers&latitude=${lat}&longitude=${lon}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),

    fetch(getApiUrl(`/api/nearby-farmers?type=buyers&latitude=${lat}&longitude=${lon}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),

    fetch(getApiUrl(`/api/nearby-farmers?type=buyers&wasteOnly=true&latitude=${lat}&longitude=${lon}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),

    fetch(getApiUrl(`/api/nearby-farmers?type=supplier&supplierType=commodities&latitude=${lat}&longitude=${lon}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),

    fetch(getApiUrl(`/api/nearby-farmers?type=supplier&supplierType=equipment&latitude=${lat}&longitude=${lon}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),

    fetch(getApiUrl(`/api/nearby-farmers?type=fpo&latitude=${lat}&longitude=${lon}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
  ])
    .then(([farmersData, buyersData, wasteBuyersData, commoditySuppliersData, equipmentSuppliersData, spoData]) => {
      const normalize = (arr: any[]) => arr.map((f: any) => ({
        ...f,
        crops: Array.isArray(f.crops)
          ? f.crops.map((c: any) => ({
              crop_name: c.crop_name || c,
              is_crop_waste: !!c.is_crop_waste
            }))
          : [],
        distance: f.distance ? parseFloat(f.distance) : null,
      }));

      setMatchingResults([
        ...normalize(Array.isArray(farmersData) ? farmersData : []),
        ...normalize(Array.isArray(buyersData) ? buyersData : []),
      ]);

      setWasteBuyerResults(normalize(Array.isArray(wasteBuyersData) ? wasteBuyersData : []));
setsupplierResults(
  normalize(equipmentSuppliersData).filter(s => s.role === 'supplier')
);
setCommoditySupplierResults(normalize(commoditySuppliersData).filter(s => s.role === 'supplier'));
setEquipmentSupplierResults(normalize(equipmentSuppliersData).filter(s => s.role === 'supplier'));
 setSpoResults(
    normalize(Array.isArray(spoData) ? spoData : []).filter(s => s.role === 'fpo')
  );
    })
    .catch(console.error)
    .finally(() => setLoadingMatches(false));
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
     if (userProfile?.role !== 'supplier' && userProfile?.role !== 'fpo' && userCrops.length === 0) return;
      const uniqueCrops = [...new Set(userCrops)];
      setLoadingMatches(true);
      Promise.all([
        fetch(getApiUrl(`/api/nearby-farmers?type=farmers&latitude=${latitude}&longitude=${longitude}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
        fetch(getApiUrl(`/api/nearby-farmers?type=buyers&latitude=${latitude}&longitude=${longitude}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
        fetch(getApiUrl(`/api/nearby-farmers?type=buyers&wasteOnly=true&latitude=${latitude}&longitude=${longitude}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
          fetch(getApiUrl(`/api/nearby-farmers?type=supplier&supplierType=commodities&latitude=${latitude}&longitude=${longitude}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
          fetch(getApiUrl(`/api/nearby-farmers?type=supplier&supplierType=equipment&latitude=${latitude}&longitude=${longitude}&currentUserId=${uid}`)).then(r => r.ok ? r.json() : []),
      ]).then(([farmersData, buyersData, wasteBuyersData, commoditySuppliersData, equipmentSuppliersData]) => {
        const normalize = (arr: any[]) => arr.map((f: any) => ({
          ...f,
          crops: Array.isArray(f.crops)
            ? f.crops.map((c: any) => ({ crop_name: c.crop_name || c, is_crop_waste: !!c.is_crop_waste }))
            : [],
          distance: f.distance ? parseFloat(f.distance) : null,
        }));
        setMatchingResults([
          ...normalize(Array.isArray(farmersData) ? farmersData : []),
          ...normalize(Array.isArray(buyersData) ? buyersData : []),
        ]);
        setWasteBuyerResults(normalize(Array.isArray(wasteBuyersData) ? wasteBuyersData : []));
        console.log("SUPPLIERS DATA:", { commoditySuppliersData, equipmentSuppliersData });
setsupplierResults(
  normalize(equipmentSuppliersData).filter(s => s.role === 'supplier')
);
setCommoditySupplierResults(normalize(commoditySuppliersData).filter(s => s.role === 'supplier'));
setEquipmentSupplierResults(normalize(equipmentSuppliersData).filter(s => s.role === 'supplier'));
      }).catch((err) => {
  console.error("MATCH ERROR:", err);
}).finally(() => setLoadingMatches(false));
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
    <div className="min-h-[100dvh] bg-[#f6f8f4]">


      {/* ── HERO SECTION ── */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-green-950 via-green-800 to-emerald-700 px-5 py-8 text-white sm:px-8 sm:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[40px] border-white/5"></div>
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-24 h-64 w-64 rounded-full bg-lime-300/10"></div>
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-green-100"><span className="h-2 w-2 rounded-full bg-lime-300"></span>Welcome back, {effectiveUser?.name?.split(' ')[0] || 'Farmer'}</p>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Good connections.<br /><span className="text-lime-200">Better harvests.</span></h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-green-100 sm:text-base">Your farming community, fresh opportunities and the tools to grow.</p>
            <a href="#nearby-heading" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-green-900 shadow-sm transition hover:bg-lime-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Find your community <i aria-hidden="true" className="ph-bold ph-arrow-down"></i></a>
          </div>
          <div aria-hidden="true" className="hidden h-36 w-36 shrink-0 items-center justify-center rounded-[40px] border border-white/15 bg-white/10 shadow-xl sm:flex lg:h-44 lg:w-44">
            <i className="ph-fill ph-plant text-8xl text-lime-200"></i>
          </div>
        </div>
      </section>


      {/* ── MAIN CONTENT ── */}
      <div className="max-w-6xl mx-auto px-4 py-7 pb-28 sm:px-8 sm:py-10 sm:pb-28">
        {/* Profile posts — manual swipe carousel, intentionally no auto-scroll */}
        <section className="mb-9 rounded-[28px] border border-slate-200/60 bg-white/70 p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-green-700">From the community</p><h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">Posts</h2><p className="mt-1 text-sm text-slate-500">Updates shared for you</p></div>
            <button onClick={() => router.push('/posts/all')} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-100 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 transition hover:bg-green-100 focus-visible:outline-green-600">View all <i aria-hidden="true" className="ph-bold ph-arrow-up-right"></i></button>
          </div>
          {profilePosts.length ? (
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {profilePosts.map(post => (
                <PostCard key={post.id} post={post} currentUserId={user?.id} compact />
              ))}
            </div>
          ) : (
            <button onClick={() => router.push('/posts')} className="w-full rounded-3xl border border-dashed border-green-200 bg-white px-5 py-8 text-center"><span className="block text-sm font-black text-gray-900">No community posts yet</span><span className="mt-1 block text-xs text-gray-500">Be the first to share an update.</span></button>
          )}
        </section>
        {/* ── DYNAMIC MATCHING SECTIONS ── */}
        <section className="mb-9" aria-labelledby="nearby-heading">
          <div className="mb-5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-green-700">Grow your network</p>
            <h2 id="nearby-heading" tabIndex={-1} className="scroll-mt-28 outline-none text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Buyers &amp; Farmers</h2>
            <p className="mt-2 text-sm sm:text-base text-slate-500">Connect, collaborate and grow together.</p>
          </div>
          <div className="relative mb-5 flex items-center gap-4 overflow-hidden rounded-[28px] border border-green-200 bg-gradient-to-br from-green-50 to-emerald-100/60 p-5 sm:p-7">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 sm:h-20 sm:w-20">
              <i aria-hidden="true" className="ph-fill ph-handshake text-4xl sm:text-5xl"></i>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">Your nearby community</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">Better prices, wider reach and a stronger community.</p>
            </div>
            <i aria-hidden="true" className="ph-fill ph-plant pointer-events-none absolute -bottom-5 -right-3 text-9xl text-green-200/40"></i>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {[
              { label: 'Buyers', description: 'Find fresh produce and great deals.', type: 'buyers', icon: 'ph-shopping-cart', color: 'from-green-400 to-green-600' },
              { label: 'Farmers', description: 'Discover local growers and their produce.', type: 'farmers', icon: 'ph-plant', color: 'from-sky-400 to-blue-600' },
              { label: 'Suppliers', description: 'Connect with trusted commodity and equipment partners.', type: 'supplier', icon: 'ph-truck', color: 'from-amber-400 to-orange-500' },
              { label: 'Wastage Buyers', description: 'Turn agricultural surplus into value.', type: 'wastage', icon: 'ph-recycle', color: 'from-purple-400 to-purple-600' },
            ].map(category => (
              <button
                key={category.type}
                onClick={() => router.push(`/nearby-farmers?type=${category.type}&fresh=true&matchProfile=true`)}
                className="group flex h-full flex-col items-start rounded-[28px] border border-slate-200/60 bg-white p-4 sm:p-5 text-left shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-4 active:scale-[0.98] sm:rounded-[28px] lg:p-6"
              >
                <span className={`mb-5 flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br ${category.color} text-white shadow-md sm:h-16 sm:w-16`}>
                  <i aria-hidden="true" className={`ph-fill ${category.icon} text-3xl`}></i>
                </span>
                <span className="text-lg sm:text-2xl font-extrabold leading-tight text-slate-900">{category.label}</span>
                <span className="mt-2 text-sm sm:text-base leading-relaxed text-slate-500">{category.description}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-bold text-green-700">Explore nearby <i aria-hidden="true" className="ph-bold ph-arrow-right transition-transform group-hover:translate-x-1"></i></span>
              </button>
            ))}
          </div>
          <button onClick={() => router.push('/nearby-farmers?type=fpo&fresh=true')} className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl border border-green-100 bg-green-50 px-5 py-4 text-left text-sm font-bold text-green-800 hover:bg-green-100 focus-visible:outline-green-600">
            <span className="flex items-center gap-2"><i aria-hidden="true" className="ph-fill ph-users-three text-xl"></i>Explore nearby FPOs</span>
            <i aria-hidden="true" className="ph-bold ph-arrow-right"></i>
          </button>
        </section>


        {/* Equipment Grid */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-green-700">Ready for your next harvest</p>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">Top Picks Near You</h2>
              <p className="text-gray-500 text-sm mt-1">Top-rated machinery available near you</p>
            </div>
          </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto hide-scrollbar pb-2">
          {CATEGORIES.map(cat => (
            <button key={cat.label}
              onClick={() => setSelectedCategory(cat.label)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all border ${selectedCategory === cat.label
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
            <div className="bg-white rounded-3xl px-5 py-10 text-center border border-dashed border-gray-200">
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
            <span className="bg-accent text-white text-xs font-black uppercase px-3 py-1 rounded-full mb-3 inline-block">Equipment for your farm</span>
            <h3 className="text-2xl md:text-3xl font-black mb-2">Make every season count</h3>
            <p className="text-brand-100 text-sm">Find the right equipment for your farm, all in one place.</p>
          </div>
          <button
            onClick={() => router.push('/machinery-list')}
            className="relative bg-white text-brand-800 px-8 py-4 rounded-2xl font-black text-sm hover:bg-brand-50 transition-colors shadow-lg whitespace-nowrap flex items-center gap-2">
            Explore equipment <i className="ph-bold ph-arrow-right"></i>
          </button>
        </section>


      </div>

      {/* Role Selection Modal Overlay */}
      <button
        type="button"
        onClick={() => router.push('/posts')}
        aria-label="Create a new post"
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-50 flex items-center gap-2 rounded-full bg-green-600 px-4 py-3 text-sm font-black text-white shadow-[0_10px_30px_rgba(22,163,74,0.4)] transition hover:bg-green-700 active:scale-95 md:bottom-6 md:right-6"
      >
        <i className="ph-bold ph-note-pencil text-xl" aria-hidden="true"></i>
        <span>New Post</span>
      </button>

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
                  <span className="block font-bold text-gray-900">I am a supplier</span>
                  <span className="text-xs text-gray-400">I want to list and manage equipment</span>
                </div>
                {roleUpdating && (
                  <div className="absolute right-6 animate-spin w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full" />
                )}
              </button>
              <button
  onClick={() => agreedToTerms && handleSelectRole('fpo')}
  disabled={roleUpdating || !agreedToTerms}
  className={`group relative flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
    agreedToTerms
      ? 'border-gray-100 hover:border-brand-600 hover:bg-brand-50 cursor-pointer'
      : 'border-gray-100 opacity-50 cursor-not-allowed'
  }`}
>
  <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-white transition-colors">
    <i className="ph-fill ph-buildings text-2xl text-gray-600 group-hover:text-brand-600"></i>
  </div>
  <div>
    <span className="block font-bold text-gray-900">I am an FPO</span>
    <span className="text-xs text-gray-400">Farmer Produce Organization</span>
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
