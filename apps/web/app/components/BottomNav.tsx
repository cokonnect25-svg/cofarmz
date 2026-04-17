'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function BottomNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nearbyType = searchParams.get('type');

  const isActive = (path: string, queryType?: string) => {
    if (path === '/') return pathname === '/';
    if (path === '/nearby-farmers' && queryType) {
      return pathname?.startsWith('/nearby-farmers') && nearbyType === queryType;
    }
    return pathname?.startsWith(path);
  };

  const navItems = [
    { href: '/', label: 'Home', icon: 'ph-house' },
    { href: '/machinery-list', label: 'Fleet', icon: 'ph-tractor' },
    { href: '/nearby-farmers', basePath: '/nearby-farmers', label: 'Nearby', icon: 'ph-users' },
    { href: '/reels', label: 'Reels', icon: 'ph-video' },
    { href: '/chat', label: 'Messages', icon: 'ph-chat-circle' },
    { href: '/user-profile', label: 'Profile', icon: 'ph-user' },
    { href: '/about', label: 'About Us', icon: 'ph-info' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[60] md:hidden bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-safe">
      <div className="flex items-center justify-around h-[60px] px-1 relative">
        {navItems.map((item) => {
          const active = isActive(item.basePath || item.href, (item as any).queryType);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${
                active ? 'text-green-700' : 'text-gray-400'
              }`}
            >
              <div className={`relative flex items-center justify-center w-7 h-7 rounded-xl transition-all duration-300 ${
                active ? 'bg-green-50 scale-110' : 'bg-transparent shadow-none'
              }`}>
                <i className={`${active ? 'ph-fill' : 'ph'} ${item.icon} text-[20px] transition-transform duration-300 active:scale-75`}></i>
              </div>
              <span className={`text-[9px] font-bold mt-1 tracking-tighter transition-all duration-300 ${
                active ? 'text-green-700 opacity-100 translate-y-0' : 'text-gray-400 opacity-90'
              }`}>
                {item.label}
              </span>
              {active && (
                <div className="absolute top-0 w-6 h-0.5 bg-green-600 rounded-b-full duration-300" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavContent />
    </Suspense>
  );
}
