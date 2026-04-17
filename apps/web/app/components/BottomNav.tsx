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
    { href: '/',               label: 'Home',     icon: 'ph-house',       activeColor: 'text-emerald-600', activeBg: 'bg-emerald-50',   activeDot: 'bg-emerald-500' },
    { href: '/machinery-list', label: 'Fleet',    icon: 'ph-tractor',     activeColor: 'text-blue-600',    activeBg: 'bg-blue-50',      activeDot: 'bg-blue-500'    },
    { href: '/nearby-farmers', label: 'Nearby',   icon: 'ph-users-three', activeColor: 'text-violet-600',  activeBg: 'bg-violet-50',    activeDot: 'bg-violet-500'  },
    { href: '/reels',          label: 'Reels',    icon: 'ph-video',       activeColor: 'text-rose-600',    activeBg: 'bg-rose-50',      activeDot: 'bg-rose-500'    },
    { href: '/chat',           label: 'Messages', icon: 'ph-chat-circle', activeColor: 'text-amber-600',   activeBg: 'bg-amber-50',     activeDot: 'bg-amber-500'   },
    { href: '/user-profile',   label: 'Profile',  icon: 'ph-user-circle', activeColor: 'text-teal-600',    activeBg: 'bg-teal-50',      activeDot: 'bg-teal-500'    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[60] md:hidden pb-safe">
      {/* Frosted glass background */}
      <div className="bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-[0_-8px_32px_rgba(0,0,0,0.10)]">
        <div className="flex items-center justify-around h-[64px] px-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all duration-200 active:scale-90"
              >
                {/* Active top bar */}
                {active && (
                  <span className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full ${item.activeDot}`} />
                )}

                {/* Icon container */}
                <div className={`flex items-center justify-center w-9 h-9 rounded-2xl transition-all duration-200 ${
                  active ? `${item.activeBg} scale-110` : 'bg-transparent'
                }`}>
                  <i className={`${active ? 'ph-fill' : 'ph-bold'} ${item.icon} transition-all duration-200 ${
                    active ? `${item.activeColor} text-[22px]` : 'text-gray-500 text-[20px]'
                  }`} />
                </div>

                {/* Label */}
                <span className={`text-[9px] font-black tracking-tight leading-none transition-all duration-200 ${
                  active ? item.activeColor : 'text-gray-400 font-bold'
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
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
