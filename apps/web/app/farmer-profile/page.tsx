'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import {
  ArrowLeft, MessageCircle, Phone, MapPin, Heart, MessageSquare,
  ChevronUp, ChevronDown, Leaf, ShoppingCart, Award, Package,
  Tractor, Users, UserCheck, Star, Calendar, TrendingUp,
  BadgeCheck, Wheat, Info, ExternalLink, PlayCircle, X
} from 'lucide-react';
import InAppCall from '@/app/components/InAppCall';
import { getApiUrl } from '@/lib/api';
import UserAvatar from '@/app/components/UserAvatar';


// ─── Interfaces ──────────────────────────────────────────────────────────────

interface Certificate {
  id: string;
  name: string;
  issued_by: string;
  issued_date?: string;
  expiry_date?: string;
  certificate_url?: string;
  verified?: boolean;
  grade?: string;           // e.g. "A+", "Grade 1", "Premium"
  crop_names?: string[];    // crops this certificate is linked to
}

interface FarmerProfile {
  id: string;
  name: string;
  email: string;
  image: string;
  location: string;
  role: 'farmer' | 'buyer' | 'supplier';
  bio?: string;
  followers_count: number;
  following_count: number;
  crops_count: number;
  equipments_count: number;
  certificates_count?: number;
  isFollowing: boolean;
  phone?: string;
  calling_enabled?: boolean;
  can_call?: boolean;
  followStatus?: 'none' | 'pending' | 'accepted';
  rating?: number;
  reviews_count?: number;
  member_since?: string;
  is_verified?: boolean;
}

interface Reel {
  id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  likes: number;
  comments: number;
  is_liked: boolean;
  crop_tags?: string[];   // crop names this reel is tagged with
}

function getRealThumbnail(url?: string | null) {
  if (!url) return '';
  return url.includes('via.placeholder.com') ? '' : url;
}

interface Follower {
  id: string;
  name: string;
  image: string;
}

interface Crop {
  crop_name: string;
  years_of_experience: number;
  expertise_level: string;
  expected_yield_date?: string | null;
  expected_yield_quantity?: number | null;
  expected_yield_quantity_uom?: string;
  is_crop_waste: boolean;
  certificate_url?: string | null;
  grade?: string | null;
  certification_type?: string | null;
  // linked data — populated client-side by matching crop_name
  certificates?: Certificate[];
  reels?: Reel[];
}

interface Equipment {
  id: string;
  name: string;
  model: string;
  daily_rate: number;
  image_url: string;
  condition?: string;
  availability?: boolean;
}

// ─── Role Config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  farmer: {
    label: 'Farmer',
    icon: Leaf,
    gradient: 'from-green-500 to-emerald-600',
    badge: 'bg-green-100 text-green-700',
    accent: 'text-green-600',
    accentBg: 'bg-green-600',
    accentLight: 'bg-green-50',
    border: 'border-green-200',
    tag: 'bg-green-100 text-green-700',
  },
  buyer: {
    label: 'Buyer',
    icon: ShoppingCart,
    gradient: 'from-blue-500 to-indigo-600',
    badge: 'bg-blue-100 text-blue-700',
    accent: 'text-blue-600',
    accentBg: 'bg-blue-600',
    accentLight: 'bg-blue-50',
    border: 'border-blue-200',
    tag: 'bg-blue-100 text-blue-700',
  },
  supplier: {
    label: 'Supplier',
    icon: Package,
    gradient: 'from-amber-500 to-orange-600',
    badge: 'bg-amber-100 text-amber-700',
    accent: 'text-amber-600',
    accentBg: 'bg-amber-600',
    accentLight: 'bg-amber-50',
    border: 'border-amber-200',
    tag: 'bg-amber-100 text-amber-700',
  },
};

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  title, count, expanded, onToggle, icon: Icon, color = 'text-gray-900'
}: {
  title: string; count?: number; expanded: boolean;
  onToggle: () => void; icon: any; color?: string;
}) {
  return (
    <div
      onClick={onToggle}
      className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition select-none"
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <h3 className={`font-bold text-base ${color}`}>
          {title}
          {count !== undefined && (
            <span className="ml-1 text-sm font-normal text-gray-500">({count})</span>
          )}
        </h3>
      </div>
      {expanded
        ? <ChevronUp className="w-5 h-5 text-gray-400" />
        : <ChevronDown className="w-5 h-5 text-gray-400" />}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-4 py-6 text-center text-gray-400 text-sm italic">{text}</div>
  );
}

// ─── VideoThumb ───────────────────────────────────────────────────────────────
// Auto-generates a thumbnail by seeking the video to 0.5s and drawing to canvas.
// Falls back gracefully if the video is cross-origin or metadata can't load.

function VideoThumb({
  reel,
  onClick,
  small = false,
}: {
  reel: { id: string; video_url: string; thumbnail_url?: string; likes: number; comments: number };
  onClick: (e: React.MouseEvent) => void;
  small?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnail = getRealThumbnail(reel.thumbnail_url);
  const [poster, setPoster] = useState<string>(thumbnail);
  const [captured, setCaptured] = useState(!!thumbnail);

  useEffect(() => {
    const thumbnail = getRealThumbnail(reel.thumbnail_url);
    if (thumbnail) {
      setPoster(thumbnail);
      setCaptured(true);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const capture = () => {
      try {
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 568;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPoster(canvas.toDataURL('image/jpeg', 0.75));
      } catch {
        /* cross-origin — skip capture, video element will show */
      } finally {
        setCaptured(true);
      }
    };

    const onMeta = () => { video.currentTime = 0.5; };
    const onSeeked = () => capture();

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('seeked', onSeeked);
    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [reel.video_url, reel.thumbnail_url]);

  const sizeClass = small ? 'w-24' : 'w-full';
  const iconSize  = small ? 'w-7 h-7' : 'w-9 h-9';

  return (
    <div
      onClick={onClick}
      className={`relative ${sizeClass} aspect-[9/16] rounded-xl overflow-hidden bg-gray-900 cursor-pointer active:scale-95 transition-transform flex-shrink-0`}
    >
      {/* Hidden canvas for frame extraction */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden video for metadata + seek (only when no stored thumbnail) */}
      {!thumbnail && (
        <video
          ref={videoRef}
          src={reel.video_url}
          className={captured && poster ? 'hidden' : 'w-full h-full object-cover pointer-events-none'}
          preload="metadata"
          playsInline
          muted
          crossOrigin="anonymous"
        />
      )}

      {/* Captured / stored poster */}
      {poster && (
        <img src={poster} alt="reel" className="absolute inset-0 w-full h-full object-cover" />
      )}

      {/* Overlays */}
      <div className="absolute inset-0 bg-black/25" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`${iconSize} rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30`}>
          <PlayCircle className={`${small ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
        </div>
      </div>
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-0.5 text-white text-[10px] font-bold">
            <Heart className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} />{reel.likes || 0}
          </span>
          <span className="flex items-center gap-0.5 text-white text-[10px] font-bold">
            <MessageSquare className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} />{reel.comments || 0}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Expertise Badge ──────────────────────────────────────────────────────────

function ExpertiseBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    beginner: 'bg-gray-100 text-gray-600',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-green-100 text-green-700',
    expert: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${map[level?.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
      {level}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function FarmerProfileContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const farmerId = searchParams.get('id') || searchParams.get('userId');
  const tabParam = searchParams.get('tab') || searchParams.get('expandSection');

  const [profile, setProfile] = useState<FarmerProfile | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Follower[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callType] = useState<'audio' | 'video'>('audio');
  const [expandedCropIdx, setExpandedCropIdx] = useState<number | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [followStatus, setFollowStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const SCROLL_KEY = 'nearbyFarmers_scrollY';
  const VISIBLE_KEY = 'nearbyFarmers_visibleCount';

  // Manage which sections are open (multi-expand)
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (tabParam) initial.add(tabParam);
    return initial;
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const fetchProfile = useCallback(async () => {
    if (!farmerId || !user) return;
    try {
      const url = getApiUrl(`/api/farmers/profile?farmerId=${encodeURIComponent(farmerId)}`);
      const res = await fetch(url, { headers: { 'x-user-id': user.id } });

      if (!res.ok) {
        const ct = res.headers.get('content-type');
        let err: any = {};
        try { err = ct?.includes('json') ? await res.json() : { error: `HTTP ${res.status}` }; }
        catch { err = { error: `HTTP ${res.status}` }; }
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data?.id) throw new Error('Invalid profile data');

      setProfile(data);
      setIsFollowing(data.isFollowing || false);
      // Check follow status
      setFollowStatus(data.followStatus || (data.isFollowing ? 'accepted' : 'none'));

      const rawCrops: Crop[] = Array.isArray(data.crops) ? data.crops : [];
      const rawCerts: Certificate[] = Array.isArray(data.certificates) ? data.certificates : [];
      const rawReels: Reel[] = Array.isArray(data.reels) ? data.reels : [];

      // Enrich each crop with matching certificates and reels
      const enrichedCrops = rawCrops.map(crop => {
        const cropLower = crop.crop_name.toLowerCase();
        const linkedCerts = rawCerts.filter(c =>
          Array.isArray(c.crop_names)
            ? c.crop_names.some(cn => cn.toLowerCase() === cropLower)
            : false
        );
        const linkedReels = rawReels.filter(r =>
          Array.isArray(r.crop_tags)
            ? r.crop_tags.some(t => t.toLowerCase() === cropLower)
            : false
        );
        return { ...crop, certificates: linkedCerts, reels: linkedReels };
      });

      setCrops(enrichedCrops);
      setCertificates(rawCerts);
      setReels(rawReels);
      setEquipment(Array.isArray(data.equipment) ? data.equipment : []);
      setFollowers(Array.isArray(data.followers) ? data.followers : []);
      setFollowing(Array.isArray(data.following) ? data.following : []);
    } catch (e: any) {
      setError(e?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [farmerId, user]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && farmerId && user) fetchProfile(); }, [mounted, farmerId, user, fetchProfile]);

const handleFollow = async () => {
  if (!farmerId || !user) return;

  if (followStatus === 'accepted' || isFollowing) {
    // Unfollow
    try {
      const res = await fetch(getApiUrl('/api/follows'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ followingId: farmerId }),
      });
      if (res.ok) {
        setFollowStatus('none');
        setIsFollowing(false);
        setProfile(p => p ? { ...p, followers_count: p.followers_count - 1 } : p);
      }
    } catch (e) { console.error(e); }
    return;
  }

  if (followStatus === 'pending') return; // already requested

  // Send follow request
  try {
    const res = await fetch(getApiUrl('/api/follows'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
      body: JSON.stringify({ followingId: farmerId }),
    });
    if (res.ok) {
      setFollowStatus('pending');
    }
  } catch (e) { console.error(e); }
};

  // ── Loading / Error States ──────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-[100dvh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
    </div>
  );

  if (error || !profile || !user) return (
    <div className="flex items-center justify-center min-h-[100dvh] flex-col gap-4">
      <p className="text-gray-500">{error || 'Profile not found'}</p>
      <button onClick={() => router.back()} className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold">
        Go Back
      </button>
    </div>
  );

  const isOwnProfile = user?.id === farmerId;
  const trackProfileCall = () => {
    fetch(getApiUrl('/api/analytics'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'call_contact',
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        pagePath: `/farmer-profile?id=${profile.id}`,
        entityType: 'user',
        entityId: profile.id,
        entityName: profile.name,
        metadata: {
          source: 'farmer_profile',
          phone_available: Boolean(profile.phone),
        },
      }),
    }).catch(() => {});
  };
  const role = (profile.role as keyof typeof ROLE_CONFIG) || 'farmer';
  const rc = ROLE_CONFIG[role] || ROLE_CONFIG.farmer;
  const RoleIcon = rc.icon;

  // Sections to show: only if data exists OR always show crops/equipment if counts > 0
  const hasCrops = crops.length > 0;
  const hasEquipment = equipment.length > 0;
  const hasCertificates = certificates.length > 0;
  const hasFollowers = followers.length > 0;
  const hasFollowing = following.length > 0;
  const hasReels = reels.length > 0;
  const callUnavailableMessage = !profile.calling_enabled
    ? 'This user has disabled calls.'
    : followStatus === 'pending'
    ? 'Your follow request must be accepted before you can call.'
    : !isFollowing
    ? 'Follow this profile and wait for acceptance before calling.'
    : 'Phone number not available';

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">

      {/* ── Sticky Header ────────────────────────────────────────────────────── */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center z-40 shadow-sm">
        <button onClick={() => router.back()} className="mr-3 p-1 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 truncate flex-1">{profile.name}</h1>
        {profile.is_verified && <BadgeCheck className="w-5 h-5 text-blue-500 ml-2 flex-shrink-0" />}
      </div>

      {/* ── Cover + Avatar + Info ─────────────────────────────────────────────── */}
      <div className="bg-white border-b">
        {/* Cover */}
        <div className={`h-28 bg-gradient-to-r ${rc.gradient} relative overflow-hidden`}>
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(255,255,255,.15) 20px,rgba(255,255,255,.15) 40px)' }} />
        </div>

        <div className="px-4 pb-5">
          {/* Avatar row */}
          <div className="flex justify-between items-end -mt-10 mb-3">
            <div className="relative">
              <button
                onClick={() => setShowPhotoModal(true)}
                className="relative focus:outline-none active:scale-95 transition-transform"
              >
                <UserAvatar
                  image={profile.image}
                  name={profile.name}
                  size={80}
                  className="rounded-full border-4 border-white shadow-md"
                />
                {/* view hint ring on hover */}
                <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">View</span>
                </div>
              </button>
              {profile.is_verified && (
                <BadgeCheck className="absolute bottom-0 right-0 w-5 h-5 text-blue-500 bg-white rounded-full" />
              )}
            </div>
{!isOwnProfile && (
  <button
    onClick={handleFollow}
    className={`px-5 py-2 rounded-full font-bold text-sm transition ${
      followStatus === 'accepted' || isFollowing
        ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
        : followStatus === 'pending'
        ? 'bg-yellow-100 text-yellow-700 border border-yellow-300 cursor-default'
        : `${rc.accentBg} text-white hover:opacity-90`
    }`}
  >
    {followStatus === 'accepted' || isFollowing
      ? 'Following'
      : followStatus === 'pending'
      ? 'Requested'
      : 'Follow'}
  </button>
)}
          </div>

          {/* Name + role */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-xl font-black text-gray-900">{profile.name}</h2>
            <span className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${rc.badge}`}>
              <RoleIcon className="w-3 h-3" />
              {rc.label}
            </span>
          </div>

          {/* Location */}
          {profile.location && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mb-1">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              {profile.location}
            </p>
          )}

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{profile.bio}</p>
          )}

          {/* Rating */}
          {profile.rating !== undefined && profile.rating > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(profile.rating!) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
              ))}
              <span className="text-xs text-gray-500 ml-1">
                {profile.rating.toFixed(1)} {profile.reviews_count ? `(${profile.reviews_count} reviews)` : ''}
              </span>
            </div>
          )}

          {/* Member since */}
          {profile.member_since && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Member since {new Date(profile.member_since).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          )}

          {/* ── Stats Bar ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-1 mt-4 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden">
            {[
              { key: 'followers', label: 'Followers', count: profile.followers_count, icon: Users, show: true },
              { key: 'following', label: 'Following', count: profile.following_count, icon: UserCheck, show: true },
              { key: 'crops', label: role === 'buyer' ? 'Crops' : 'Crops', count: profile.crops_count, icon: Wheat, show: true },
              { key: 'equipment', label: 'Equipment', count: profile.equipments_count, icon: Tractor, show: true },
            ].map(({ key, label, count, icon: Icon }) => (
              <button
                key={key}
                onClick={() => toggleSection(key)}
                className={`py-3 flex flex-col items-center gap-0.5 transition ${openSections.has(key) ? `${rc.accentLight}` : 'hover:bg-gray-100'}`}
              >
                <Icon className={`w-4 h-4 ${openSections.has(key) ? rc.accent : 'text-gray-400'}`} />
                <p className={`font-black text-base leading-none ${openSections.has(key) ? rc.accent : 'text-gray-900'}`}>{count}</p>
                <p className="text-[10px] text-gray-500 font-medium">{label}</p>
              </button>
            ))}
          </div>

          {/* ── Action Buttons ────────────────────────────────────────────── */}
          {!isOwnProfile && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => router.push(`/messages?ownerId=${profile.id}&ownerName=${encodeURIComponent(profile.name)}`)}
                className={`flex-1 ${rc.accentBg} text-white py-2.5 rounded-xl font-bold hover:opacity-90 transition flex items-center justify-center gap-2`}
              >
                <MessageCircle className="w-4 h-4" />
                Message
              </button>
              <button
                onClick={() => {
                  if (profile.can_call && profile.phone) {
                    trackProfileCall();
                    window.location.href = `tel:${profile.phone}`;
                  }
                  else alert(callUnavailableMessage);
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 ${
                  profile.can_call
                    ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    : 'bg-gray-50 text-gray-400 border border-gray-100'
                }`}
              >
                <Phone className="w-4 h-4" />
                Call
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Expandable Sections ───────────────────────────────────────────────── */}
      <div className="mt-2 bg-white border-y divide-y divide-gray-100">

        {/* ── Crops / Commodities ─────────────────────────────────────────────── */}
        {hasCrops && (
          <div>
            <SectionHeader
              title={role === 'buyer' ? 'Commodities Interested' : 'Crops & Expertise'}
              count={crops.length}
              expanded={openSections.has('crops')}
              onToggle={() => toggleSection('crops')}
              icon={Wheat}
              color="text-green-600"
            />
            {openSections.has('crops') && (
              <div className="px-4 pb-3 space-y-2 pt-1">
                {crops.map((crop, idx) => {
                  const isOpen = expandedCropIdx === idx;
                  const isWaste = crop.is_crop_waste;

                  // Cert data lives directly on the crop row
                  const hasCert = !!(crop.certificate_url || crop.grade || crop.certification_type);

                  // Reels: match by crop_tags, fall back to caption keyword
                  const displayReels = reels.filter(r =>
                    Array.isArray(r.crop_tags) && r.crop_tags.length > 0
                      ? r.crop_tags.some((t: string) => t.toLowerCase() === crop.crop_name.toLowerCase())
                      : (r.caption || '').toLowerCase().includes(crop.crop_name.toLowerCase())
                  );

                  // Find certification label
                  const CERT_TYPES: Record<string, { label: string; icon: string }> = {
                    organic:        { label: 'Organic Certified',                  icon: '🌿' },
                    ipm:            { label: 'IPM (Low Pesticide)',                 icon: '🛡️' },
                    gap:            { label: 'Good Agricultural Practices (GAP)',   icon: '✅' },
                    natural:        { label: 'Natural Farming',                     icon: '🍃' },
                    residue_free:   { label: 'Residue-Free',                        icon: '🧪' },
                    premium:        { label: 'Premium Quality',                     icon: '⭐' },
                    export_quality: { label: 'Export Quality',                      icon: '🌍' },
                    other:          { label: 'Other',                               icon: '📜' },
                  };
                  const certType = crop.certification_type ? CERT_TYPES[crop.certification_type] : null;

                  return (
                    <div
                      key={idx}
                      className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
                        isWaste ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'
                      } ${isOpen ? 'shadow-md border-green-200' : ''}`}
                    >
                      {/* ── Crop Header — always tap to expand ── */}
                      <button
                        className="w-full text-left p-3"
                        onClick={() => setExpandedCropIdx(isOpen ? null : idx)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                            <span className="text-base">{isWaste ? '♻️' : '🌾'}</span>
                            <span className={`font-black text-sm ${isWaste ? 'text-amber-800' : 'text-gray-900'}`}>
                              {crop.crop_name}
                            </span>
                            {crop.expertise_level && <ExpertiseBadge level={crop.expertise_level} />}
                            {isWaste && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-700 uppercase">Waste</span>
                            )}
                            {hasCert && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                                <Award className="w-2.5 h-2.5" />
                                {crop.grade ? `Grade ${crop.grade}` : 'Certified'}
                              </span>
                            )}
                            {displayReels.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                                <PlayCircle className="w-2.5 h-2.5" />
                                {displayReels.length} reel{displayReels.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {isOpen
                            ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          }
                        </div>

                        {/* Meta row — always visible */}
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          {crop.years_of_experience > 0 && (
                            <span className="text-xs text-gray-500">
                              <span className="font-semibold text-gray-700">{crop.years_of_experience}y</span> experience
                            </span>
                          )}
                          {crop.expected_yield_date && (
                            <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {role === 'buyer' ? 'Needed by' : 'Yield by'}: {new Date(crop.expected_yield_date).toLocaleDateString('en-IN')}
                            </span>
                          )}
                          {crop.expected_yield_quantity && (
                            <span className="text-xs text-blue-600 font-medium">
                              Qty: {crop.expected_yield_quantity} {crop.expected_yield_quantity_uom || 'kg'}
                            </span>
                          )}
                        </div>
                      </button>

                      {/* ── Expanded Panel ── */}
                      {isOpen && (
                        <div className="border-t border-dashed border-gray-200">

                          {/* ── Cert / Grade Panel ── */}
                          {hasCert ? (
                            <div className="bg-yellow-50/70 px-3 py-3">
                              <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <Award className="w-3 h-3" /> Certificate &amp; Grade
                              </p>
                              <div className="bg-white rounded-xl p-3 border border-yellow-100 shadow-sm space-y-2">

                                {/* Grade */}
                                {crop.grade && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                                      <span className="w-6 h-6 rounded-lg bg-yellow-100 flex items-center justify-center text-sm">🏅</span>
                                      Grade
                                    </span>
                                    <span className="text-sm font-black text-yellow-700 bg-yellow-50 px-3 py-0.5 rounded-full border border-yellow-200">
                                      {crop.grade}
                                    </span>
                                  </div>
                                )}

                                {/* Certification type */}
                                {certType && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                                      <span className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center text-sm">{certType.icon}</span>
                                      Certification
                                    </span>
                                    <span className="text-xs font-black text-green-700 bg-green-50 px-3 py-0.5 rounded-full border border-green-200">
                                      {certType.label}
                                    </span>
                                  </div>
                                )}

                                {/* Certificate document link */}
                                {crop.certificate_url && (
                                  <div className="flex items-center justify-between pt-1 border-t border-yellow-100">
                                    <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                                      <span className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-sm">
                                        {crop.certificate_url.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                                      </span>
                                      Document
                                    </span>
                                    <a
                                      href={crop.certificate_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="flex items-center gap-1 text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 hover:bg-indigo-100 transition"
                                    >
                                      View <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-yellow-50/40 px-3 py-2.5 flex items-center gap-2">
                              <Award className="w-4 h-4 text-gray-300" />
                              <p className="text-xs text-gray-400 italic">No certificates linked to this crop yet</p>
                            </div>
                          )}

                          {/* Reels for this crop */}
                          {displayReels.length > 0 && (
                            <div className="bg-gray-900/[0.04] px-3 py-3 border-t border-dashed border-gray-200">
                              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <PlayCircle className="w-3 h-3" /> Farm Tales for this crop
                              </p>
                              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                                {displayReels.map((reel) => (
                                  <VideoThumb
                                    key={reel.id}
                                    reel={reel}
                                    small
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/reels?reelId=${reel.id}&userId=${profile!.id}`);
                                    }}
                                  />
                                ))}
                              </div>
                              {displayReels[0]?.caption && (
                                <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 italic">"{displayReels[0].caption}"</p>
                              )}
                            </div>
                          )}

                          {/* View nearby farmers — now inside the panel, not the only action */}
                          {role === 'farmer' && !isWaste && (
                            <div className="px-3 py-2.5 border-t border-gray-100 bg-white">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/nearby-farmers?crops=${encodeURIComponent(crop.crop_name)}`);
                                }}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-green-50 text-green-700 text-xs font-bold border border-green-200 hover:bg-green-100 transition"
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                                Find nearby farmers growing {crop.crop_name}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Equipment ───────────────────────────────────────────────────────── */}
        {(hasEquipment || profile.equipments_count > 0) && (
          <div>
            <SectionHeader
              title="Equipment Available"
              count={profile.equipments_count}
              expanded={openSections.has('equipment')}
              onToggle={() => toggleSection('equipment')}
              icon={Tractor}
              color="text-orange-600"
            />
            {openSections.has('equipment') && (
              <div className="divide-y divide-gray-50">
                {equipment.length === 0 ? (
                  <EmptyState text="No equipment listed yet" />
                ) : (
                  equipment.map((equip: any, idx: number) => {
                    const equipId   = equip.id   ?? idx;
                    const equipName = equip.name  || equip.machinery_name || 'Unnamed Equipment';
                    const equipModel = equip.model || equip.machinery_model || '';
                    const equipRate  = equip.daily_rate ?? equip.rate ?? 0;
                    const equipImg   = equip.image_url  || equip.image || '';
                    const equipCond  = equip.condition  || '';
                    const equipAvail = equip.availability ?? equip.is_available ?? null;

                    return (
                      <button
                        key={equipId}
                        onClick={() => router.push(`/machinery-details?id=${equipId}`)}
                        className="w-full px-4 py-3 flex gap-3 hover:bg-gray-50 active:bg-gray-100 transition text-left"
                      >
                        {equipImg ? (
                          <img
                            src={equipImg}
                            alt={equipName}
                            className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-gray-100"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                            <Tractor className="w-7 h-7 text-orange-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm">{equipName}</p>
                          {equipModel ? <p className="text-xs text-gray-500">Model: {equipModel}</p> : null}
                          {equipCond  ? <p className="text-xs text-gray-400">Condition: {equipCond}</p> : null}
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm font-black text-green-600">
                              ₹{Number(equipRate).toLocaleString('en-IN')}/day
                            </p>
                            {equipAvail !== null && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${equipAvail ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {equipAvail ? 'Available' : 'Rented'}
                              </span>
                            )}
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-300 flex-shrink-0 self-center" />
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Followers ────────────────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            title="Followers"
            count={followers.length}
            expanded={openSections.has('followers')}
            onToggle={() => toggleSection('followers')}
            icon={Users}
            color="text-indigo-600"
          />
          {openSections.has('followers') && (
            <div className="divide-y divide-gray-50">
              {!hasFollowers
                ? <EmptyState text="No followers yet" />
                : followers.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => router.push(f.id === user.id ? '/user-profile' : `/farmer-profile?id=${f.id}`)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition text-left"
                  >
                    <img src={f.image }
                      alt={f.name} className="w-10 h-10 rounded-full object-cover" />
                    <p className="font-semibold text-gray-900 text-sm">{f.name}</p>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* ── Following ────────────────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            title="Following"
            count={following.length}
            expanded={openSections.has('following')}
            onToggle={() => toggleSection('following')}
            icon={UserCheck}
            color="text-violet-600"
          />
          {openSections.has('following') && (
            <div className="divide-y divide-gray-50">
              {!hasFollowing
                ? <EmptyState text="Not following anyone yet" />
                : following.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => router.push(f.id === user.id ? '/user-profile' : `/farmer-profile?id=${f.id}`)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition text-left"
                  >
                    <img src={f.image }
                      alt={f.name} className="w-10 h-10 rounded-full object-cover" />
                    <p className="font-semibold text-gray-900 text-sm">{f.name}</p>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Reels Section ─────────────────────────────────────────────────────── */}
      {hasReels && (
        <div className="mt-2 bg-white border-y p-4">
          <div className="flex items-center gap-2 mb-3">
            <PlayCircle className="w-5 h-5 text-red-500" />
            <h3 className="text-base font-bold text-gray-900">Tales ({reels.length})</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {reels.map((reel) => (
              <VideoThumb
                key={reel.id}
                reel={reel}
                onClick={() => router.push(`/reels?reelId=${reel.id}&userId=${profile.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Nothing to show fallback ──────────────────────────────────────────── */}
      {!hasCrops && !hasEquipment && !hasCertificates && !hasReels && (
        <div className="mt-8 text-center text-gray-400 px-6">
          <Info className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="font-semibold text-gray-500">No additional profile info yet</p>
          <p className="text-sm mt-1">This user hasn't added crops, equipment, or certificates.</p>
        </div>
      )}

      {/* ── Profile Photo Modal ───────────────────────────────────────────────── */}
      {showPhotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setShowPhotoModal(false)}
              className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white transition"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Full-size photo */}
            <UserAvatar
              image={profile.image}
              name={profile.name}
              size={320}
              className="rounded-2xl shadow-2xl"
              style={{ width: '100%', aspectRatio: '1', border: '4px solid rgba(255,255,255,0.1)' }}
            />

            {/* Name + role bar */}
            <div className="mt-3 flex items-center gap-2 justify-center">
              <p className="text-white font-bold text-lg">{profile.name}</p>
              <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${rc.badge}`}>
                <RoleIcon className="w-3 h-3" />
                {rc.label}
              </span>
              {profile.is_verified && <BadgeCheck className="w-5 h-5 text-blue-400" />}
            </div>
            {profile.location && (
              <p className="text-white/60 text-xs text-center mt-1 flex items-center justify-center gap-1">
                <MapPin className="w-3 h-3" />{profile.location}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── In-App Call Modal ─────────────────────────────────────────────────── */}
      {showCallModal && profile && (
        <InAppCall
          isOpen={showCallModal}
          onClose={() => setShowCallModal(false)}
          recipientId={profile.id}
          recipientName={profile.name}
          recipientImage={profile.image || 'https://via.placeholder.com/150'}
          callType={callType}
          userId={user?.id || ''}
        />
      )}
    </div>
  );
}

export default function FarmerProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    }>
      <FarmerProfileContent />
    </Suspense>
  );
}
