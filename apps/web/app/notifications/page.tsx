'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';
import {
  ArrowLeft, Bell, UserPlus, MessageCircle,
  Package, Megaphone, Video, ChevronDown, ChevronUp, X, Sprout, Heart
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  image: string | null;
  time: string;
  link: string;
  followerId?: string;
  status?: string;
  matchedCrops?: string[];
  targetSearchType?: 'farmers' | 'buyers';
}

interface FollowRequest {
  user_id: string;
  name: string;
  image: string;
  location?: string;
  created_at: string;
}

const NOTIF_READ_KEY = 'cofarmz_notif_read_at';

// ── Announcement expand modal (inline, no navigation) ──────────────────────
function AnnouncementModal({
  notif,
  onClose,
}: {
  notif: Notification;
  onClose: () => void;
}) {
  return (
    // backdrop — tap outside to close
<div
  className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4"
  style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}
  onClick={onClose}
>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Purple header stripe */}
        <div className="bg-purple-600 px-5 pt-5 pb-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-purple-200 uppercase tracking-wider mb-0.5">
              Announcement
            </p>
            <h2 className="text-white font-black text-base leading-snug">
              {notif.title}
            </h2>
            <p className="text-purple-200 text-xs mt-1">
              {new Date(notif.time).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full bg-purple-500 hover:bg-purple-400 transition flex-shrink-0"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Optional image */}
        {notif.image && (
          <img
            src={notif.image}
            alt=""
            className="w-full max-h-48 object-cover"
          />
        )}

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
            {notif.body}
          </p>
        </div>

        {/* Close button */}
        <div className="px-5 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 active:scale-95 transition-transform"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationsContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [processingFollow, setProcessingFollow] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  // ── NEW: which announcement is expanded ──
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<Notification | null>(null);

  // Native/web push links include the announcement id. Open that announcement
  // as soon as its notification data has loaded.
  useEffect(() => {
    const announcementId = searchParams.get('announcement');
    if (!announcementId || notifications.length === 0) return;
    const announcement = notifications.find(
      (item) => item.type === 'announcement' && item.id === `ann-${announcementId}`
    );
    if (announcement) setExpandedAnnouncement(announcement);
  }, [notifications, searchParams]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading]);

  useEffect(() => {
    if (!user?.id) return;
    fetchAll();
  }, [user?.id]);

  const fetchAll = async () => {
    if (!user?.id) return;
    setLoadingData(true);
    try {
      const lastRead = localStorage.getItem(NOTIF_READ_KEY);
      const since = lastRead || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [notifRes, followRes] = await Promise.all([
        fetch(getApiUrl(`/api/notifications?userId=${user.id}&since=${since}`)),
        fetch(getApiUrl(`/api/follows?user_id=${user.id}&type=pending_requests`)),
      ]);

      if (notifRes.ok) {
        const data = await notifRes.json();
        const notifs: Notification[] = data.notifications || [];
        setNotifications(notifs);
        const lastReadTime = lastRead ? new Date(lastRead).getTime() : 0;
        const unread = notifs.filter(n => new Date(n.time).getTime() > lastReadTime).length;
        setUnreadCount(unread);
      }

      if (followRes.ok) {
        const requests = await followRes.json();
        setFollowRequests(Array.isArray(requests) ? requests : []);
      }

      localStorage.setItem(NOTIF_READ_KEY, new Date().toISOString());
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  const handleFollowAction = async (followerId: string, action: 'accepted' | 'rejected') => {
    if (!user?.id) return;
    setProcessingFollow(followerId);
    try {
      const res = await fetch(getApiUrl('/api/follows'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ followerId, action }),
      });
      if (res.ok) {
        setFollowRequests(prev => prev.filter(r => r.user_id !== followerId));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingFollow(null);
    }
  };

  // ── UPDATED: announcements expand inline; everything else navigates ──
  const handleNotifClick = (notif: Notification) => {
    if (notif.type === 'announcement') {
      setExpandedAnnouncement(notif);
      return;
    }
    if (!notif.link) return;
    router.push(notif.link);
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'follow_request':  return <UserPlus className="w-5 h-5 text-green-600" />;
      case 'message':         return <MessageCircle className="w-5 h-5 text-blue-600" />;
      case 'booking_new':
      case 'booking_update':  return <Package className="w-5 h-5 text-amber-600" />;
      case 'announcement':    return <Megaphone className="w-5 h-5 text-purple-600" />;
      case 'admin_reel':      return <Video className="w-5 h-5 text-pink-600" />;
      case 'reel_like':
      case 'post_like':       return <Heart className="w-5 h-5 text-red-600" />;
      case 'reel_comment':
      case 'reel_reply':
      case 'reel_mention':
      case 'post_comment':
      case 'post_reply':
      case 'post_mention':    return <MessageCircle className="w-5 h-5 text-green-600" />;
      case 'profile_match':
      case 'profile_match_setup':
      case 'profile_completion': return <Sprout className="w-5 h-5 text-emerald-600" />;
      default:                return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotifBg = (type: string) => {
    switch (type) {
      case 'follow_request':  return 'bg-green-50';
      case 'message':         return 'bg-blue-50';
      case 'booking_new':
      case 'booking_update':  return 'bg-amber-50';
      case 'announcement':    return 'bg-purple-50';
      case 'admin_reel':      return 'bg-pink-50';
      case 'profile_match':
      case 'profile_match_setup':
      case 'profile_completion': return 'bg-emerald-50';
      default:                return 'bg-gray-50';
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[100dvh]">
      <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-gray-50">

      {/* ── Announcement modal (rendered at root so it overlays everything) ── */}
      {expandedAnnouncement && (
        <AnnouncementModal
          notif={expandedAnnouncement}
          onClose={() => setExpandedAnnouncement(null)}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-3 z-40 shadow-sm">
        <button onClick={() => router.back()} className="p-1 rounded-full hover:bg-gray-100 transition">
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-green-600 font-semibold">{unreadCount} new</p>
          )}
        </div>
        <Bell className="w-5 h-5 text-gray-400" />
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* ── Follow Requests ── */}
        {followRequests.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50 bg-green-50">
              <UserPlus className="w-4 h-4 text-green-600" />
              <h2 className="text-sm font-black text-green-700 uppercase tracking-wider">
                Follow Requests ({followRequests.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {followRequests.map((req) => (
                <div key={req.user_id} className="flex items-center gap-3 px-4 py-4">
                  <img
                    src={req.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(req.name)}&backgroundColor=166534&textColor=ffffff`}
                    alt={req.name}
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 cursor-pointer border-2 border-green-100"
                    onClick={() => router.push(`/farmer-profile?id=${req.user_id}`)}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-bold text-gray-900 text-sm truncate cursor-pointer hover:text-green-700 transition"
                      onClick={() => router.push(`/farmer-profile?id=${req.user_id}`)}
                    >
                      {req.name}
                    </p>
                    {req.location && (
                      <p className="text-xs text-gray-400 truncate">{req.location}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(req.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleFollowAction(req.user_id, 'rejected')}
                      disabled={processingFollow === req.user_id}
                      className="px-3 py-1.5 rounded-xl border-2 border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleFollowAction(req.user_id, 'accepted')}
                      disabled={processingFollow === req.user_id}
                      className="px-3 py-1.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50 transition flex items-center gap-1"
                    >
                      {processingFollow === req.user_id
                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : 'Accept'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── All Notifications ── */}
        {loadingData ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 && followRequests.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-semibold">No notifications yet</p>
            <p className="text-gray-400 text-sm mt-1">We'll notify you when something happens</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50 bg-gray-50">
              <Bell className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-black text-gray-500 uppercase tracking-wider">
                Recent Activity
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className="flex items-start gap-3 px-4 py-4 hover:bg-gray-50 transition cursor-pointer active:bg-gray-100"
                >
                  {/* Icon / avatar */}
                  <div className="flex-shrink-0">
                    {notif.type === 'admin_reel' && notif.image ? (
                      <div className="relative">
                        <img src={notif.image} alt="" className="w-11 h-11 rounded-xl object-cover" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-50 flex items-center justify-center border-2 border-white">
                          <Video className="w-3 h-3 text-pink-600" />
                        </div>
                      </div>
                    ) : notif.image ? (
                      <div className="relative">
                        <img src={notif.image} alt="" className="w-11 h-11 rounded-full object-cover" />
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${getNotifBg(notif.type)} flex items-center justify-center border-2 border-white`}>
                          {getNotifIcon(notif.type)}
                        </div>
                      </div>
                    ) : (
                      <div className={`w-11 h-11 rounded-full ${getNotifBg(notif.type)} flex items-center justify-center`}>
                        {getNotifIcon(notif.type)}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 leading-snug">{notif.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{notif.body}</p>
                    {notif.type === 'profile_match' && notif.matchedCrops && notif.matchedCrops.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {notif.matchedCrops.slice(0, 3).map((crop) => (
                          <button
                            key={crop}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              const params = new URLSearchParams({
                                type: notif.targetSearchType || 'farmers',
                                crops: crop,
                              });
                              router.push(`/nearby-farmers?${params.toString()}`);
                            }}
                            className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-black text-emerald-700 hover:bg-emerald-100 active:scale-95 transition"
                          >
                            {crop}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(notif.time).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Badges */}
                  {notif.status && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${
                      notif.status === 'accepted'  ? 'bg-green-100 text-green-700' :
                      notif.status === 'rejected'  ? 'bg-red-100 text-red-600' :
                      notif.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {notif.status}
                    </span>
                  )}

                  {notif.type === 'admin_reel' && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 bg-pink-100 text-pink-600">
                      Watch
                    </span>
                  )}

                  {notif.type === 'profile_match' && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 bg-emerald-100 text-emerald-700">
                      Match
                    </span>
                  )}

                  {notif.type === 'profile_match_setup' && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 bg-emerald-100 text-emerald-700">
                      Add crops
                    </span>
                  )}

                  {/* ── Tap-to-read cue for announcements ── */}
                  {notif.type === 'announcement' && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 bg-purple-100 text-purple-700 flex items-center gap-0.5">
                      Read <ChevronDown className="w-3 h-3" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NotificationsContent />
    </Suspense>
  );
}
