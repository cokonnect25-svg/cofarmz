'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, signOut } = useAuth();

  const isActive = (path: string) => pathname === path;

  const [selectedLang, setSelectedLang] = useState('en');

  useEffect(() => {
    const match = document.cookie.match(/googtrans=\/en\/([a-z]+)/);
    if (match) setSelectedLang(match[1]);
  }, []);

  const navLinks = [
    { href: '/', label: 'Home', icon: 'ph-house' },
    { href: '/about', label: 'About', icon: 'ph-info' },
    { href: '/machinery-list', label: 'Fleets', icon: 'ph-tractor' },
    { href: '/reels', label: 'Reels', icon: 'ph-video' },
    { href: '/nearby-farmers', label: 'Farmers & Buyers', icon: 'ph-users' },
    { href: '/chat', label: 'Messages', icon: 'ph-chat-circle' },
  ];

  return (
    <>
      {/* ── TOP NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-100">
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
                <Link
                  href="/my-reels?action=upload"
                  className="hidden md:flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-xl text-[13px] font-bold transition-colors shadow-sm"
                >
                  <i className="ph-bold ph-video-camera text-sm"></i>
                  Post Reels
                </Link>
                <div className="hidden md:block w-px h-6 bg-gray-200" />
                <button
                  onClick={() => router.push('/user-profile')}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <img
                    src={user?.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name || 'U')}&backgroundColor=166534&textColor=ffffff`}
                    alt={user?.name || 'Profile'}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-green-100"
                  />
                  <span className="hidden md:block text-[13px] font-semibold text-gray-700 max-w-[90px] truncate">
                    {user?.name?.split(' ')[0] || 'Profile'}
                  </span>
                  <i className="ph ph-caret-down text-gray-400 text-xs hidden md:block"></i>
                </button>
                <Link
                  href="/my-reels?action=upload"
                  className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-green-700 text-white shadow-sm"
                >
                  <i className="ph-bold ph-plus-circle text-lg"></i>
                </Link>
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
