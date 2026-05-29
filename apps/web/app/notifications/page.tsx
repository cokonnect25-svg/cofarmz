'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';
import { ArrowLeft, Bell, UserPlus, MessageCircle, Package, Megaphone, Video } from 'lucide-react';

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
}

interface FollowRequest {
  user_id: string;
  name: string;
  image: string;
  location?: string;
  created_at: string;
}

const NOTIF_READ_KEY = 'cofarmz_notif_read_at';

function NotificationsContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [processingFollow, setProcessingFollow] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

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

      // Mark as read
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

  // ── FIX: handle admin_reel navigation — extract reel id from link and navigate
  const handleNotifClick = (notif: Notification) => {
    if (!notif.link) return;

    if (notif.type === 'admin_reel') {
      // link is like /reels?id=reel_xxx — navigate directly, reels page reads ?id param
      router.push(notif.link);
      return;
    }

    router.push(notif.link);
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'follow_request':  return <UserPlus className="w-5 h-5 text-green-600" />;
      case 'message':         return <MessageCircle className="w-5 h-5 text-blue-600" />;
      case 'booking_new':
      case 'booking_update':  return <Package className="w-5 h-5 text-amber-600" />;
      case 'announcement':    return <Megaphone className="w-5 h-5 text-purple-600" />;
      case 'admin_reel':      return <Video className="w-5 h-5 text-pink-600" />;   // ← FIX
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
      case 'admin_reel':      return 'bg-pink-50';   // ← FIX
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

        {/* ── Follow Requests Section ── */}
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
                  {/* Icon or avatar */}
                  <div className="flex-shrink-0">
                    {/* ── FIX: for admin_reel, show thumbnail if available, else icon ── */}
                    {notif.type === 'admin_reel' && notif.image ? (
                      <div className="relative">
                        <img
                          src={notif.image}
                          alt=""
                          className="w-11 h-11 rounded-xl object-cover"
                        />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-50 flex items-center justify-center border-2 border-white">
                          <Video className="w-3 h-3 text-pink-600" />
                        </div>
                      </div>
                    ) : notif.image ? (
                      <div className="relative">
                        <img
                          src={notif.image}
                          alt=""
                          className="w-11 h-11 rounded-full object-cover"
                        />
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
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(notif.time).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Status badge for bookings */}
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

                  {/* ── FIX: "Watch" pill for admin reel notifications ── */}
                  {notif.type === 'admin_reel' && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 bg-pink-100 text-pink-600">
                      Watch
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