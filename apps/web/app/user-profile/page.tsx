'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { MapPin, ChevronUp, LogOut, X, Phone, MessageCircle, MapPinIcon, Heart, Send, Trash2, Star } from 'lucide-react';
import dynamic from 'next/dynamic';
import InAppCall from '@/app/components/InAppCall';
import { getApiUrl } from '@/lib/api';
import UserAvatar from '@/app/components/UserAvatar';

const MapPicker = dynamic(() => import('@/app/components/MapPicker'), { ssr: false });

interface FarmerCrop {
  id: number;
  crop_name: string;
  years_of_experience: number | null;
  expertise_level: string;
  expected_yield_date: string | null;
  expected_yield_quantity: number | null;
  expected_yield_quantity_uom: string;
  is_crop_waste: boolean;
  crop_type: string;
  certificate_url: string | null;
  grade: string | null;
  created_at: string;
  certification_type: string | null;
}

const COMMON_CROPS = [
  'Wheat', 'Rice', 'Corn', 'Maize', 'Barley', 'Oats', 'Rye', 'Millet',
  'Sorghum', 'Quinoa', 'Lentils', 'Chickpeas', 'Beans', 'Peas', 'Soybeans',
  'Peanuts', 'Sunflower', 'Canola', 'Soybean Oil', 'Cotton', 'Sugarcane',
  'Sugar Beet', 'Potato', 'Tomato', 'Onion', 'Garlic', 'Cucumber', 'Carrot',
  'Lettuce', 'Cabbage', 'Spinach', 'Broccoli', 'Cauliflower', 'Pepper',
  'Chili', 'Eggplant', 'Zucchini', 'Pumpkin', 'Squash', 'Watermelon', 'Melon',
  'Strawberry', 'Blueberry', 'Apple', 'Orange', 'Banana', 'Mango', 'Coconut',
  'Coffee', 'Tea', 'Cocoa', 'Tobacco', 'Jute', 'Hemp', 'Flax',
  'Almond', 'Walnut', 'Cashew', 'Pistachio', 'Grape', 'Olive', 'Date Palm',
  'Cacao', 'Vanilla', 'Nutmeg', 'Clove', 'Cinnamon', 'Turmeric', 'Ginger',
  'Chestnut', 'Pecan', 'Hazelnut', 'Macadamia', 'Kiwi', 'Avocado', 'Papaya',
  'Pineapple', 'Lemon', 'Lime', 'Grapefruit', 'Pomegranate', 'Kale', 'Arugula',
  'Celery', 'Beet', 'Turnip', 'Radish', 'Parsnip', 'Asparagus', 'Artichoke',
  'Green Beans', 'Snap Peas', 'Brussels Sprouts', 'Bok Choy', 'Swiss Chard'
];

const GRADE_OPTIONS = ['A+', 'A', 'B+', 'B', 'C', 'D', 'Organic', 'Premium', 'Ungraded'];


const CERTIFICATION_TYPES = [
  { value: 'organic', label: 'Organic Certified', icon: '🌿', color: 'green' },
  { value: 'ipm', label: 'IPM (Low Pesticide)', icon: '🛡️', color: 'blue' },
  { value: 'gap', label: 'Good Agricultural Practices (GAP)', icon: '✅', color: 'teal' },
  { value: 'natural', label: 'Natural Farming', icon: '🍃', color: 'green' },
  { value: 'residue_free', label: 'Residue-Free', icon: '🧪', color: 'purple' },
  { value: 'premium', label: 'Premium Quality', icon: '⭐', color: 'yellow' },
  { value: 'export_quality', label: 'Export Quality', icon: '🌍', color: 'indigo' },
  { value: 'other', label: 'Other', icon: '📜', color: 'gray' },
];

interface Follower {
  id: string;
  name: string;
  image: string;
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  role?: 'farmer' | 'buyer';
  phone?: string;
  location?: string;
  gender?: string;
  age?: number;
}

interface Equipment {
  id: string;
  name: string;
  model: string;
  daily_rate: number;
  image_url: string;
  is_unavailable: boolean;
}

interface FavoriteEquipment {
  id: string;
  name: string;
  model: string;
  daily_rate: number;
  image_url: string;
  location: string;
  owner_id: string;
}

interface Reservation {
  id: number;
  machinery_name: string;
  machinery_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  daily_rate: number | string;
  total_price: number | string;
  status: string;
  image_url?: string;
  renter_name?: string;
  renter_email?: string;
  renter_image?: string;
  user_id?: string;
  owner_id?: string;
  owner_name?: string;
  owner_email?: string;
  owner_image?: string;
  owner_phone?: string;
  owner_location?: string;
  renter_phone?: string;
  machinery_location?: string;
}

// ── Certificate uploader sub-component ───────────────────────
interface CertUploaderProps {
  value: string;
  onChange: (url: string) => void;
  accentColor?: 'green' | 'blue';
}

function CertificateUploader({ value, onChange, accentColor = 'green' }: CertUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const ringClass = accentColor === 'green' ? 'focus:ring-green-500' : 'focus:ring-blue-500';
  const borderClass = accentColor === 'green' ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100' : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100';
  const uploadedBorderClass = accentColor === 'green' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50';
  const textClass = accentColor === 'green' ? 'text-green-700' : 'text-blue-700';
  const linkClass = accentColor === 'green' ? 'text-green-500' : 'text-blue-500';
  const spinClass = accentColor === 'green' ? 'border-green-600' : 'border-blue-600';

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      setError('Only PDF or image files are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10 MB');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(getApiUrl('/api/upload'), { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = await res.json();
      if (!data.url) throw new Error('No URL in upload response');
      onChange(data.url as string);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const isPdf = value?.toLowerCase().endsWith('.pdf');

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 mb-2">
        Certificate / Document <span className="text-gray-400 font-normal text-xs">(optional · PDF or image, max 10 MB)</span>
      </label>

      {value ? (
        <div className={`flex items-center gap-3 p-3 rounded-xl border-2 ${uploadedBorderClass}`}>
          {isPdf ? (
            <div className={`w-10 h-10 rounded-lg ${accentColor === 'green' ? 'bg-green-100' : 'bg-blue-100'} flex items-center justify-center flex-shrink-0`}>
              <i className={`ph-bold ph-file-pdf ${textClass} text-xl`}></i>
            </div>
          ) : (
            <img src={value} alt="Certificate" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${textClass} truncate`}>
              {isPdf ? 'PDF uploaded' : 'Image uploaded'}
            </p>
            <a href={value} target="_blank" rel="noopener noreferrer" className={`text-[10px] ${linkClass} underline underline-offset-2`}>
              View document ↗
            </a>
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1.5 rounded-lg hover:bg-red-100 transition text-red-500"
            title="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed ${borderClass} rounded-xl text-sm font-semibold transition disabled:opacity-50 active:scale-[0.98]`}
        >
          {uploading ? (
            <>
              <div className={`w-4 h-4 rounded-full border-2 ${spinClass} border-t-transparent animate-spin`}></div>
              Uploading…
            </>
          ) : (
            <>
              <i className="ph-bold ph-upload-simple text-base"></i>
              Upload Certificate / Doc
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}

      <input ref={inputRef} type="file" accept="application/pdf,image/*" onChange={handleFile} className="hidden" />
    </div>
  );
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading, signOut } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [myEquipment, setMyEquipment] = useState<Equipment[]>([]);
  const [favoriteEquipment, setFavoriteEquipment] = useState<FavoriteEquipment[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [farmerCrops, setFarmerCrops] = useState<FarmerCrop[]>([]);
  const [newCrop, setNewCrop] = useState({
    crop_name: '', years_of_experience: '', expertise_level: 'Beginner',
    expected_yield_date: '', expected_yield_quantity: '', expected_yield_quantity_uom: 'kg',
    is_crop_waste: false, certificate_url: '', grade: '',certification_type: null as string | null,
  });
  const [addingCrop, setAddingCrop] = useState(false);
  const [showAddCropForm, setShowAddCropForm] = useState(false);
  const [cropSuggestions, setCropSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('crops');
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Follower[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [userLocation, setUserLocation] = useState('Location not set');
  const [mounted, setMounted] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'bookings' | 'rentals' | 'favourites' | 'reels'>('bookings');
  const [myReels, setMyReels] = useState<any[]>([]);
  const [loadingReels, setLoadingReels] = useState(false);
  const [bookings, setBookings] = useState<Reservation[]>([]);
  const [cancelDialog, setCancelDialog] = useState<{ booking: any; refundAmt: number; pct: number } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [matchingResults, setMatchingResults] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [pendingFollowRequests, setPendingFollowRequests] = useState<any[]>([]);
const [showFollowRequests, setShowFollowRequests] = useState(false);
const [processingFollow, setProcessingFollow] = useState<string | null>(null);

  const today = new Date();
  const localDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  ).toISOString().split('T')[0];

  const handleAcceptBooking = async (id: number) => {
    setProcessingId(id);
    try {
      const response = await fetch(getApiUrl(`/api/reservations`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'accepted' }),
      });
      if (response.ok) {
        setRentals(prev => prev.map(req => req.id === id ? { ...req, status: 'accepted' } : req));
        alert('Booking confirmed!');
      } else {
        alert('Failed to accept booking. Please try again.');
      }
    } catch (error) {
      console.error('Error accepting booking:', error);
      alert('Error processing your request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectBooking = async (id: number) => {
    if (!confirm('Are you sure you want to decline this booking request?')) return;
    setProcessingId(id);
    try {
      const response = await fetch(getApiUrl(`/api/reservations`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'rejected' }),
      });
      if (response.ok) {
        setRentals(prev => prev.map(req => req.id === id ? { ...req, status: 'rejected' } : req));
        alert('Booking declined.');
      } else {
        alert('Failed to decline booking. Please try again.');
      }
    } catch (error) {
      console.error('Error rejecting booking:', error);
      alert('Error processing your request.');
    } finally {
      setProcessingId(null);
    }
  };

  const getRefundInfo = (startDate: string, totalPrice: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const days = Math.floor((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days >= 7) return { pct: 100, label: '100% refund' };
    if (days >= 3) return { pct: 50, label: '50% refund' };
    if (days >= 1) return { pct: 25, label: '25% refund' };
    return { pct: 0, label: 'No refund' };
  };

  const handleCancelBooking = async () => {
    if (!cancelDialog) return;
    setCancelling(true);
    try {
      await fetch(getApiUrl(`/api/reservations/${cancelDialog.booking.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      setBookings(prev => prev.map(b => b.id === cancelDialog.booking.id ? { ...b, status: 'cancelled' } : b));
      setCancelDialog(null);
    } catch (e) {
      console.error(e);
    } finally {
      setCancelling(false);
    }
  };

  const [rentals, setRentals] = useState<Reservation[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loadingRentals, setLoadingRentals] = useState(false);
  const [selectedReel, setSelectedReel] = useState<any | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<FarmerCrop | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', email: '', phone: '', location: '', gender: '', age: '',
    latitude: null as number | null, longitude: null as number | null,
  });
  const [profileLocationSuggestions, setProfileLocationSuggestions] = useState<any[]>([]);
  const [profileLocationSearching, setProfileLocationSearching] = useState(false);
  const [profileDetectingLocation, setProfileDetectingLocation] = useState(false);
  const profileLocationTimeout = useRef<any>(null);
  const [editingCrop, setEditingCrop] = useState<FarmerCrop | null>(null);
  const [editCropForm, setEditCropForm] = useState({
    crop_name: '', years_of_experience: '', expertise_level: 'Beginner',
    expected_yield_date: '', expected_yield_quantity: '', expected_yield_quantity_uom: 'kg',
    is_crop_waste: false, certificate_url: '', grade: '',certification_type: null as string | null,
  });
  const [editCropSuggestions, setEditCropSuggestions] = useState<string[]>([]);
  const [showEditCropSuggestions, setShowEditCropSuggestions] = useState(false);
  const [savingCrop, setSavingCrop] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [showProfileImageModal, setShowProfileImageModal] = useState(false);
  const [deletingReelId, setDeletingReelId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0);
  const videoRefsMap = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const [userReviews, setUserReviews] = useState<{ [key: number]: any }>({});
  const [userRole, setUserRole] = useState<'farmer' | 'buyer' | 'supplier' | 'fpo'>('buyer');
  const [showCallModal, setShowCallModal] = useState(false);
  const [callRecipient, setCallRecipient] = useState<{ id: string; name: string; image: string } | null>(null);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');

  useEffect(() => {
    setMounted(true);
    if (searchParams.get('addCrop') === 'true') {
      setShowAddCropForm(true);
    }
  }, []);

  useEffect(() => {
    if (mounted && user?.id) {
      const fetchInitialData = async () => {
        await fetchUserProfile();
        await fetchFollowersCounts();
        const crops = await fetchUserCrops();
        if (crops && crops.length > 0) fetchMatches(crops);
        await fetchUserEquipment();
        await fetchFavoriteEquipment();
        await fetchBookings();
        await fetchRentals();
      };
      fetchInitialData();
    }
  }, [mounted, user?.id]);

useEffect(() => {
  if (userRole === 'supplier') setExpandedSection('equipment');
  else if (userRole === 'fpo') setExpandedSection('crops'); // FPO defaults to crops
}, [userRole]);


  const fetchMatches = async (crops: FarmerCrop[]) => {
    if (!user?.id) return;
    setLoadingMatches(true);
    try {
      const uniqueCrops = [...new Set(crops.map(c => c.crop_name))];
      let lat = 0, lon = 0;
      if (Capacitor.isNativePlatform()) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
        lat = pos.coords.latitude; lon = pos.coords.longitude;
      } else {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject));
        lat = pos.coords.latitude; lon = pos.coords.longitude;
      }
      const buyersRes = await fetch(getApiUrl(`/api/nearby-farmers?type=buyers&crops=${uniqueCrops.join(',')}&latitude=${lat}&longitude=${lon}&currentUserId=${user.id}`));
      const buyersData = await buyersRes.json();
      const mapped = (Array.isArray(buyersData) ? buyersData : []).map((f: any) => ({
        ...f,
        crops: Array.isArray(f.crops) ? f.crops.map((c: any) => ({ crop_name: c.crop_name || c, is_crop_waste: !!c.is_crop_waste })) : [],
        distance: parseFloat(f.distance) || 9999,
      }));
      setMatchingResults(mapped);
    } catch (err) {
      console.error("Error fetching matches for profile:", err);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    const handler = (e: any) => {
      const { location } = e.detail;
      setProfileData((prev: any) => prev ? { ...prev, location } : prev);
    };
    window.addEventListener('userLocationUpdated', handler);
    return () => window.removeEventListener('userLocationUpdated', handler);
  }, []);

  const fetchUserProfile = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(getApiUrl(`/api/users/profile?userId=${user.id}`));
      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
        setUserRole(data.role || 'buyer');
      }
    } catch (error) { console.error('Error fetching user profile:', error); }
  };

 const fetchFollowersCounts = async () => {
  if (!user?.id) return;
  try {
    const res = await fetch(getApiUrl(`/api/follows?user_id=${user.id}&type=both`));
    if (res.ok) {
      const data = await res.json();
      setFollowersCount(data.followers_count ?? 0);
      setFollowingCount(data.following_count ?? 0);
      // Fetch pending requests if any
      if ((data.pending_count ?? 0) > 0) {
        const reqRes = await fetch(getApiUrl(`/api/follows?user_id=${user.id}&type=pending_requests`));
        if (reqRes.ok) setPendingFollowRequests(await reqRes.json());
      }
    }
  } catch (error) {
    console.error('Error fetching counts:', error);
  }
};

  const fetchUserCrops = async () => {
    if (!user?.id) return [];
    try {
      const response = await fetch(getApiUrl(`/api/farmer-crops?user_id=${user.id}`));
      if (!response.ok) throw new Error('Failed to fetch crops');
      const data = await response.json();
      const crops = Array.isArray(data) ? data : [];
      setFarmerCrops(crops);
      return crops;
    } catch (error) {
      console.error('Failed to fetch crops:', error);
      setFarmerCrops([]); return [];
    }
  };

  const fetchUserEquipment = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(getApiUrl(`/api/machinery?owner_id=${user.id}`));
      if (!response.ok) throw new Error('Failed to fetch equipment');
      const data = await response.json();
      setMyEquipment(Array.isArray(data) ? data : []);
    } catch (error) { console.error('Failed to fetch equipment:', error); setMyEquipment([]); }
  };

  const fetchFavoriteEquipment = async () => {
    if (!user?.id) return;
    setLoadingFavorites(true);
    try {
      const response = await fetch(getApiUrl('/api/machinery/favorites'), { headers: { 'x-user-id': user.id } });
      if (!response.ok) throw new Error('Failed to fetch favorites');
      const data = await response.json();
      setFavoriteEquipment(Array.isArray(data.favorites) ? data.favorites : []);
    } catch (error) { console.error('Failed to fetch favorite equipment:', error); setFavoriteEquipment([]); }
    finally { setLoadingFavorites(false); }
  };

  const fetchMyReels = async () => {
    if (!user?.id) return;
    setLoadingReels(true);
    try {
      const response = await fetch(getApiUrl(`/api/reels?userId=${user.id}`));
      if (!response.ok) throw new Error('Failed to fetch my reels');
      const data = await response.json();
      setMyReels(Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []);
    } catch (error) { console.error('Failed to fetch my reels:', error); setMyReels([]); }
    finally { setLoadingReels(false); }
  };

  const handleDeleteReel = async (reelId: string) => {
    if (!confirm('Are you sure you want to delete this reel?')) return;
    if (!user?.id) { alert('User not authenticated'); return; }
    setDeletingReelId(reelId);
    try {
      const response = await fetch(getApiUrl(`/api/reels/${reelId}`), { method: 'DELETE', headers: { 'x-user-id': user.id } });
      if (response.ok) {
        setMyReels(myReels.filter(r => r.id !== reelId));
        setSelectedReel(null);
        alert('Reel deleted successfully');
      } else {
        const errorData = await response.json();
        alert(`Failed to delete reel: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) { console.error('Error deleting reel:', error); alert('Error deleting reel'); }
    finally { setDeletingReelId(null); }
  };

  const fetchBookings = async () => {
    if (!user?.id) return;
    setLoadingBookings(true);
    try {
      const response = await fetch(getApiUrl(`/api/reservations?user_id=${user.id}`));
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const data = await response.json();
      const bookingsWithDetails = await Promise.all(
        data.map(async (reservation: Reservation) => {
          let booking = { ...reservation };
          if (reservation.machinery_id) {
            try {
              const machineRes = await fetch(getApiUrl(`/api/machinery/${reservation.machinery_id}`));
              if (machineRes.ok) {
                const machineData = await machineRes.json();
                booking = { ...booking, image_url: machineData.image_url, machinery_location: machineData.location, owner_phone: machineData.contact_phone };
                if (machineData.owner_id) {
                  try {
                    const ownerRes = await fetch(getApiUrl(`/api/farmers/profile?userId=${machineData.owner_id}`));
                    if (ownerRes.ok) {
                      const ownerData = await ownerRes.json();
                      booking = { ...booking, owner_id: ownerData.id, owner_name: ownerData.name, owner_email: ownerData.email, owner_image: ownerData.image, owner_location: ownerData.location };
                    }
                  } catch (err) { console.error('Failed to fetch owner details:', err); }
                }
              }
            } catch (err) { console.error('Failed to fetch machinery details:', err); }
          }
          return booking;
        })
      );
      setBookings(Array.isArray(bookingsWithDetails) ? bookingsWithDetails : []);
      await fetchUserReviews();
    } catch (error) { console.error('Failed to fetch bookings:', error); setBookings([]); }
    finally { setLoadingBookings(false); }
  };

  const fetchUserReviews = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(getApiUrl(`/api/reviews?user_id=${user.id}`));
      if (response.ok) {
        const reviews = await response.json();
        const reviewMap: { [key: number]: any } = {};
        reviews.forEach((review: any) => { reviewMap[review.reservation_id] = review; });
        setUserReviews(reviewMap);
      }
    } catch (error) { console.error('Failed to fetch reviews:', error); }
  };

  const fetchRentals = async () => {
    if (!user?.id) return;
    setLoadingRentals(true);
    try {
      const response = await fetch(getApiUrl(`/api/reservations?owner_id=${user.id}`));
      if (!response.ok) throw new Error('Failed to fetch rentals');
      const data = await response.json();
      const rentalsWithImages = await Promise.all(
        data.map(async (reservation: Reservation) => {
          if (reservation.machinery_id) {
            try {
              const machineRes = await fetch(getApiUrl(`/api/machinery/${reservation.machinery_id}`));
              if (machineRes.ok) {
                const machineData = await machineRes.json();
                return { ...reservation, image_url: machineData.image_url };
              }
            } catch (err) { console.error('Failed to fetch machinery image:', err); }
          }
          return reservation;
        })
      );
      setRentals(Array.isArray(rentalsWithImages) ? rentalsWithImages : []);
    } catch (error) { console.error('Failed to fetch rentals:', error); setRentals([]); }
    finally { setLoadingRentals(false); }
  };

  const fetchFollowers = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(getApiUrl(`/api/follows?user_id=${user.id}&type=followers`));
      if (!response.ok) throw new Error('Failed to fetch followers');
      const data = await response.json();
      setFollowers(Array.isArray(data) ? data : []);
    } catch (error) { console.error('Failed to fetch followers:', error); setFollowers([]); }
  };

  const fetchFollowing = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(getApiUrl(`/api/follows?user_id=${user.id}&type=following`));
      if (!response.ok) throw new Error('Failed to fetch following');
      const data = await response.json();
      setFollowing(Array.isArray(data) ? data : []);
    } catch (error) { console.error('Failed to fetch following:', error); setFollowing([]); }
  };

  const handleCropNameChange = (value: string) => {
    setNewCrop({ ...newCrop, crop_name: value });
    if (value.trim().length > 0) {
      const filtered = COMMON_CROPS.filter(crop => crop.toLowerCase().includes(value.toLowerCase()));
      setCropSuggestions(filtered); setShowSuggestions(filtered.length > 0);
    } else {
      setCropSuggestions([]); setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (crop: string) => {
    setNewCrop({ ...newCrop, crop_name: crop });
    setCropSuggestions([]); setShowSuggestions(false);
  };

  const handleAddCrop = async () => {
    if (!user?.id || !newCrop.crop_name.trim()) { alert('Please enter a crop name'); return; }
    if (userRole === 'supplier') { alert('Suppliers cannot add crops'); return; }

    const name = newCrop.crop_name.trim();
    const qty = newCrop.expected_yield_quantity;
    const exp = newCrop.years_of_experience;

    if (!name) { alert('Crop name is required'); return; }
    if (!/^[A-Za-z\s]+$/.test(name)) { alert('Crop name should contain only letters'); return; }

    if (newCrop.expected_yield_date) {
      const selectedDate = new Date(newCrop.expected_yield_date);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (selectedDate < today) { alert('Yield date cannot be in the past'); return; }
    }
    if (qty) {
      const parsedQty = parseFloat(qty);
      if (isNaN(parsedQty)) { alert('Quantity must be a number'); return; }
      if (parsedQty <= 0) { alert('Quantity must be greater than 0'); return; }
      if (parsedQty > 1000000) { alert('Quantity too large'); return; }
    }
    if (exp) {
      const parsedExp = parseInt(exp);
      if (isNaN(parsedExp) || parsedExp < 0) { alert('Experience must be a positive number'); return; }
      if (parsedExp > 80) { alert('Experience seems unrealistic'); return; }
    }

    const normalizedNewCrop = newCrop.crop_name.trim().toLowerCase();
    if (farmerCrops.some(c => c.crop_name.trim().toLowerCase() === normalizedNewCrop)) {
      alert('Crop already added'); return;
    }

    setAddingCrop(true);
    try {
      const response = await fetch(getApiUrl(`/api/farmer-crops`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          crop_name: newCrop.crop_name,
          years_of_experience: (userRole === 'farmer' || userRole === 'fpo')  ? (newCrop.years_of_experience ? parseInt(newCrop.years_of_experience) : null) : null,
          expertise_level: (userRole === 'farmer' || userRole === 'fpo') ? newCrop.expertise_level : 'Beginner',
          expected_yield_date: newCrop.expected_yield_date || null,
          expected_yield_quantity: newCrop.expected_yield_quantity ? parseFloat(newCrop.expected_yield_quantity) : null,
          expected_yield_quantity_uom: newCrop.expected_yield_quantity_uom || 'kg',
          crop_type: 'grow',
          is_crop_waste: userRole === 'buyer' ? newCrop.is_crop_waste : false,
          certificate_url: newCrop.certificate_url || null,
          certification_type: (userRole === 'farmer' || userRole === 'fpo') ? (newCrop.certification_type || null) : null,
          grade: newCrop.grade || null,
        }),
      });
      const data = await response.json();
      if (response.ok && !data.error) {
        setNewCrop({ crop_name: '', years_of_experience: '', expertise_level: 'Beginner', expected_yield_date: '', expected_yield_quantity: '', expected_yield_quantity_uom: 'kg', is_crop_waste: false, certificate_url: '', grade: '', certification_type: null });
        setShowAddCropForm(false);
        setCropSuggestions([]); setShowSuggestions(false);
        await fetchUserCrops();
        alert('Crop added successfully!');
      } else {
        alert(`Failed to add crop: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error adding crop:', error);
      alert(`Error adding crop: ${error.message}`);
    } finally {
      setAddingCrop(false);
    }
  };

  const handleDeleteCrop = async (cropId: number) => {
    if (!confirm('Remove this crop from your expertise?')) return;
    try {
      const response = await fetch(getApiUrl(`/api/farmer-crops?id=${cropId}`), { method: 'DELETE' });
      if (response.ok) { setFarmerCrops(farmerCrops.filter(c => c.id !== cropId)); alert('Crop removed'); }
      else { alert('Failed to remove crop'); }
    } catch (error) { console.error('Error deleting crop:', error); alert('Error removing crop'); }
  };

  const handleEditCropClick = (crop: FarmerCrop) => {
    setEditingCrop(crop);
    let formattedDate = '';
    if (crop.expected_yield_date) {
      try {
        const d = new Date(crop.expected_yield_date);
        if (!isNaN(d.getTime())) formattedDate = d.toISOString().split('T')[0];
      } catch (e) { console.error('Error formatting date for edit:', e); }
    }
    setEditCropForm({
      crop_name: crop.crop_name,
      years_of_experience: crop.years_of_experience ? String(crop.years_of_experience) : '',
      expertise_level: crop.expertise_level,
      expected_yield_date: formattedDate,
      expected_yield_quantity: crop.expected_yield_quantity ? String(crop.expected_yield_quantity) : '',
      expected_yield_quantity_uom: crop.expected_yield_quantity_uom || 'kg',
      is_crop_waste: crop.is_crop_waste || false,
      certificate_url: crop.certificate_url || '',
      certification_type: crop.certification_type || null,
      grade: crop.grade || '',
    });
    setEditCropSuggestions([]); setShowEditCropSuggestions(false);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  };

  const handleEditCropNameChange = (value: string) => {
    setEditCropForm({ ...editCropForm, crop_name: value });
    if (value.trim().length > 0) {
      const filtered = COMMON_CROPS.filter(crop => crop.toLowerCase().includes(value.toLowerCase()));
      setEditCropSuggestions(filtered); setShowEditCropSuggestions(filtered.length > 0);
    } else {
      setEditCropSuggestions([]); setShowEditCropSuggestions(false);
    }
  };

  const handleSelectEditCropSuggestion = (crop: string) => {
    setEditCropForm({ ...editCropForm, crop_name: crop });
    setEditCropSuggestions([]); setShowEditCropSuggestions(false);
  };

  const handleSaveEditCrop = async () => {
    if (!editingCrop || !editCropForm.crop_name.trim()) { alert('Please enter a crop name'); return; }
    setSavingCrop(true);
    try {
      const response = await fetch(getApiUrl(`/api/farmer-crops`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCrop.id,
          crop_name: editCropForm.crop_name,
          years_of_experience: userRole === 'farmer' || userRole === 'fpo' ? (editCropForm.years_of_experience ? parseInt(editCropForm.years_of_experience) : null) : null,
          expertise_level: userRole === 'farmer' || userRole === 'fpo' ? editCropForm.expertise_level : 'Beginner',
          expected_yield_date: editCropForm.expected_yield_date || null,
          expected_yield_quantity: editCropForm.expected_yield_quantity ? parseFloat(editCropForm.expected_yield_quantity) : null,
          expected_yield_quantity_uom: editCropForm.expected_yield_quantity_uom || 'kg',
          crop_type: 'grow',
          is_crop_waste: userRole === 'buyer' ? editCropForm.is_crop_waste : false,
          certificate_url: editCropForm.certificate_url || null,
          certification_type: userRole === 'farmer' || userRole === 'fpo' ? (editCropForm.certification_type || null) : null,
          grade: editCropForm.grade || null,
        }),
      });
      const data = await response.json();
      if (response.ok && !data.error) {
        setEditingCrop(null);
        await fetchUserCrops();
        alert('Crop updated successfully!');
      } else {
        alert(`Failed to update crop: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error updating crop:', error);
      alert(`Error updating crop: ${error.message}`);
    } finally {
      setSavingCrop(false);
    }
  };

  const handleOpenEditModal = () => {
    if (user) {
      const p = profileData || {};
      setEditForm({ name: p.name || user.name || '', email: p.email || user.email || '', phone: p.phone || '', location: p.location || '', gender: p.gender || '', age: p.age ? String(p.age) : '', latitude: p.latitude || null, longitude: p.longitude || null });
      setShowEditModal(true);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user?.id) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
  !editForm.name.trim() ||
  !editForm.email.trim() ||
  !editForm.location.trim()
) {
  alert('Name, email, phone and location are required');
  return;
}
    if (!editForm.name.trim()) { alert('Name is required'); return; }
    if (!emailRegex.test(editForm.email)) { alert('Enter a valid email'); return; }
    setIsUpdatingProfile(true);
    try {
      const response = await fetch(getApiUrl(`/api/users/profile`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name: editForm.name, email: editForm.email, phone: editForm.phone, location: editForm.location, gender: editForm.gender || null, age: editForm.age ? parseInt(editForm.age) : null, ...(editForm.latitude != null ? { latitude: editForm.latitude, longitude: editForm.longitude } : {}) }),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      const updated = await response.json();
      setProfileData(updated); setUserRole(updated.role || 'buyer');
      alert('Profile updated successfully!'); setShowEditModal(false);
    } catch (error) { console.error('Error updating profile:', error); alert('Failed to update profile'); }
    finally { setIsUpdatingProfile(false); }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try { await signOut(); router.push('/login'); }
    catch (err) { console.error('Sign out failed:', err); }
    finally { setIsSigningOut(false); }
  };

  const handleProfilePhotoClick = async () => {
    try {
      setIsUploadingPhoto(true); setUploadError(null);
      if (Capacitor.isNativePlatform()) {
        const image = await Camera.getPhoto({ quality: 90, resultType: CameraResultType.DataUrl, source: CameraSource.Prompt });
        if (image.dataUrl) await uploadProfilePhoto(image.dataUrl);
      } else {
        fileInputRef.current?.click();
      }
    } catch (error) { console.error('Error capturing photo:', error); setUploadError('Failed to capture photo'); }
    finally { setIsUploadingPhoto(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files[0]) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result && typeof event.target.result === 'string') {
        setPreviewImage(event.target.result); setShowImagePreview(true);
      }
    };
    reader.readAsDataURL(files[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  const handleFollowAction = async (followerId: string, action: 'accepted' | 'rejected') => {
  setProcessingFollow(followerId);
  try {
    const res = await fetch(getApiUrl('/api/follows'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': user!.id },
      body: JSON.stringify({ followerId, action }),
    });
    if (res.ok) {
      setPendingFollowRequests(prev => prev.filter(r => r.user_id !== followerId));
      if (action === 'accepted') {
        setFollowersCount(prev => prev + 1);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    setProcessingFollow(null);
  }
};

  const uploadProfilePhoto = async (dataUrl: string) => {
    try {
      setIsUploadingPhoto(true); setUploadError(null);
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append('file', blob, 'profile-photo.jpg');
      const uploadRes = await fetch(getApiUrl(`/api/upload`), { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(`Upload failed with status ${uploadRes.status}: ${errorText}`);
      }
      const uploadData = await uploadRes.json();
      let imageUrl: string | null = null;
      if (typeof uploadData === 'string') imageUrl = uploadData;
      else if (uploadData.url) imageUrl = uploadData.url;
      else if (uploadData.path) imageUrl = uploadData.path;
      else if (uploadData.key) imageUrl = uploadData.key;
      else if (uploadData.filename) imageUrl = uploadData.filename;
      if (!imageUrl) throw new Error('No valid image URL from upload service');
      if (user?.id) {
        const updateRes = await fetch(getApiUrl(`/api/users/${user.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: imageUrl }) });
        if (!updateRes.ok) throw new Error(`Failed to update profile picture: ${updateRes.status}`);
        try {
          const { storeMobileSession } = await import('@/hooks/useAuth');
          if (Capacitor.isNativePlatform()) {
            const raw = localStorage.getItem('cofarmz_mobile_user');
            if (raw) { const stored = JSON.parse(raw); storeMobileSession({ ...stored, image: imageUrl }); }
          }
        } catch {}
        window.dispatchEvent(new CustomEvent('profileImageUpdated', { detail: { image: imageUrl } }));
        setProfileData((prev: any) => prev ? { ...prev, image: imageUrl } : prev);
        setPreviewImage(null); setShowImagePreview(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Photo upload error:', errorMessage); setUploadError(errorMessage);
    } finally { setIsUploadingPhoto(false); }
  };


  if (loading || !isAuthenticated || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-40">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
          <p className="text-xs text-gray-500 mt-0.5">
           {userRole === 'farmer' ? '🌾 Farmer Profile' 
             : userRole === 'supplier' ? '🏭 Supplier Profile' 
             : userRole === 'fpo' ? '🏢 FPO Profile'
             : '🛒 Buyer Profile'}
        </p>        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleOpenEditModal} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition text-sm font-bold text-gray-700 active:scale-95">
            <i className="ph-bold ph-pencil text-base"></i>Edit
          </button>
          <button onClick={handleSignOut} disabled={isSigningOut} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 rounded-xl transition text-sm font-bold text-red-600 active:scale-95 disabled:opacity-50">
            <LogOut className="w-4 h-4" />
            {isSigningOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>

      {/* Profile header */}
      <div className="bg-white border-b">
        <div className="h-24 bg-gradient-to-r from-green-500 to-green-600"></div>
        <div className="px-4 pb-4">
          <div className="flex justify-between items-start -mt-12 mb-4">
            <div className="relative group">
              <button onClick={() => setShowProfileImageModal(true)} className="relative cursor-pointer">
                <UserAvatar image={profileData?.image || user?.image} name={user?.name} size={80} className="rounded-full border-4 border-white hover:opacity-80 transition" style={{ borderWidth: 4, borderStyle: 'solid', borderColor: 'white' }} />
                <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">View</span>
                </div>
              </button>
              <button onClick={handleProfilePhotoClick} disabled={isUploadingPhoto} className="absolute bottom-0 right-0 bg-green-600 hover:bg-green-700 text-white p-1.5 rounded-full shadow-lg transition" title="Change photo">
                <i className="ph-bold ph-pencil text-sm"></i>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-bold text-gray-900">{user?.name || 'User'}</h2>
            <div className={`px-3 py-1 rounded-full ${
              userRole === 'farmer' ? 'bg-green-100' 
              : userRole === 'supplier' ? 'bg-purple-100' 
              : userRole === 'fpo' ? 'bg-teal-100'
              : 'bg-blue-100'}`}>
              <span className={`text-xs font-semibold ${
                userRole === 'farmer' ? 'text-green-700' 
                : userRole === 'supplier' ? 'text-purple-700' 
                : userRole === 'fpo' ? 'text-teal-700'
                : 'text-blue-700'}`}>
                {userRole === 'farmer' ? '🌾 Farmer' 
                : userRole === 'buyer' ? '🛒 Buyer' 
                : userRole === 'supplier' ? '🏭 Supplier'
                : '🏢 FPO'}
              </span>
            </div>
          </div>
          <button onClick={handleOpenEditModal} className="text-sm flex items-center gap-1 mt-1 hover:opacity-80 transition">
            <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
            {profileData?.location
              ? <span className="text-gray-700 font-medium">{profileData.location}</span>
              : <span className="text-green-600 font-medium underline underline-offset-2">+ Add your location</span>}
          </button>
          <div className="grid grid-cols-4 gap-2 mt-4 text-center text-xs">
            <button onClick={() => { if (expandedSection === 'followers') { setExpandedSection(null); } else { setExpandedSection('followers'); fetchFollowers(); } }} className="cursor-pointer hover:bg-gray-50 p-2 rounded transition">
              <p className="font-bold text-lg text-gray-900">{followersCount}</p>
              <p className="text-xs text-gray-600">Followers</p>
            </button>
            <button onClick={() => { if (expandedSection === 'following') { setExpandedSection(null); } else { setExpandedSection('following'); fetchFollowing(); } }} className="cursor-pointer hover:bg-gray-50 p-2 rounded transition">
              <p className="font-bold text-lg text-gray-900">{followingCount}</p>
              <p className="text-xs text-gray-600">Following</p>
            </button>
           {userRole !== 'supplier' && (
              <button onClick={() => { if (expandedSection === 'crops') { setExpandedSection(null); } else { setExpandedSection('crops'); fetchUserCrops(); } }} className="cursor-pointer hover:bg-gray-50 p-2 rounded transition">
                <p className="font-bold text-lg text-gray-900">{farmerCrops.length}</p>
                <p className="text-xs text-gray-600">Crops</p>
              </button>
            )}
            <button onClick={() => { if (expandedSection === 'equipment') { setExpandedSection(null); } else { setExpandedSection('equipment'); fetchUserEquipment(); } }} className="cursor-pointer hover:bg-gray-50 p-2 rounded transition">
              <p className="font-bold text-lg text-gray-900">{myEquipment.length}</p>
              <p className="text-xs text-gray-600">Equipment</p>
            </button>
          </div>
        </div>
       </div>

        {/* Expanded sections */}
        {expandedSection && (
        <div className="bg-white border-b">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <h3 className="font-bold text-gray-900 text-sm uppercase">
              {expandedSection === 'followers' && 'Followers'}
              {expandedSection === 'following' && 'Following'}
              {expandedSection === 'crops' && 'Crops'}
              {expandedSection === 'equipment' && 'My Equipment'}
            </h3>
            <button onClick={() => setExpandedSection(null)} className="p-1 hover:bg-gray-200 rounded transition">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <div className="px-4 py-4 max-h-96 overflow-y-auto">

            {expandedSection === 'followers' && (
              followers.length === 0
                ? <div className="text-center py-8"><p className="text-sm text-gray-600">No followers yet</p></div>
                : <div className="space-y-3">{followers.map(follower => (
                  <button key={follower.id} onClick={() => router.push(`/farmer-profile?id=${follower.id}`)} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg w-full text-left hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3 flex-1">
                     <UserAvatar image={follower.image} name={follower.name} size={40} />
                      <p className="font-semibold text-sm text-gray-900">{follower.name}</p>
                    </div>
                  </button>
                ))}</div>
            )}

            {expandedSection === 'following' && (
              following.length === 0
                ? <div className="text-center py-8"><p className="text-sm text-gray-600">Not following anyone yet</p></div>
                : <div className="space-y-3">{following.map(u => (
                  <button key={u.id} onClick={() => router.push(`/farmer-profile?id=${u.id}`)} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg w-full text-left hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3 flex-1">
                      <img src={u.image } alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                      <p className="font-semibold text-sm text-gray-900">{u.name}</p>
                    </div>
                  </button>
                ))}</div>
            )}

            {expandedSection === 'crops' && (
              <>
                {farmerCrops.length === 0
                  ? <div className="text-center py-8"><p className="text-sm text-gray-600 mb-3">No crops added yet</p></div>
                  : <div className="space-y-3">{farmerCrops.map(crop => (
                    <div key={crop.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-green-50 hover:border-green-200 transition-colors active:scale-[0.98]" onClick={() => setSelectedCrop(crop)}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-sm text-gray-900">{crop.crop_name}</h4>
                        <div className="flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); handleEditCropClick(crop); }} className="text-blue-600 hover:text-blue-700 text-xs p-1">
                            <i className="ph-bold ph-pencil text-sm"></i>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteCrop(crop.id); }} className="text-red-600 hover:text-red-700 text-xs p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        {crop.years_of_experience ? <p>Experience: {crop.years_of_experience} years</p> : null}
                        {crop.expertise_level && <p>Level: {crop.expertise_level}</p>}
                        {crop.is_crop_waste && <p className="text-orange-700 font-semibold">🌾 Crop Waste</p>}
                        {crop.expected_yield_date && <p className="text-green-700 font-medium">{userRole === 'farmer' || userRole === 'fpo' ? 'Expected Yield' : 'Want to Buy By'}: {new Date(crop.expected_yield_date).toLocaleDateString()}</p>}
                        {crop.expected_yield_quantity && <p className="text-green-700 font-medium">Quantity: {crop.expected_yield_quantity} {crop.expected_yield_quantity_uom}</p>}
                        {/* ── NEW: show grade & certificate badge in list ── */}
                        {crop.grade && <p className="text-indigo-700 font-semibold">Grade: {crop.grade}</p>}
                        {crop.certificate_url && (
                          <a href={crop.certificate_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-indigo-600 font-semibold hover:underline">
                            <i className="ph-bold ph-file-text text-sm"></i> View Certificate ↗
                          </a>
                        )}
                        {crop.certification_type && (() => {
                          const cert = CERTIFICATION_TYPES.find(c => c.value === crop.certification_type);
                          return cert ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-black border border-green-200">
                              {cert.icon} {cert.label}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  ))}</div>
                }
               {userRole !== 'supplier' &&  (

                  <button onClick={() => setShowAddCropForm(true)} className="w-full mt-4 text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2">
                    <i className="ph-bold ph-plus text-sm"></i>Add Crop
                  </button>
                )}
              </>
            )}

            {expandedSection === 'equipment' && (
              <>
                {myEquipment.length === 0
                  ? <div className="text-center py-8"><p className="text-sm text-gray-600 mb-3">No equipment listed</p></div>
                  : <div className="space-y-3">{myEquipment.map(equipment => (
                    <div key={equipment.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="flex gap-3">
                        <img src={equipment.image_url || 'https://via.placeholder.com/60'} alt={equipment.name} className="w-12 h-12 rounded object-cover cursor-pointer flex-shrink-0" onClick={() => router.push(`/machinery-details?id=${equipment.id}`)} />
                        <div className="flex-1 min-w-0" onClick={() => router.push(`/machinery-details?id=${equipment.id}`)} style={{ cursor: 'pointer' }}>
                          <h4 className="font-semibold text-sm text-gray-900 truncate">{equipment.name}</h4>
                          <p className="text-xs text-gray-600">{equipment.model}</p>
                          <p className="text-sm font-bold text-green-600 mt-1">₹{equipment.daily_rate}/day</p>
                        </div>
                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                          <button onClick={() => router.push(`/rent-machinery?id=${equipment.id}`)} className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition active:scale-95">
                            <i className="ph-bold ph-pencil text-sm"></i>
                          </button>
                          <button onClick={async () => {
                            const newVal = !equipment.is_unavailable;
                            try {
                              const res = await fetch(getApiUrl(`/api/machinery/${equipment.id}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_unavailable: newVal }) });
                              if (res.ok) setMyEquipment(prev => prev.map(e => e.id === equipment.id ? { ...e, is_unavailable: newVal } : e));
                            } catch {}
                          }} className="flex flex-col items-center gap-0.5">
                            <div className={`w-10 h-5 rounded-full relative flex items-center px-0.5 transition-colors ${!equipment.is_unavailable ? 'bg-green-500' : 'bg-gray-300'}`}>
                              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${!equipment.is_unavailable ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                            <span className={`text-[9px] font-bold ${!equipment.is_unavailable ? 'text-green-600' : 'text-gray-400'}`}>{!equipment.is_unavailable ? 'Live' : 'Off'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}</div>
                }
                <button onClick={() => router.push('/rent-machinery')} className="w-full mt-4 text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2">
                  <i className="ph-bold ph-plus text-sm"></i>Add Equipment
                </button>
              </>
            )}
          </div>
        </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white border-b">
        <div className="flex">
          {(['bookings', 'rentals', 'favourites', 'reels'] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'bookings') fetchBookings(); else if (tab === 'rentals') fetchRentals(); else if (tab === 'favourites') fetchFavoriteEquipment(); else if (tab === 'reels') fetchMyReels(); }}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition capitalize ${activeTab === tab ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab === 'bookings' ? 'My Bookings' : tab === 'rentals' ? 'Booking Requests' : tab === 'favourites' ? 'Favourites' : 'My Reels'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content — unchanged from your current version, omitted for brevity */}
      <div className="px-4 py-4 min-h-[300px]">
        {activeTab === 'bookings' && (
          <div>
            {loadingBookings ? (<div className="flex justify-center py-12"><div className="w-10 h-10 rounded-full border-4 border-green-600 border-t-transparent animate-spin"></div></div>)
              : bookings.length === 0 ? (<div className="text-center py-12"><p className="text-gray-500 text-sm">No bookings yet</p></div>)
              : (<div className="space-y-4">{bookings.map(booking => (
                <div key={booking.id} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex gap-3">
                    <img src={booking.image_url || 'https://via.placeholder.com/80'} alt={booking.machinery_name} className="w-20 h-20 rounded-lg object-cover cursor-pointer" onClick={() => router.push(`/machinery-details?id=${booking.machinery_id}`)} />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 cursor-pointer hover:text-green-700 transition-colors" onClick={() => router.push(`/machinery-details?id=${booking.machinery_id}`)}>{booking.machinery_name}</h3>
                      {booking.owner_id && (<div className="flex items-center gap-1.5 mt-1.5 cursor-pointer group" onClick={() => router.push(`/farmer-profile?id=${booking.owner_id}`)}>
                        <UserAvatar image={booking.owner_image} name={booking.owner_name || 'O'} size={20} />
                        <span className="text-xs text-gray-600 group-hover:text-green-700 transition font-medium">{booking.owner_name || 'Owner'}</span>
                        <i className="ph ph-arrow-right text-gray-400 text-[10px]"></i>
                      </div>)}
                      <p className="text-xs text-gray-600 mt-1">{new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-600">{booking.total_days} days</p>
                      <p className="font-bold text-green-600 mt-1">₹{booking.total_price}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${booking.status === 'accepted' ? 'bg-green-100 text-green-700' : booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : booking.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{booking.status}</span>
                        {booking.owner_phone && (<button onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${booking.owner_phone}`; }} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 font-semibold hover:bg-green-100 transition"><Phone className="w-3 h-3" />Call</button>)}
                        {(booking.status === 'pending' || booking.status === 'accepted') && (() => {
                          const totalPrice = Number(booking.total_price);
                          const { pct } = getRefundInfo(booking.start_date, totalPrice);
                          const refundAmt = Math.round((totalPrice * pct) / 100);
                          return (<button onClick={() => setCancelDialog({ booking, refundAmt, pct })} className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 font-semibold hover:bg-red-100 transition">Cancel</button>);
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}</div>)}
          </div>
        )}

        {cancelDialog && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <h3 className="text-lg font-black text-gray-900 mb-1">Cancel Booking?</h3>
              <p className="text-sm text-gray-500 mb-4">{cancelDialog.booking.machinery_name}</p>
              <div className={`rounded-xl p-4 mb-5 ${cancelDialog.pct === 100 ? 'bg-green-50 border border-green-200' : cancelDialog.pct === 0 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <p className="text-xs font-semibold text-gray-600 mb-1">Refund based on cancellation policy</p>
                <p className="text-2xl font-black text-gray-900">₹{cancelDialog.refundAmt.toLocaleString()}</p>
                <p className={`text-xs font-bold mt-1 ${cancelDialog.pct === 100 ? 'text-green-700' : cancelDialog.pct === 0 ? 'text-red-600' : 'text-yellow-700'}`}>{cancelDialog.pct}% of ₹{Number(cancelDialog.booking.total_price).toLocaleString()} total</p>
              </div>
              <div className="text-xs text-gray-400 mb-5 space-y-1">
                <p>• 7+ days before: 100% refund</p><p>• 3–6 days before: 50% refund</p><p>• 1–2 days before: 25% refund</p><p>• Same day: No refund</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setCancelDialog(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Keep Booking</button>
                <button onClick={handleCancelBooking} disabled={cancelling} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-50">{cancelling ? 'Cancelling...' : 'Yes, Cancel'}</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rentals' && (
          <div>
            {loadingRentals ? (<div className="flex justify-center py-12"><div className="w-10 h-10 rounded-full border-4 border-green-600 border-t-transparent animate-spin"></div></div>)
              : rentals.length === 0 ? (<div className="text-center py-12"><p className="text-gray-500 text-sm">No booking requests yet. Add machinery to receive bookings.</p></div>)
              : (<div className="space-y-4">{rentals.map(rental => (
                <div key={rental.id} className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all ${rental.status === 'pending' ? 'border-yellow-200 ring-1 ring-yellow-50' : 'border-gray-100'}`}>
                  <div className="p-4">
                    <div className="flex gap-4">
                      <div className="relative">
                        <img src={rental.image_url || 'https://via.placeholder.com/100'} alt={rental.machinery_name} className="w-24 h-24 rounded-xl object-cover shadow-sm" />
                        <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-md ${rental.status === 'accepted' ? 'bg-green-600 text-white' : rental.status === 'pending' ? 'bg-amber-500 text-white' : rental.status === 'completed' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>{rental.status}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-lg truncate">{rental.machinery_name}</h3>
                        <div className="mt-2 border-y border-gray-50 py-2">
                          <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-1 transition" onClick={() => rental.user_id && router.push(`/farmer-profile?id=${rental.user_id}`)}>
                            <UserAvatar image={rental.renter_image} name={rental.renter_name || 'U'} size={24} />
                            <p className="text-xs font-bold text-gray-700 truncate flex-1">{rental.renter_name || 'Anonymous Renter'}</p>
                            <i className="ph ph-arrow-right text-gray-400 text-xs"></i>
                          </div>
                          {rental.renter_phone && (<a href={`tel:${rental.renter_phone}`} onClick={e => e.stopPropagation()} className="ml-auto"><div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center"><i className="ph-bold ph-phone text-white text-xs"></i></div></a>)}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
                          <div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Duration</p><p className="text-xs font-bold text-gray-800">{rental.total_days} nights</p></div>
                          <div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Earnings</p><p className="text-xs font-black text-green-700">₹{rental.total_price}</p></div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 flex items-center justify-between border-t border-gray-50">
                      <div className="flex items-center gap-2">
                        <i className="ph ph-calendar text-gray-400"></i>
                        <span className="text-xs font-bold text-gray-600">{new Date(rental.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - {new Date(rental.end_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    {rental.status === 'pending' && (
                      <div className="mt-4 flex gap-3">
                        <button onClick={() => handleRejectBooking(rental.id)} disabled={processingId === rental.id} className="flex-1 py-3 rounded-xl border-2 border-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50">Decline</button>
                        <button onClick={() => handleAcceptBooking(rental.id)} disabled={processingId === rental.id} className="flex-[2] py-3 rounded-xl bg-green-600 text-white text-sm font-black shadow-lg hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                          {processingId === rental.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><i className="ph ph-check-circle text-lg"></i>Confirm Booking</>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}</div>)}
          </div>
        )}

        {activeTab === 'favourites' && (
          <div>
            {loadingFavorites ? (<div className="flex justify-center py-12"><div className="w-8 h-8 rounded-full border-4 border-green-600 border-t-transparent animate-spin"></div></div>)
              : favoriteEquipment.length === 0 ? (<div className="text-center py-12"><i className="ph-bold ph-heart text-3xl text-gray-300 mb-2 block"></i><p className="text-gray-500 text-sm">No favourites yet</p><p className="text-gray-400 text-xs mt-1">Tap the heart icon on any equipment to save it</p></div>)
              : (<div className="space-y-4">{favoriteEquipment.map(equipment => (
                <div key={equipment.id} className="bg-white border rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition" onClick={() => router.push(`/machinery-details?id=${equipment.id}`)}>
                  <div className="flex gap-3">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 relative">
                      {equipment.image_url ? <img src={equipment.image_url} alt={equipment.name} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <div className="absolute inset-0 flex items-center justify-center"><i className="ph-bold ph-tractor text-2xl text-gray-300"></i></div>}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{equipment.name}</h3>
                      <p className="text-xs text-gray-600">{equipment.model}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{equipment.location}</p>
                      <p className="font-bold text-green-600 mt-1">₹{equipment.daily_rate}/day</p>
                    </div>
                  </div>
                </div>
              ))}</div>)}
          </div>
        )}

        {activeTab === 'reels' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">My Reels</h3>
              <button onClick={() => router.push('/my-reels')} className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition active:scale-95">Create New Reel</button>
            </div>
            {loadingReels ? (<div className="flex justify-center py-12"><div className="w-10 h-10 rounded-full border-4 border-green-600 border-t-transparent animate-spin"></div></div>)
              : myReels.length === 0 ? (<div className="text-center py-12"><p className="text-gray-500 text-sm mb-3">No reels yet</p><button onClick={() => router.push('/my-reels')} className="text-green-600 text-sm font-semibold hover:underline">Create your first reel</button></div>)
              : (<div className="grid grid-cols-3 gap-2">{myReels.map(reel => (
                <div key={reel.id} className="relative aspect-[9/16] bg-gray-200 rounded-lg overflow-hidden cursor-pointer" onClick={() => router.push(`/reels?reelId=${reel.id}`)}>
                  <video src={reel.video_url} className="w-full h-full object-cover" muted playsInline />
                  <div className="absolute inset-0 bg-black/10"></div>
                </div>
              ))}</div>)}
          </div>
        )}
      </div>

      {/* ── Crop Detail Bottom-sheet ── */}
      {selectedCrop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setSelectedCrop(null)}>
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5"></div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl flex-shrink-0">🌾</div>
              <div>
                <h3 className="text-xl font-black text-gray-900">{selectedCrop.crop_name}</h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${selectedCrop.crop_type === 'grow' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {selectedCrop.crop_type === 'grow' ? '🌱 Growing' : '🛒 Want to Buy'}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {selectedCrop.expertise_level && (
                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100/50">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center"><i className="ph-fill ph-chart-bar text-orange-600 text-sm"></i></div><span className="text-sm font-bold text-gray-500">Expertise Level</span></div>
                  <span className="text-sm font-black text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">{selectedCrop.expertise_level}</span>
                </div>
              )}
              {selectedCrop.years_of_experience ? (
                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100/50">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><i className="ph-fill ph-briefcase text-blue-600 text-sm"></i></div><span className="text-sm font-bold text-gray-500">Experience</span></div>
                  <span className="text-sm font-black text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">{selectedCrop.years_of_experience} years</span>
                </div>
              ) : null}
              {selectedCrop.expected_yield_date && (
                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100/50">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><i className="ph-fill ph-calendar-check text-green-600 text-sm"></i></div><span className="text-sm font-bold text-gray-500">{selectedCrop.crop_type === 'grow' ? 'Expected Yield' : 'Wanted By'}</span></div>
                  <span className="text-sm font-black text-green-700 bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">{new Date(selectedCrop.expected_yield_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              )}
              {selectedCrop.expected_yield_quantity && (
                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100/50">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center"><i className="ph-fill ph-scales text-purple-600 text-sm"></i></div><span className="text-sm font-bold text-gray-500">Total Quantity</span></div>
                  <span className="text-sm font-black text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">{selectedCrop.expected_yield_quantity} {selectedCrop.expected_yield_quantity_uom}</span>
                </div>
              )}
              {/* ── NEW: Grade row ── */}
              {selectedCrop.grade && (
                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100/50">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center"><i className="ph-fill ph-medal text-yellow-600 text-sm"></i></div><span className="text-sm font-bold text-gray-500">Grade</span></div>
                  <span className="text-sm font-black text-yellow-700 bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">{selectedCrop.grade}</span>
                </div>
              )}
              {selectedCrop.is_crop_waste && (
                <div className="flex items-center justify-between p-3.5 bg-orange-50/50 rounded-2xl border border-orange-100">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center"><i className="ph-fill ph-recycle text-orange-600 text-sm"></i></div><span className="text-sm font-bold text-orange-700/70">Category</span></div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 bg-white px-2 py-1 rounded-md border border-orange-100">Agricultural Waste</span>
                </div>
              )}
              {/* ── NEW: Certificate row ── */}
              {selectedCrop.certificate_url && (
                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100/50">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center"><i className={`ph-fill ${selectedCrop.certificate_url.endsWith('.pdf') ? 'ph-file-pdf' : 'ph-file-image'} text-indigo-600 text-sm`}></i></div><span className="text-sm font-bold text-gray-500">Certificate</span></div>
                  <a href={selectedCrop.certificate_url} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-indigo-600 bg-white px-3 py-1 rounded-lg border border-indigo-100 shadow-sm hover:bg-indigo-50 transition">View ↗</a>
                </div>
              )}
              {selectedCrop.certification_type && (() => {
     const cert = CERTIFICATION_TYPES.find(c => c.value === selectedCrop.certification_type);
     return cert ? (
      <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100/50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-sm">{cert.icon}</div>
        <span className="text-sm font-bold text-gray-500">Certification</span>
      </div>
      <span className="text-sm font-black text-green-700 bg-white px-3 py-1 rounded-lg border border-green-100 shadow-sm">
        {cert.icon} {cert.label}
      </span>
     </div>
      ) : null;
      })()}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setSelectedCrop(null); handleEditCropClick(selectedCrop); }} className="flex-1 py-3 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm hover:bg-blue-100 transition">✏️ Edit</button>
              <button onClick={() => { handleDeleteCrop(selectedCrop.id); setSelectedCrop(null); }} className="flex-1 py-3 bg-red-50 text-red-700 rounded-xl font-bold text-sm hover:bg-red-100 transition">🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Crop Modal ── */}
      {showAddCropForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl overflow-hidden shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-white">Add New Crop</h3>
              <button onClick={() => { setShowAddCropForm(false); setNewCrop({ crop_name: '', years_of_experience: '', expertise_level: 'Beginner', expected_yield_date: '', expected_yield_quantity: '', expected_yield_quantity_uom: 'kg', is_crop_waste: false, certificate_url: '', grade: '', certification_type: null }); setCropSuggestions([]); setShowSuggestions(false); }} className="p-1 hover:bg-white/20 rounded-lg transition">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Crop name */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Crop Name *</label>
                <input type="text" placeholder="e.g., Wheat, Rice, Corn..." value={newCrop.crop_name} onChange={e => handleCropNameChange(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                {showSuggestions && cropSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {cropSuggestions.map(crop => <button key={crop} onClick={() => handleSelectSuggestion(crop)} className="w-full text-left px-4 py-2 hover:bg-green-50 transition text-sm">{crop}</button>)}
                  </div>
                )}
              </div>
              {/* Farmer-only */}
              {(userRole === 'farmer' || userRole === 'fpo') && (<>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Years of Experience</label>
                  <input type="number" inputMode="numeric" value={newCrop.years_of_experience} onChange={e => { const val = e.target.value.replace(/[^0-9]/g, ''); const num = parseInt(val); if (val === '' || (num >= 0 && num <= 80)) setNewCrop(p => ({ ...p, years_of_experience: val })); }} onKeyDown={e => ['-', '+', 'e', 'E', '.'].includes(e.key) && e.preventDefault()} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Expertise Level</label>
                  <select value={newCrop.expertise_level} onChange={e => setNewCrop(p => ({ ...p, expertise_level: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="Beginner">Beginner</option><option value="Intermediate">Intermediate</option><option value="Expert">Expert</option>
                  </select>
                </div>
              </>)}
              {/* Buyer-only */}
              {userRole === 'buyer' && (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <input type="checkbox" id="is_crop_waste_add" checked={newCrop.is_crop_waste} onChange={e => setNewCrop(p => ({ ...p, is_crop_waste: e.target.checked }))} className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500" />
                  <label htmlFor="is_crop_waste_add" className="text-sm font-semibold text-gray-900 cursor-pointer">🌾 This is agricultural waste</label>
                </div>
              )}
              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">{userRole === 'farmer' || userRole === 'fpo' ? 'Expected Yield Date' : 'Want to Buy By'}</label>
                <input type="date" min={localDate} value={newCrop.expected_yield_date} onChange={e => setNewCrop(p => ({ ...p, expected_yield_date: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              {/* Quantity + unit */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">{userRole === 'farmer' || userRole === 'fpo' ? 'Expected Quantity' : 'Quantity Needed'}</label>
                  <input type="number" min="1" step="0.1" value={newCrop.expected_yield_quantity} onChange={e => { const val = e.target.value; if (val === '' || parseFloat(val) >= 0) setNewCrop(p => ({ ...p, expected_yield_quantity: val })); }} onKeyDown={e => ['-', '+', 'e', 'E'].includes(e.key) && e.preventDefault()} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Unit</label>
                  <select value={newCrop.expected_yield_quantity_uom} onChange={e => setNewCrop(p => ({ ...p, expected_yield_quantity_uom: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="kg">kg</option><option value="tons">tons</option><option value="quintals">quintals</option><option value="bags">bags</option>
                  </select>
                </div>
              </div>
              {/* ── NEW: Grade ── */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Grade</label>
                <select value={newCrop.grade} onChange={e => setNewCrop(p => ({ ...p, grade: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Select grade…</option>
                  {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
     <label className="block text-sm font-semibold text-gray-900 mb-2">
      Certification Type <span className="text-gray-400 font-normal text-xs">(optional)</span>
     </label>
     <div className="flex flex-wrap gap-2">
      {CERTIFICATION_TYPES.map(cert => (
        <button
          key={cert.value}
          type="button"
          onClick={() => setNewCrop(p => ({
            ...p,
            certification_type: p.certification_type === cert.value ? '' : cert.value
          }))}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition active:scale-95
            ${newCrop.certification_type === cert.value
              ? 'bg-green-600 border-green-600 text-white shadow-md'
              : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'}`}
        >
          <span>{cert.icon}</span>{cert.label}
        </button>
      ))}
     </div>
     </div>
              {/* ── NEW: Certificate ── */}
              {userRole === 'farmer' || userRole === 'fpo'  && (
              <CertificateUploader value={newCrop.certificate_url} onChange={url => setNewCrop(p => ({ ...p, certificate_url: url }))} accentColor="green" />
              )}
              {/* Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3">
              <button
                onClick={() => {
                  setShowAddCropForm(false);
                  setNewCrop({ crop_name: '', years_of_experience: '', expertise_level: 'Beginner', expected_yield_date: '', expected_yield_quantity: '', expected_yield_quantity_uom: 'kg', is_crop_waste: false, certificate_url: '', grade: '', certification_type: null });
                  setCropSuggestions([]); setShowSuggestions(false);
                }}
                className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCrop}
                disabled={addingCrop}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
              >
                {addingCrop
                  ? (<><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div><span>Adding...</span></>)
                  : (<><i className="ph-bold ph-plus text-sm"></i><span>Add Crop</span></>)}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Crop Modal ── */}
      {editingCrop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-blue-50">
            <div className="sticky top-0 bg-white px-6 py-5 flex items-center justify-between z-10 border-b border-gray-100/60">
              <div>
                <h3 className="text-xl font-black text-gray-900 leading-none mb-1">Edit Crop Details</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Update your agricultural profile</p>
              </div>
              <button onClick={() => { setEditingCrop(null); setEditCropForm({ crop_name: '', years_of_experience: '', expertise_level: 'Beginner', expected_yield_date: '', expected_yield_quantity: '', expected_yield_quantity_uom: 'kg', is_crop_waste: false, certificate_url: '', grade: '', certification_type: null }); setEditCropSuggestions([]); setShowEditCropSuggestions(false); }} className="p-2 hover:bg-gray-100 rounded-xl transition">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Crop name */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Crop Name *</label>
                <input type="text" placeholder="e.g., Wheat, Rice, Corn..." value={editCropForm.crop_name} onChange={e => handleEditCropNameChange(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {showEditCropSuggestions && editCropSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {editCropSuggestions.map(crop => <button key={crop} onClick={() => handleSelectEditCropSuggestion(crop)} className="w-full text-left px-4 py-2 hover:bg-blue-50 transition text-sm">{crop}</button>)}
                  </div>
                )}
              </div>
              {/* Farmer-only */}
              {(userRole === 'farmer' || userRole === 'fpo') && (<>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Years of Experience</label>
                  <input type="number" inputMode="numeric" value={editCropForm.years_of_experience} onChange={e => { const val = e.target.value.replace(/[^0-9]/g, ''); const num = parseInt(val); if (val === '' || (num >= 0 && num <= 80)) setEditCropForm(p => ({ ...p, years_of_experience: val })); }} onKeyDown={e => ['-', '+', 'e', 'E', '.'].includes(e.key) && e.preventDefault()} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Expertise Level</label>
                  <select value={editCropForm.expertise_level} onChange={e => setEditCropForm(p => ({ ...p, expertise_level: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="Beginner">Beginner</option><option value="Intermediate">Intermediate</option><option value="Expert">Expert</option>
                  </select>
                </div>
              </>)}
              {/* Buyer-only */}
              {userRole === 'buyer' && (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <input type="checkbox" id="edit_is_crop_waste" checked={editCropForm.is_crop_waste} onChange={e => setEditCropForm(p => ({ ...p, is_crop_waste: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" />
                  <label htmlFor="edit_is_crop_waste" className="text-sm font-semibold text-gray-900 cursor-pointer">🌾 This is agricultural waste</label>
                </div>
              )}
              {/* Date — ✅ FIXED: bound to editCropForm, not newCrop */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">{userRole === 'farmer' || userRole === 'fpo' ? 'Expected Yield Date' : 'Want to Buy By'}</label>
                <input type="date" min={localDate} value={editCropForm.expected_yield_date} onChange={e => setEditCropForm(p => ({ ...p, expected_yield_date: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {/* Quantity + unit */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">{userRole === 'farmer' || userRole === 'fpo' ? 'Expected Quantity' : 'Quantity Needed'}</label>
                  <input type="number" inputMode="decimal" value={editCropForm.expected_yield_quantity} onChange={e => { const val = e.target.value.replace(/[^0-9.]/g, ''); const parts = val.split('.'); const clean = parts[0] + (parts.length > 1 ? '.' + parts[1] : ''); if (clean === '' || (parseFloat(clean) > 0 && parseFloat(clean) <= 1000000)) setEditCropForm(p => ({ ...p, expected_yield_quantity: clean })); }} onKeyDown={e => ['-', '+', 'e', 'E'].includes(e.key) && e.preventDefault()} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Unit</label>
                  <select value={editCropForm.expected_yield_quantity_uom} onChange={e => setEditCropForm(p => ({ ...p, expected_yield_quantity_uom: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="kg">kg</option><option value="tons">tons</option><option value="quintals">quintals</option><option value="bags">bags</option>
                  </select>
                </div>
              </div>
              {/* ── NEW: Grade ── */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Grade <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <select value={editCropForm.grade} onChange={e => setEditCropForm(p => ({ ...p, grade: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select grade…</option>
                  {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              {/* ── Certification Type — farmer only ── */}
     {(userRole === 'farmer' || userRole === 'fpo') && (
     <div>
     <label className="block text-sm font-semibold text-gray-900 mb-2">
      Certification Type <span className="text-gray-400 font-normal text-xs">(optional)</span>
     </label>
     <div className="flex flex-wrap gap-2">
      {CERTIFICATION_TYPES.map(cert => (
        <button
          key={cert.value}
          type="button"
          onClick={() => setEditCropForm(p => ({
            ...p,
            certification_type: p.certification_type === cert.value ? null : cert.value
          }))}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition active:scale-95
            ${editCropForm.certification_type === cert.value
              ? 'bg-blue-600 border-blue-600 text-white shadow-md'
              : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400'}`}
        >
          <span>{cert.icon}</span>{cert.label}
        </button>
      ))}
          </div>
          {editCropForm.certification_type && (
            <button
              type="button"
              onClick={() => setEditCropForm(p => ({ ...p, certification_type: null }))}
              className="mt-2 text-xs text-red-500 font-semibold hover:underline flex items-center gap-1"
            >
              <i className="ph-bold ph-x-circle text-sm"></i> Clear certification
            </button>
          )}
        </div>
      )}
              {/* ── NEW: Certificate ── */}
              {userRole === 'farmer' || userRole === 'fpo' ? (
                <CertificateUploader value={editCropForm.certificate_url} onChange={url => setEditCropForm(p => ({ ...p, certificate_url: url }))} accentColor="blue" />
              ) : null}
              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button onClick={() => { setEditingCrop(null); setEditCropForm({ crop_name: '', years_of_experience: '', expertise_level: 'Beginner', expected_yield_date: '', expected_yield_quantity: '', expected_yield_quantity_uom: 'kg', is_crop_waste: false, certificate_url: '', grade: '',certification_type: null }); setEditCropSuggestions([]); setShowEditCropSuggestions(false); }} className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition">Cancel</button>
                <button onClick={handleSaveEditCrop} disabled={savingCrop} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {savingCrop ? (<><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div><span>Saving...</span></>) : (<><i className="ph-bold ph-check text-sm"></i><span>Save Changes</span></>)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Profile Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl overflow-hidden shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white">Edit Profile</h3>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold text-gray-900 mb-2">Name</label><input type="text" value={editForm.name} onChange={e => { if (/^[A-Za-z\s]*$/.test(e.target.value)) setEditForm(p => ({ ...p, name: e.target.value })); }} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
              <div><label className="block text-sm font-semibold text-gray-900 mb-2">Email</label><input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
              <div><label className="block text-sm font-semibold text-gray-900 mb-2">Phone</label><input type="tel" maxLength={10} value={editForm.phone} onChange={e => { if (/^\d*$/.test(e.target.value)) setEditForm(p => ({ ...p, phone: e.target.value })); }} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Location</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    {profileLocationSearching && <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin z-10"></div>}
                    <input type="text" placeholder="Type city or address..." value={editForm.location} onChange={e => { const val = e.target.value; setEditForm(p => ({ ...p, location: val })); setProfileLocationSuggestions([]); if (profileLocationTimeout.current) clearTimeout(profileLocationTimeout.current); if (val.trim().length < 3) return; profileLocationTimeout.current = setTimeout(async () => { setProfileLocationSearching(true); try { const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&addressdetails=1&limit=5&countrycodes=in`, { headers: { 'Accept-Language': 'en' } }); const data = await res.json(); setProfileLocationSuggestions(Array.isArray(data) ? data : []); } catch { setProfileLocationSuggestions([]); } finally { setProfileLocationSearching(false); } }, 400); }} autoComplete="off" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm" />
                    {profileLocationSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                        {profileLocationSuggestions.map((item, i) => { const addr = item.address || {}; const parts = [addr.village || addr.suburb || addr.town || addr.city_district || addr.city, addr.state_district || addr.county, addr.state].filter(Boolean); const label = parts.length > 0 ? parts.join(', ') : item.display_name; return (<button key={i} type="button" onMouseDown={() => { setEditForm(f => ({ ...f, location: label, latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) })); setProfileLocationSuggestions([]); }} onTouchEnd={() => { setEditForm(f => ({ ...f, location: label, latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) })); setProfileLocationSuggestions([]); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2 border-b border-gray-50 last:border-0"><i className="ph ph-map-pin text-green-600 flex-shrink-0"></i><span className="truncate">{label}</span></button>); })}
                      </div>
                    )}
                  </div>
                  <button type="button" disabled={profileDetectingLocation} onClick={async () => { setProfileDetectingLocation(true); try { let latitude: number; let longitude: number; if (Capacitor.isNativePlatform()) { const { Geolocation } = await import('@capacitor/geolocation'); const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 }); latitude = pos.coords.latitude; longitude = pos.coords.longitude; } else { const pos = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })); latitude = pos.coords.latitude; longitude = pos.coords.longitude; } try { const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, { headers: { 'Accept-Language': 'en' } }); const data = await res.json(); const addr = data.address || {}; const parts = [addr.village || addr.suburb || addr.town || addr.city_district || addr.city, addr.state_district || addr.county, addr.state].filter(Boolean); setEditForm(f => ({ ...f, location: parts.join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, latitude, longitude })); } catch { setEditForm(f => ({ ...f, location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, latitude, longitude })); } } catch (err) { alert('Could not detect location. Please allow location permission and try again.'); } finally { setProfileDetectingLocation(false); } }} className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 transition whitespace-nowrap flex items-center gap-1.5 disabled:opacity-50">
                    {profileDetectingLocation ? <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div> : <i className="ph-bold ph-navigation-arrow text-green-600"></i>}
                    {profileDetectingLocation ? 'Detecting...' : 'Detect'}
                  </button>
                </div>
              </div>
              <div><label className="block text-sm font-semibold text-gray-900 mb-2">Gender</label><select value={editForm.gender} onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"><option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
              <div><label className="block text-sm font-semibold text-gray-900 mb-2">Age</label><input type="number" inputMode="numeric" value={editForm.age} onChange={e => { const val = e.target.value.replace(/[^0-9]/g, ''); const num = parseInt(val); if (val === '' || (num >= 1 && num <= 120)) setEditForm(p => ({ ...p, age: val })); }} onKeyDown={e => ['-', '+', 'e', 'E', '.'].includes(e.key) && e.preventDefault()} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition">Cancel</button>
                <button onClick={handleUpdateProfile} disabled={isUpdatingProfile} className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">{isUpdatingProfile ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Image Modal */}
      {showProfileImageModal && user?.image && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowProfileImageModal(false)}>
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="relative bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Your Profile Picture</h3>
              <button onClick={() => setShowProfileImageModal(false)} className="p-1 hover:bg-white/20 rounded-lg transition"><X className="w-5 h-5 text-white" /></button>
            </div>
            <div className="p-6 flex flex-col items-center">
              <UserAvatar image={user.image} name={user.name} size={256} className="rounded-lg mb-6" style={{ border: '4px solid #dcfce7', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
              <button onClick={handleProfilePhotoClick} disabled={isUploadingPhoto} className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                <i className="ph-bold ph-pencil text-sm"></i><span>Change Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {showImagePreview && previewImage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl overflow-hidden shadow-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4"><h3 className="text-lg font-bold text-white">Preview Profile Image</h3></div>
            <div className="p-6">
              <div className="mb-6 flex justify-center"><img src={previewImage} alt="Preview" className="w-48 h-48 rounded-full object-cover border-4 border-green-100" /></div>
              <div className="text-center mb-6"><p className="text-sm text-gray-600 mb-2">This will be your new profile image</p><p className="text-xs text-gray-500">Does this look good?</p></div>
              <div className="flex gap-3">
                <button onClick={() => { setShowImagePreview(false); setPreviewImage(null); }} className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition active:scale-95"><i className="ph-bold ph-arrow-left text-sm mr-2"></i>Back</button>
                <button onClick={() => { setShowImagePreview(false); if (previewImage) uploadProfilePhoto(previewImage); }} disabled={isUploadingPhoto} className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isUploadingPhoto ? (<><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div><span>Uploading...</span></>) : (<><i className="ph-bold ph-check-circle text-sm"></i><span>Confirm & Upload</span></>)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {uploadError && <div className="fixed bottom-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">{uploadError}</div>}

      {/* Reel Viewer */}
      {selectedReel && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <button onClick={() => setSelectedReel(null)} className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full transition"><X className="w-6 h-6 text-white" /></button>
          <div className="relative w-full max-w-md h-full bg-black">
            <video ref={el => { if (el) videoRefsMap.current[selectedReel.id] = el; }} src={selectedReel.video_url} className="w-full h-full object-contain" autoPlay loop playsInline muted={isMuted} onClick={e => { const v = e.currentTarget; v.paused ? v.play() : v.pause(); }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none"></div>
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <UserAvatar image={user?.image} name={user?.name} size={40} style={{ border: '2px solid white' }} />
              <p className="text-white font-semibold text-sm">{user?.name}</p>
            </div>
            <div className="absolute right-3 bottom-20 flex flex-col gap-6 text-white">
              <div className="flex flex-col items-center gap-1"><i className="ph-bold ph-eye text-2xl drop-shadow-lg"></i><span className="text-xs font-bold drop-shadow">{selectedReel.views || 0}</span></div>
              <div className="flex flex-col items-center gap-1"><Heart className="w-7 h-7 drop-shadow-lg" fill="currentColor" stroke="currentColor" strokeWidth={1.5} /><span className="text-xs font-bold drop-shadow">{selectedReel.likes || 0}</span></div>
              <div className="flex flex-col items-center gap-1"><MessageCircle className="w-7 h-7 drop-shadow-lg" strokeWidth={1.5} /><span className="text-xs font-bold drop-shadow">{selectedReel.comments || 0}</span></div>
              <button onClick={() => { if (navigator.share) navigator.share({ title: 'Check out this reel', text: selectedReel.caption, url: window.location.href }); }} className="flex flex-col items-center gap-1 hover:scale-110 active:scale-95 transition-transform"><Send className="w-7 h-7 drop-shadow-lg" strokeWidth={1.5} /><span className="text-xs font-bold drop-shadow">Share</span></button>
            </div>
            <button onClick={() => setIsMuted(!isMuted)} className="absolute bottom-24 left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition"><i className={`ph-bold ${isMuted ? 'ph-speaker-simple-slash' : 'ph-speaker-simple-high'} text-white text-xl`}></i></button>
            <button onClick={() => handleDeleteReel(selectedReel.id)} disabled={deletingReelId === selectedReel.id} className="absolute bottom-24 left-20 p-3 bg-red-600/80 hover:bg-red-600 rounded-full transition disabled:opacity-50">
              {deletingReelId === selectedReel.id ? <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"></div> : <Trash2 className="w-5 h-5 text-white" />}
            </button>
            {selectedReel.caption && <div className="absolute bottom-4 left-4 right-20 bg-black/50 backdrop-blur-sm p-3 rounded-lg"><p className="text-white text-sm">{selectedReel.caption}</p></div>}
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      {/* ── Follow Requests Notification Bell ── */}
{pendingFollowRequests.length > 0 && (
  <button
    onClick={() => setShowFollowRequests(true)}
    className="fixed top-16 right-4 z-50 w-12 h-12 bg-green-600 rounded-full flex items-center justify-center shadow-lg"
  >
    <i className="ph-fill ph-user-plus text-white text-xl"></i>
    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-black flex items-center justify-center">
      {pendingFollowRequests.length}
    </span>
  </button>
)}

{/* ── Follow Requests Modal ── */}
{showFollowRequests && (
  <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
    <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h3 className="text-lg font-black text-gray-900">Follow Requests</h3>
        <button onClick={() => setShowFollowRequests(false)} className="p-1 hover:bg-gray-100 rounded-full">
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
        {pendingFollowRequests.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">No pending requests</p>
        ) : (
          pendingFollowRequests.map((req) => (
            <div key={req.user_id} className="flex items-center gap-3 px-5 py-4">
              <img
                src={req.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(req.name)}`}
                alt={req.name}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0 cursor-pointer"
                onClick={() => { setShowFollowRequests(false); router.push(`/farmer-profile?id=${req.user_id}`); }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate">{req.name}</p>
                {req.location && <p className="text-xs text-gray-400 truncate">{req.location}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(req.created_at).toLocaleDateString('en-IN')}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleFollowAction(req.user_id, 'rejected')}
                  disabled={processingFollow === req.user_id}
                  className="px-3 py-1.5 rounded-xl border-2 border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Decline
                </button>
                <button
                  onClick={() => handleFollowAction(req.user_id, 'accepted')}
                  disabled={processingFollow === req.user_id}
                  className="px-3 py-1.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {processingFollow === req.user_id
                    ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : 'Accept'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="w-full min-h-[100dvh] bg-gray-50 flex items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 rounded-full border-4 border-green-600 border-t-transparent animate-spin"></div><p className="text-gray-600 text-sm font-medium">Loading...</p></div></div>}>
      <ProfileContent />
    </Suspense>
  );
}