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
    { href: '/',               label: 'Home',     icon: 'ph-house',       activeColor: 'text-emerald-600', activeBg: 'bg-emerald-50',  activeDot: 'bg-emerald-500' },
    { href: '/nearby-farmers', label: 'Nearby',   icon: 'ph-users-three', activeColor: 'text-violet-600',  activeBg: 'bg-violet-50',   activeDot: 'bg-violet-500'  },
    { href: '/machinery-list', label: 'Fleet',    icon: 'ph-tractor',     activeColor: 'text-blue-600',    activeBg: 'bg-blue-50',     activeDot: 'bg-blue-500'    },
    { href: '/chat',           label: 'Messages', icon: 'ph-chat-circle', activeColor: 'text-amber-600',   activeBg: 'bg-amber-50',    activeDot: 'bg-amber-500'   },
    { href: '/reels',          label: 'Farm Tales',    icon: 'ph-video',       activeColor: 'text-rose-600',    activeBg: 'bg-rose-50',     activeDot: 'bg-rose-500'    },
    { href: '/about',          label: 'About Us',  icon: 'ph-info', activeColor: 'text-teal-600',    activeBg: 'bg-teal-50',     activeDot: 'bg-teal-500'    },
  ];

  return (
<nav
  className="fixed bottom-0 left-0 right-0 z-[60] md:hidden"
  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
>
      <div className="bg-white/98 backdrop-blur-xl border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="flex items-stretch justify-around h-[60px]">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center justify-center flex-1 py-1.5 gap-0.5 transition-all duration-200 active:scale-90 select-none"
              >
                {/* Active indicator bar at top */}
                {active && (
                  <span className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full ${item.activeDot}`} />
                )}

                {/* Icon */}
                <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 ${
                  active ? `${item.activeBg} scale-105` : ''
                }`}>
                  <i className={`${active ? 'ph-fill' : 'ph-bold'} ${item.icon} transition-all duration-200 ${
                    active ? `${item.activeColor} text-[20px]` : 'text-gray-400 text-[19px]'
                  }`} />
                </div>

                {/* Label */}
                <span className={`text-[9px] font-black tracking-tight leading-none ${
                  active ? item.activeColor : 'text-gray-400'
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
