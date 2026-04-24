'use client';

import { useEffect, useState } from 'react';

export default function AdSplash({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + (100 / 30);
      });
    }, 100);
    const fadeTimer = setTimeout(() => setFading(true), 2600);
    const doneTimer = setTimeout(() => onDone(), 2000);
    return () => { clearInterval(interval); clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.4s ease',
        background: 'linear-gradient(145deg, #064e2b 0%, #0f6e3e 45%, #166534 100%)',
      }}
    >
      {/* Floating orbs */}
      <div className="absolute top-[-60px] right-[-60px] w-[220px] h-[220px] rounded-full pointer-events-none"
        style={{ background: 'rgba(134,239,172,0.12)', animation: 'floatOrb 6s ease-in-out infinite' }} />
      <div className="absolute bottom-[-40px] left-[-80px] w-[280px] h-[280px] rounded-full pointer-events-none"
        style={{ background: 'rgba(110,231,183,0.08)', animation: 'floatOrb 8s ease-in-out infinite reverse' }} />

      {/* Skip */}
      <button
        onClick={onDone}
        className="absolute top-12 right-5 text-white/60 text-xs font-bold px-3 py-1.5 rounded-full"
        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
      >
        Skip ✕
      </button>

      {/* Content */}
      <div className="flex flex-col items-center px-8 text-center" style={{ gap: '0px' }}>

        {/* Logo */}
        <div className="w-20 h-20 bg-white rounded-[22px] flex items-center justify-center mb-5 overflow-hidden"
          style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.35)', animation: 'scaleIn 0.5s cubic-bezier(.34,1.56,.64,1) forwards' }}>
          <img src="/assets/cofarmz-logo.png" alt="CoFarmz" className="w-full h-full object-cover rounded-[22px]" />
        </div>

        {/* Title */}
        <div style={{ animation: 'fadeUp 0.6s ease forwards 0.1s', opacity: 0 }}>
          <p className="text-[11px] font-black tracking-[.18em] uppercase mb-1.5" style={{ color: '#86efac' }}>CoFarmz</p>
          <h1 className="text-[32px] font-black text-white leading-tight tracking-tight mb-0"
            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>
            Growing Together,<br />
            <em className="not-italic font-black" style={{ color: '#4ade80' }}>Selling Smarter.</em>
          </h1>
        </div>

        {/* Subtitle */}
        <p className="text-sm font-semibold mt-3 mb-5 max-w-[260px] leading-relaxed"
          style={{ color: 'rgba(187,247,208,0.75)', animation: 'fadeUp 0.6s ease forwards 0.35s', opacity: 0 }}>
          Your global farmer & buyer network — built for the fields.
        </p>

        {/* Belief tags */}
        <div className="flex flex-wrap gap-2 justify-center mb-5"
          style={{ animation: 'fadeUp 0.6s ease forwards 0.85s', opacity: 0 }}>
          {[
            { label: 'Connect Farmers', color: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.3)', text: '#86efac' },
            { label: 'Rent Equipment',  color: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.25)', text: '#fde68a' },
            { label: 'Find Buyers',     color: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.25)', text: '#bfdbfe' },
            { label: 'Grow Together',   color: 'rgba(251,113,133,0.12)',border: 'rgba(251,113,133,0.25)',text: '#fecdd3' },
          ].map(tag => (
            <span key={tag.label}
              className="text-[11px] font-bold px-3 py-1 rounded-full"
              style={{ background: tag.color, border: `1px solid ${tag.border}`, color: tag.text }}>
              {tag.label}
            </span>
          ))}
        </div>

        {/* Farmer quote from About page */}
        <p className="text-xs font-semibold italic max-w-[240px] leading-relaxed"
          style={{ color: 'rgba(187,247,208,0.5)', animation: 'fadeUp 0.6s ease forwards 1.1s', opacity: 0 }}>
          "You grow food for everyone. Now let's grow together."
        </p>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-full" style={{
          width: `${Math.min(progress, 100)}%`,
          background: 'linear-gradient(90deg, #4ade80, #86efac)',
          transition: 'width 0.1s linear',
        }} />
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(12px, -16px) scale(1.08); }
        }
      `}</style>
    </div>
  );
}