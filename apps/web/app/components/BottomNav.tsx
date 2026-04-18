'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
  };

  const navItems = [
    { href: '/', label: 'Home', icon: 'ph-house' },
    { href: '/machinery-list', label: 'Fleet', icon: 'ph-tractor' },
    { href: '/reels', label: 'Reels', icon: 'ph-video' },
    { href: '/chat', label: 'Messages', icon: 'ph-chat-circle' },
    { href: '/nearby-farmers', label: 'Farmers & Buyers', icon: 'ph-users' },
    { href: '/about', label: 'About Us', icon: 'ph-info' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[60] md:hidden bg-white/90 backdrop-blur-xl border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] pb-safe">
      <div className="flex items-center justify-around h-[64px] px-1 relative">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${
                active ? 'text-green-700' : 'text-gray-400'
              }`}
            >
              <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${
                active ? 'bg-green-50 scale-110' : 'bg-transparent shadow-none'
              }`}>
                <i className={`${active ? 'ph-fill' : 'ph'} ${item.icon} text-[22px] transition-transform duration-300 active:scale-75`}></i>
              </div>
              <span className={`text-[9px] font-black mt-1 tracking-tighter transition-all duration-300 ${
                active ? 'opacity-100 translate-y-0' : 'opacity-80'
              }`}>
                {item.label}
              </span>
              {active && (
                <div className="absolute top-0 w-8 h-1 bg-green-600 rounded-b-full animate-in slide-in-from-top-1 duration-300" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
