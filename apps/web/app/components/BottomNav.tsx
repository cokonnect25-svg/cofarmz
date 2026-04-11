'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed bottom-[25px] left-0 right-0 w-full px-4 z-50 pointer-events-none" style={{ paddingBottom: '20px' }}>
      <div className="pointer-events-auto w-full bg-white/80 backdrop-blur-xl border border-white/40 shadow-float rounded-[28px] px-2 py-2">
        <div className="flex items-center justify-around w-full">
          
          {/* Home */}
          <Link href="/" className="relative flex flex-col items-center justify-center w-14 h-14">
            <div className={`absolute inset-0 bg-brand-50 rounded-2xl transition-opacity ${isActive('/') ? 'opacity-100' : 'opacity-0'}`}></div>
            <i className={`${isActive('/') ? 'ph-fill' : 'ph'} ph-house text-[26px] ${isActive('/') ? 'text-brand-600' : 'text-gray-400'} relative z-10 transition-transform active:scale-90`}></i>
            <span className={`text-[10px] ${isActive('/') ? 'font-bold text-brand-600' : 'font-medium text-gray-400'} mt-0.5 relative z-10`}>Home</span>
          </Link>

          {/* Machinery List */}
          <Link href="/machinery-list" className="relative flex flex-col items-center justify-center w-14 h-14 group">
            <div className={`absolute inset-0 bg-brand-50 rounded-2xl transition-opacity ${isActive('/machinery-list') ? 'opacity-100' : 'opacity-0'}`}></div>
            <i className={`${isActive('/machinery-list') ? 'ph-fill' : 'ph'} ph-tractor text-[26px] ${isActive('/machinery-list') ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-800'} transition-colors active:scale-90 ${isActive('/machinery-list') ? 'relative z-10' : ''}`}></i>
            <span className={`text-[10px] ${isActive('/machinery-list') ? 'font-bold text-brand-600 relative z-10' : 'font-medium text-gray-400 group-hover:text-gray-800'} mt-0.5 transition-colors`}>Fleet</span>
          </Link>

          {/* Reels */}
          <Link href="/reels" className="relative flex flex-col items-center justify-center w-14 h-14 group">
            <div className={`absolute inset-0 bg-brand-50 rounded-2xl transition-opacity ${isActive('/reels') ? 'opacity-100' : 'opacity-0'}`}></div>
            <i className={`${isActive('/reels') ? 'ph-fill' : 'ph'} ph-video text-[26px] ${isActive('/reels') ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-800'} transition-colors active:scale-90 ${isActive('/reels') ? 'relative z-10' : ''}`}></i>
            <span className={`text-[10px] ${isActive('/reels') ? 'font-bold text-brand-600 relative z-10' : 'font-medium text-gray-400 group-hover:text-gray-800'} mt-0.5 transition-colors`}>Reels</span>
          </Link>

          {/* Farmers & Buyers */}
          <Link href="/nearby-farmers" className="relative flex flex-col items-center justify-center w-14 h-14 group">
            <div className={`absolute inset-0 bg-brand-50 rounded-2xl transition-opacity ${isActive('/nearby-farmers') ? 'opacity-100' : 'opacity-0'}`}></div>
            <i className={`${isActive('/nearby-farmers') ? 'ph-fill' : 'ph'} ph-users text-[26px] ${isActive('/nearby-farmers') ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-800'} transition-colors active:scale-90 ${isActive('/nearby-farmers') ? 'relative z-10' : ''}`}></i>
            <span className={`text-[10px] ${isActive('/nearby-farmers') ? 'font-bold text-brand-600 relative z-10' : 'font-medium text-gray-400 group-hover:text-gray-800'} mt-0.5 transition-colors`}>Farmers&Buyers</span>
          </Link>

          {/* Messages */}
          <Link href="/chat" className="relative flex flex-col items-center justify-center w-14 h-14 group">
            <div className={`absolute inset-0 bg-brand-50 rounded-2xl transition-opacity ${isActive('/chat') || pathname.startsWith('/chat/') ? 'opacity-100' : 'opacity-0'}`}></div>
            <i className={`${isActive('/chat') || pathname.startsWith('/chat/') ? 'ph-fill' : 'ph'} ph-chat-circle text-[26px] ${isActive('/chat') || pathname.startsWith('/chat/') ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-800'} transition-colors active:scale-90 ${isActive('/chat') || pathname.startsWith('/chat/') ? 'relative z-10' : ''}`}></i>
            <span className={`text-[10px] ${isActive('/chat') || pathname.startsWith('/chat/') ? 'font-bold text-brand-600 relative z-10' : 'font-medium text-gray-400 group-hover:text-gray-800'} mt-0.5 transition-colors`}>Messages</span>
          </Link>

        </div>
      </div>
    </nav>
  );
}
