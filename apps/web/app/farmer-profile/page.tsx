'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useCallback } from 'react';
import { ArrowLeft, MessageCircle, Phone, MapPin, Heart, MessageSquare, ChevronUp, Leaf, ShoppingCart } from 'lucide-react';
import InAppCall from '@/app/components/InAppCall';

interface FarmerProfile {
  id: string;
  name: string;
  email: string;
  image: string;
  location: string;
  role: 'farmer' | 'buyer';
  followers_count: number;
  following_count: number;
  crops_count: number;
  equipments_count: number;
  isFollowing: boolean;
  phone?: string;
}

interface Reel {
  id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  likes: number;
  comments: number;
  is_liked: boolean;
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
}

interface Equipment {
  id: string;
  name: string;
  model: string;
  daily_rate: number;
  image_url: string;
}

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
  const [expandedSection, setExpandedSection] = useState<string | null>(tabParam || null);
  const [mounted, setMounted] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');

  const fetchProfile = useCallback(async () => {
    if (!farmerId || !user) return;
    try {
      const url = `/api/farmers/profile?farmerId=${encodeURIComponent(farmerId)}`;
      console.log('Fetching farmer profile from:', url);

      const res = await fetch(url, {
        headers: {
          'x-user-id': user.id
        }
      });

      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        let errorData: any = {};

        try {
          if (contentType?.includes('application/json')) {
            errorData = await res.json();
          } else {
            const text = await res.text();
            console.error('Non-JSON response from API:', text.substring(0, 200));
            errorData = { error: `HTTP ${res.status}: ${res.statusText}` };
          }
        } catch (e) {
          console.error('Error parsing response:', e);
          errorData = { error: `HTTP ${res.status}: Failed to parse response` };
        }

        console.error('Profile API error - Status:', res.status, 'Data:', errorData);
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to fetch profile`);
      }

      const data = await res.json();
      if (!data || !data.id) {
        console.error('Invalid profile data:', data);
        throw new Error('Received invalid profile data');
      }
      setProfile(data);
      setIsFollowing(data.isFollowing || false);
      setReels(Array.isArray(data.reels) ? data.reels : []);
      setFollowers(Array.isArray(data.followers) ? data.followers : []);
      setFollowing(Array.isArray(data.following) ? data.following : []);
      setCrops(Array.isArray(data.crops) ? data.crops : []);
      setEquipment(Array.isArray(data.equipment) ? data.equipment : []);
      setDataLoaded(true);
      setError(null);
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred';
      console.error('Error fetching profile:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [farmerId, user]);

  useEffect(() => {
    if (mounted && farmerId && user) {
      fetchProfile();
    }
  }, [mounted, farmerId, user, fetchProfile]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFollow = async () => {
    if (!farmerId || !user) return;

    try {
      if (isFollowing) {
        const response = await fetch(`/api/follows`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id
          },
          body: JSON.stringify({ followingId: farmerId })
        });
        if (response.ok) {
          setIsFollowing(false);
          if (profile) {
            setProfile({ ...profile, followers_count: profile.followers_count - 1 });
          }
        } else {
          const error = await response.json();
          console.error('Unfollow error:', error);
        }
      } else {
        const response = await fetch(`/api/follows`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id
          },
          body: JSON.stringify({ followingId: farmerId })
        });
        if (response.ok) {
          setIsFollowing(true);
          if (profile) {
            setProfile({ ...profile, followers_count: profile.followers_count + 1 });
          }
        } else {
          const error = await response.json();
          console.error('Follow error:', error);
        }
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
    }
  };

  const fetchSectionData = useCallback(async (section: string) => {
    // Data is already loaded from initial fetchProfile, no need to refetch
    console.log(`Data already loaded, section ${section} ready to display`);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error || !profile || !user) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-4">
        <p className="text-gray-500">{error || 'Profile not found'}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isOwnProfile = user?.id === farmerId;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center z-40">
        <button onClick={() => router.back()} className="mr-3">
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
      </div>

      {/* Profile Section */}
      <div className="bg-white border-b">
        {/* Cover */}
        <div className="h-24 bg-gradient-to-r from-green-500 to-green-600"></div>

        {/* Profile Info */}
        <div className="px-4 pb-4">
          <div className="flex justify-between items-start -mt-12 mb-4">
            <img
              src={profile.image || 'https://via.placeholder.com/80'}
              alt={profile.name}
              className="w-20 h-20 rounded-full border-4 border-white object-cover"
            />
            {!isOwnProfile && (
              <button
                onClick={handleFollow}
                className={`${isFollowing
                    ? 'bg-gray-200 text-gray-900'
                    : 'bg-green-600 text-white'
                  } px-6 py-2 rounded-full font-semibold text-sm`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
            <div className={`px-3 py-1 rounded-full ${profile.role === 'farmer' ? 'bg-green-100' : 'bg-blue-100'}`}>
              <span className={`text-xs font-semibold flex items-center gap-1 ${profile.role === 'farmer' ? 'text-green-700' : 'text-blue-700'}`}>
                {profile.role === 'farmer' ? (
                  <>
                    <Leaf className="w-4 h-4" />
                    Farmer
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    Buyer
                  </>
                )}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-600 flex items-center gap-1">
            <MapPin className="w-4 h-4" /> {profile.location || 'Location not set'}
          </p>

          {/* Stats - Clickable */}
          <div className="grid grid-cols-4 gap-2 mt-4 text-center">
            <button
              onClick={() => {
                if (expandedSection === 'followers') {
                  setExpandedSection(null);
                } else {
                  setExpandedSection('followers');
                  fetchSectionData('followers');
                }
              }}
              className="cursor-pointer hover:bg-gray-50 p-2 rounded transition"
            >
              <p className="font-bold text-lg text-gray-900">{profile.followers_count}</p>
              <p className="text-xs text-gray-600">Followers</p>
            </button>
            <button
              onClick={() => {
                if (expandedSection === 'following') {
                  setExpandedSection(null);
                } else {
                  setExpandedSection('following');
                  fetchSectionData('following');
                }
              }}
              className="cursor-pointer hover:bg-gray-50 p-2 rounded transition"
            >
              <p className="font-bold text-lg text-gray-900">{profile.following_count}</p>
              <p className="text-xs text-gray-600">Following</p>
            </button>
            <button
              onClick={() => {
                if (expandedSection === 'crops') {
                  setExpandedSection(null);
                } else {
                  setExpandedSection('crops');
                  fetchSectionData('crops');
                }
              }}
              className="cursor-pointer hover:bg-gray-50 p-2 rounded transition"
            >
              <p className="font-bold text-lg text-gray-900">{profile.crops_count}</p>
              <p className="text-xs text-gray-600">Crops</p>
            </button>
            <button
              onClick={() => {
                if (expandedSection === 'equipment') {
                  setExpandedSection(null);
                } else {
                  setExpandedSection('equipment');
                  fetchSectionData('equipment');
                }
              }}
              className="cursor-pointer hover:bg-gray-50 p-2 rounded transition"
            >
              <p className="font-bold text-lg text-gray-900">{profile.equipments_count}</p>
              <p className="text-xs text-gray-600">Equipment</p>
            </button>
          </div>

          {/* Actions */}
          {!isOwnProfile && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => router.push(`/messages?ownerId=${profile.id}&ownerName=${encodeURIComponent(profile.name)}`)}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Message
              </button>
              <button
                onClick={() => {
                  if (profile.phone) {
                    window.location.href = `tel:${profile.phone}`;
                  } else {
                    alert('Phone number not available');
                  }
                }}
                className="flex-1 bg-gray-200 text-gray-900 py-2 rounded-lg font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                Call
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Sections */}
      <div className="bg-white border-b">
        {/* Followers Section */}
        {expandedSection === 'followers' && (
          <div className="border-t">
            <div className="px-4 py-3 border-b flex items-center justify-between cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedSection(null)}>
              <h3 className="font-bold text-gray-900">Followers ({followers.length})</h3>
              <ChevronUp className="w-5 h-5 text-gray-600" />
            </div>
            <div className="divide-y">
              {followers.length === 0 ? (
                <div className="px-4 py-4 text-center text-gray-500 text-sm">No followers yet</div>
              ) : (
                followers.map((follower) => (
                  <button
                    key={follower.id}
                    onClick={() => {
                      if (follower.id === user.id) {
                        router.push('/user-profile');
                      } else {
                        router.push(`/farmer-profile?id=${follower.id}`);
                      }
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={follower.image || 'https://via.placeholder.com/40'}
                        alt={follower.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <p className="font-semibold text-gray-900">{follower.name}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Following Section */}
        {expandedSection === 'following' && (
          <div className="border-t">
            <div className="px-4 py-3 border-b flex items-center justify-between cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedSection(null)}>
              <h3 className="font-bold text-gray-900">Following ({following.length})</h3>
              <ChevronUp className="w-5 h-5 text-gray-600" />
            </div>
            <div className="divide-y">
              {following.length === 0 ? (
                <div className="px-4 py-4 text-center text-gray-500 text-sm">Not following anyone yet</div>
              ) : (
                following.map((followUser) => (
                  <button
                    key={followUser.id}
                    onClick={() => {
                      if (followUser.id === user.id) {
                        router.push('/user-profile');
                      } else {
                        router.push(`/farmer-profile?id=${followUser.id}`);
                      }
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={followUser.image || 'https://via.placeholder.com/40'}
                        alt={followUser.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <p className="font-semibold text-gray-900">{followUser.name}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Crops Section */}
        {expandedSection === 'crops' && (
          <div className="border-t">
            <div className="px-4 py-3 border-b flex items-center justify-between cursor-pointer hover:bg-gray-50"
              onClick={() => { console.log('Closing crops section'); setExpandedSection(null); }}>
              <h3 className="font-bold text-gray-900">Crops ({crops.length})</h3>
              <ChevronUp className="w-5 h-5 text-gray-600" />
            </div>
            <div className="divide-y">
              {crops && crops.length > 0 ? (
                crops.map((crop, idx) => (
                  <div key={idx} className={`px-4 py-4 transition-colors ${profile.role === 'farmer' ? 'cursor-pointer hover:bg-green-50 active:bg-green-100' : ''}`}
                    onClick={() => profile.role === 'farmer' && router.push(`/nearby-farmers?crops=${encodeURIComponent(crop.crop_name)}`)}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-black text-green-700">🌾 {crop.crop_name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 uppercase">{crop.expertise_level}</span>
                        </div>
                        {crop.years_of_experience ? (
                          <p className="text-sm text-gray-500">Experience: {crop.years_of_experience} years</p>
                        ) : null}
                        {crop.expected_yield_date && (
                          <p className="text-xs text-blue-600 font-medium mt-1">{profile.role === 'farmer' ? 'Yield' : 'Needed by'}: {new Date(crop.expected_yield_date).toLocaleDateString()}</p>
                        )}
                        {crop.expected_yield_quantity && (
                          <p className="text-xs text-blue-600 font-medium">Qty: {crop.expected_yield_quantity} {(crop as any).expected_yield_quantity_uom || 'kg'}</p>
                        )}
                      </div>
                      {profile.role === 'farmer' && (
                        <div className="flex items-center gap-1 text-green-600 text-xs font-bold ml-3">
                          <span>View Farmers</span>
                          <i className="ph-bold ph-arrow-right text-xs"></i>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-4 text-center text-gray-500 text-sm">No crops expertise added yet</div>
              )}
            </div>
          </div>
        )}

        {/* Equipment Section */}
        {expandedSection === 'equipment' && (
          <div className="border-t">
            <div className="px-4 py-3 border-b flex items-center justify-between cursor-pointer hover:bg-gray-50"
              onClick={() => { console.log('Closing equipment section'); setExpandedSection(null); }}>
              <h3 className="font-bold text-gray-900">Equipment ({equipment.length})</h3>
              <ChevronUp className="w-5 h-5 text-gray-600" />
            </div>
            <div className="divide-y">
              {equipment && equipment.length > 0 ? (
                equipment.map((equip) => (
                  <button
                    key={equip.id}
                    onClick={() => router.push(`/machinery-details?id=${equip.id}`)}
                    className="w-full px-4 py-4 flex gap-3 hover:bg-gray-50 transition text-left"
                  >
                    <img
                      src={equip.image_url || 'https://via.placeholder.com/60'}
                      alt={equip.name}
                      className="w-16 h-16 rounded object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{equip.name}</p>
                      <p className="text-sm text-gray-600">Model: {equip.model}</p>
                      <p className="text-sm text-green-600 font-semibold mt-1">₹{equip.daily_rate}/day</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-4 text-center text-gray-500 text-sm">No equipment available yet</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reels Section */}
      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Reels</h3>
        {reels.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No reels yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {reels.map((reel) => (
              <div
                key={reel.id}
                className="relative aspect-[9/16] rounded-xl overflow-hidden bg-black cursor-pointer group active:scale-95 transition-transform"
                onClick={() => router.push(`/reels?reelId=${reel.id}&userId=${profile.id}`)}
              >
                {/* Video thumbnail */}
                <video
                  src={reel.video_url}
                  className="w-full h-full object-cover pointer-events-none"
                  preload="metadata"
                  playsInline
                  muted
                  poster={reel.thumbnail_url || undefined}
                />

                {/* Dark overlay */}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

                {/* Play icon center */}
                <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                    <i className="ph-fill ph-play text-white text-lg ml-0.5"></i>
                  </div>
                </div>

                {/* Stats bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 text-white">
                      <Heart className="w-3 h-3" />
                      <span className="text-[10px] font-bold">{reel.likes || 0}</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-white">
                      <MessageSquare className="w-3 h-3" />
                      <span className="text-[10px] font-bold">{reel.comments || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* In-App Call Modal */}
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

      <div className="h-20"></div>
    </div>
  );
}

export default function FarmerProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      }
    >
      <FarmerProfileContent />
    </Suspense>
  );
}
