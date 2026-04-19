'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useRef, useCallback } from 'react';
import { getApiUrl } from '@/lib/api';

const NOTIF_SEEN_KEY = 'cofarmz_notif_seen_at';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  image: string | null;
  time: string;
  link: string;
  status?: string;
  available?: boolean;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotifIcon({ type, status }: { type: string; status?: string }) {
  if (type === 'message') return <i className="ph-fill ph-chat-circle text-blue-500 text-lg" />;
  if (type === 'booking_new') return <i className="ph-fill ph-calendar-plus text-green-600 text-lg" />;
  if (type === 'booking_update') {
    if (status === 'accepted') return <i className="ph-fill ph-check-circle text-green-600 text-lg" />;
    if (status === 'rejected' || status === 'cancelled') return <i className="ph-fill ph-x-circle text-red-500 text-lg" />;
    return <i className="ph-fill ph-calendar text-orange-500 text-lg" />;
  }
  if (type === 'equipment') return <i className="ph-fill ph-tractor text-yellow-600 text-lg" />;
  return <i className="ph-fill ph-bell text-gray-500 text-lg" />;
}

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const isActive = (path: string) => pathname === path;

  const [selectedLang, setSelectedLang] = useState('en');
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const match = document.cookie.match(/googtrans=\/en\/([a-z]+)/);
    if (match) setSelectedLang(match[1]);
  }, []);

  // Sync profile image and listen for updates
  useEffect(() => {
    setProfileImage(user?.image || null);
  }, [user?.image]);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.image) setProfileImage(e.detail.image);
    };
    window.addEventListener('profileImageUpdated', handler);
    return () => window.removeEventListener('profileImageUpdated', handler);
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    // Default: last 24 hours (not epoch) so first-time users don't see all history
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const seenAt = localStorage.getItem(NOTIF_SEEN_KEY) || oneDayAgo;
    try {
      const res = await fetch(getApiUrl(`/api/notifications?userId=${user.id}&since=${seenAt}`));
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // silent
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close panels on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpenNotifPanel = () => {
    setShowNotifPanel((v) => !v);
    setShowPlusMenu(false);
    // Mark all as seen
    localStorage.setItem(NOTIF_SEEN_KEY, new Date().toISOString());
    setUnreadCount(0);
  };

  const handleNotifClick = (notif: Notification) => {
    setShowNotifPanel(false);
    router.push(notif.link);
  };

  const navLinks = [
    { href: '/', label: 'Home', icon: 'ph-house' },
    { href: '/about', label: 'About', icon: 'ph-info' },
    { href: '/machinery-list', label: 'Fleets', icon: 'ph-tractor' },
    { href: '/reels', label: 'Reels', icon: 'ph-video' },
    { href: '/nearby-farmers', label: 'Farmers & Buyers', icon: 'ph-users' },
    { href: '/chat', label: 'Messages', icon: 'ph-chat-circle' },
  ];

  const avatarUrl = profileImage
    || (user?.name
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=166534&textColor=ffffff`
      : `https://api.dicebear.com/7.x/initials/svg?seed=U&backgroundColor=166534&textColor=ffffff`);

  return (
    <>
      {/* ── TOP NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-[9999] bg-white shadow-sm border-b border-gray-100" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-6 h-[64px] flex items-center gap-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-green-50 border-2 border-green-200 p-0.5 flex-shrink-0">
              <img src="/assets/cofarmz-logo.png" alt="CoFarmz" className="w-full h-full rounded-full object-cover" />
            </div>
            <span className="text-[16px] font-black text-gray-900 tracking-tight">CoFarmz</span>
          </Link>

          {/* Nav Links — desktop only, centered */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150 ${isActive(link.href)
                    ? 'text-green-700 bg-green-50'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                <i className={`${isActive(link.href) ? 'ph-fill' : 'ph'} ${link.icon} text-[15px]`}></i>
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute bottom-0.5 left-3 right-3 h-0.5 bg-green-600 rounded-full" />
                )}
              </Link>
            ))}
          </div>

          {/* Right side — language + actions */}
          <div className="flex items-center gap-2.5 flex-shrink-0 ml-auto">

            {/* Translate */}
            <div className="flex items-center">
              <select
                value={selectedLang}
                onChange={(e) => {
                  const lang = e.target.value;
                  if (!lang) return;
                  setSelectedLang(lang);
                  if (lang === 'en') {
                    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
                    window.location.reload();
                  } else {
                    if (typeof (window as any).triggerTranslate === 'function') {
                      (window as any).triggerTranslate(lang);
                    }
                  }
                }}
                className="text-[12px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-green-500 hover:border-gray-300 transition"
              >
                <option value="en">🌐 English</option>
                <option value="hi">हिंदी</option>
                <option value="te">తెలుగు</option>
                <option value="ta">தமிழ்</option>
                <option value="kn">ಕನ್ನಡ</option>
                <option value="mr">मराठी</option>
                <option value="gu">ગુજરાતી</option>
                <option value="pa">ਪੰਜਾਬੀ</option>
                <option value="bn">বাংলা</option>
                <option value="ml">മലയാളം</option>
                <option value="ur">اردو</option>
              </select>
            </div>

            {isAuthenticated ? (
              <>
                {/* Desktop Post Reels button */}
                <Link
                  href="/my-reels?action=upload"
                  className="hidden md:flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-xl text-[13px] font-bold transition-colors shadow-sm"
                >
                  <i className="ph-bold ph-video-camera text-sm"></i>
                  Post Reels
                </Link>

                {/* Notification Bell */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={handleOpenNotifPanel}
                    className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors"
                    title="Notifications"
                  >
                    <i className="ph ph-bell text-[20px] text-gray-600"></i>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-sm">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {showNotifPanel && (
                    <div className="absolute right-0 top-12 w-[340px] max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-gray-100 z-[10000] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <span className="text-[15px] font-black text-gray-900">Notifications</span>
                        <button
                          onClick={() => setShowNotifPanel(false)}
                          className="text-gray-400 hover:text-gray-600 transition"
                        >
                          <i className="ph ph-x text-lg"></i>
                        </button>
                      </div>

                      <div className="max-h-[420px] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 gap-2">
                            <i className="ph ph-bell-slash text-4xl text-gray-300"></i>
                            <p className="text-sm text-gray-400 font-medium">No new notifications</p>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <button
                              key={notif.id}
                              onClick={() => handleNotifClick(notif)}
                              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                            >
                              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                                {notif.image ? (
                                  <img src={notif.image} alt="" className="w-full h-full object-cover rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                ) : (
                                  <NotifIcon type={notif.type} status={notif.status} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[13px] font-bold text-gray-900 truncate">{notif.title}</p>
                                  <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(notif.time)}</span>
                                </div>
                                <p className="text-[12px] text-gray-600 mt-0.5 line-clamp-2">{notif.body}</p>
                                <div className="mt-1">
                                  <NotifIcon type={notif.type} status={notif.status} />
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      {notifications.length > 0 && (
                        <div className="border-t border-gray-100 px-4 py-2.5 text-center">
                          <button
                            onClick={() => { setShowNotifPanel(false); router.push('/chat'); }}
                            className="text-[13px] font-bold text-green-700 hover:text-green-800 transition"
                          >
                            View all messages
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="hidden md:block w-px h-6 bg-gray-200" />

                {/* Profile */}
                <button
                  onClick={() => router.push('/user-profile')}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <img
                    src={avatarUrl}
                    alt={user?.name || 'Profile'}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-green-100"
                    onError={(e) => {
                      e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name || 'U')}&backgroundColor=166534&textColor=ffffff`;
                    }}
                  />
                  <span className="hidden md:block text-[13px] font-semibold text-gray-700 max-w-[90px] truncate">
                    {user?.name?.split(' ')[0] || 'Profile'}
                  </span>
                  <i className="ph ph-caret-down text-gray-400 text-xs hidden md:block"></i>
                </button>

                {/* Mobile + Quick Actions button */}
                <div className="md:hidden relative" ref={plusRef}>
                  <button
                    onClick={() => { setShowPlusMenu((v) => !v); setShowNotifPanel(false); }}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-green-600 text-white shadow-md active:scale-90 transition-transform"
                    title="Quick Actions"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>

                  {/* Quick Actions Menu */}
                  {showPlusMenu && (
                    <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[10000] overflow-hidden py-1">
                      {/* Upload Reels */}
                      <button
                        onClick={() => { setShowPlusMenu(false); router.push('/my-reels?action=upload'); }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                          <i className="ph-bold ph-video-camera text-rose-600 text-base"></i>
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-gray-900">Upload Reel</p>
                          <p className="text-[11px] text-gray-400">Share a farming video</p>
                        </div>
                      </button>

                      <div className="mx-4 border-t border-gray-100" />

                      {/* Add Equipment */}
                      <button
                        onClick={() => { setShowPlusMenu(false); router.push('/rent-machinery'); }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <i className="ph-bold ph-tractor text-blue-600 text-base"></i>
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-gray-900">Add Equipment</p>
                          <p className="text-[11px] text-gray-400">List your machinery for rent</p>
                        </div>
                      </button>

                      <div className="mx-4 border-t border-gray-100" />

                      {/* Add Crop */}
                      <button
                        onClick={() => { setShowPlusMenu(false); router.push('/user-profile?addCrop=true'); }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                          <i className="ph-bold ph-plant text-green-600 text-base"></i>
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-gray-900">Add Crop</p>
                          <p className="text-[11px] text-gray-400">Add your crop details</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login"
                  className="text-[13px] font-semibold text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition">
                  Sign In
                </Link>
                <Link href="/signup"
                  className="text-[13px] font-bold bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-xl transition shadow-sm">
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-green-700 via-green-500 to-emerald-400" />
      </nav>
    </>
  );
}
