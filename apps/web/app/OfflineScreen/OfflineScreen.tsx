'use client';

import { useEffect, useState } from 'react';

export default function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6 py-12 overflow-hidden"
      style={{ background: '#1a2e1a' }}>

      {/* Ambient blobs */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-40" style={{ background: '#2d5a1b' }} />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-50" style={{ background: '#1e3d14' }} />

      {/* Logo */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#4ade80' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <ellipse cx="12" cy="12" rx="10" ry="10" fill="#166534"/>
            <path d="M7 10c1-3 4-4 5-8M12 2c0 4-3 6-5 9s0 6 5 7c5-1 7-4 5-7s-5-5-5-9z"
              stroke="#4ade80" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="text-sm font-bold tracking-wide" style={{ color: '#4ade80' }}>CoFarmz</span>
      </div>

      {/* Animated illustration */}
      <div className="mb-8 animate-[float_3s_ease-in-out_infinite] relative">
        <svg width="130" height="110" viewBox="0 0 120 100">
          {/* Main plant */}
          <g style={{ animation: 'sway 4s ease-in-out infinite', transformOrigin: '60px 90px' }}>
            <rect x="57" y="30" width="6" height="60" rx="3" fill="#6b7c5c"/>
            <ellipse cx="60" cy="28" rx="18" ry="14" fill="#3a7a2a"/>
            <ellipse cx="50" cy="38" rx="12" ry="9" fill="#2d6122"/>
            <ellipse cx="70" cy="36" rx="12" ry="9" fill="#2d6122"/>
            <ellipse cx="60" cy="22" rx="10" ry="8" fill="#4ade80" opacity="0.4"/>
          </g>
          {/* Side plants */}
          <g style={{ animation: 'sway 3s ease-in-out infinite 0.5s', transformOrigin: '30px 90px' }}>
            <rect x="28" y="55" width="4" height="35" rx="2" fill="#6b7c5c"/>
            <ellipse cx="30" cy="53" rx="11" ry="9" fill="#2d6122"/>
            <ellipse cx="30" cy="48" rx="7" ry="6" fill="#3a7a2a"/>
          </g>
          <g style={{ animation: 'sway 3.5s ease-in-out infinite 1s', transformOrigin: '90px 90px' }}>
            <rect x="88" y="58" width="4" height="32" rx="2" fill="#6b7c5c"/>
            <ellipse cx="90" cy="56" rx="11" ry="9" fill="#2d6122"/>
            <ellipse cx="90" cy="51" rx="7" ry="6" fill="#3a7a2a"/>
          </g>
          {/* No-signal icon overlay */}
          <circle cx="60" cy="60" r="14" fill="#111827" opacity="0.92"/>
          <circle cx="60" cy="60" r="14" fill="none" stroke="#ef4444" strokeWidth="2"/>
          <line x1="60" y1="49" x2="60" y2="71" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
          <line x1="49" y1="60" x2="71" y2="60" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Badge */}
      <div className="mb-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
        style={{ background: '#ef4444', color: '#fff', letterSpacing: '0.1em' }}>
        No Internet
      </div>

      {/* Headline */}
      <h1 className="text-center font-black text-3xl leading-tight mb-3" style={{ color: '#ffffff' }}>
        Fields don't wait.<br />
        <span style={{ color: '#4ade80' }}>Neither should you.</span>
      </h1>

      <p className="text-center text-sm font-medium mb-6 max-w-xs leading-relaxed" style={{ color: '#86a87a' }}>
        CoFarmz connects farmers, buyers & equipment — but right now your signal is on a tea break.
      </p>

      {/* Feature reminder card */}
      <div className="w-full max-w-xs rounded-2xl p-4 mb-6"
        style={{ background: '#0f2010', border: '1px solid #1e4020' }}>
        <p className="text-xs font-bold mb-3 tracking-wider uppercase" style={{ color: '#4ade80' }}>
          While you wait, remember:
        </p>
        <div className="flex flex-col gap-2">
          {[
            'Rent or lend equipment nearby',
            'Buy & sell crops directly with buyers',
            'Post your farm tales as reels',
            'Find farmers & buyers around you',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#4ade80' }} />
              <span className="text-xs" style={{ color: '#86a87a' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Retry button */}
      <button
        onClick={onRetry}
        className="w-full max-w-xs py-4 rounded-2xl text-sm font-black tracking-wide active:scale-[0.98] transition-transform"
        style={{ background: '#4ade80', color: '#14532d' }}
      >
        Try Again
      </button>

      {/* Footer quote */}
      <p className="mt-4 text-xs italic text-center" style={{ color: '#3d5c38' }}>
        "Every seed needs patience — your connection will return."
      </p>

      <style>{`
        @keyframes sway {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
      `}</style>
    </div>
  );
}