'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';

function SelectRoleContent() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || loading) return;
    if (!user) {
      window.location.replace('/login');
      return;
    }
    fetch(getApiUrl(`/api/users/profile?userId=${user.id}`))
      .then(r => r.json())
      .then(profile => {
        // Redirect to home if user already has a confirmed role
        const hasRole = profile.role_confirmed === true;
        if (hasRole) window.location.replace('/');
      })
      .catch(() => { });
  }, [mounted, loading, user, router]);

  const handleSelectRole = async (role: 'farmer' | 'buyer') => {
    if (!user?.email || selecting || !agreed) return;
    setSelecting(true);
    setError('');
    try {
      const res = await fetch(getApiUrl('/api/users/profile'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to set role');
      }
      window.location.replace('/');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setSelecting(false);
    }
  };

  if (!mounted || loading) {
    return (
      <div className="w-full min-h-[100dvh] bg-green-700 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-white border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-min-h-[100dvh] bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 flex flex-col items-center justify-center px-6 py-12">

      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-full bg-white p-1.5 shadow-xl mb-3">
          <img src="/assets/cofarmz-logo.png" alt="CoFarmz" className="w-full h-full rounded-full object-cover" />
        </div>
        <h1 className="text-white font-black text-2xl tracking-tight">CoFarmz</h1>
        <p className="text-green-200 text-xs mt-1">Growing Together, Selling Smarter</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-6 pt-6 pb-5">
          <h2 className="text-white font-black text-xl">Welcome to CoFarmz 👋</h2>
          <p className="text-green-100 text-xs mt-1">Quick setup — takes less than 10 seconds</p>
        </div>

        <div className="px-6 py-5">

          {/* Terms & Conditions */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
            <p className="text-xs font-black text-gray-700 uppercase tracking-widest mb-3">Terms & Conditions</p>
            <ul className="space-y-2">
              {[
                { icon: '🌾', text: 'CoFarmz connects farmers and buyers across India' },
                { icon: '🔒', text: 'Your personal data is safe and never sold to third parties' },
                { icon: '📋', text: 'You are responsible for the accuracy of your listings' },
                { icon: '🤝', text: 'All transactions are between users — CoFarmz is the platform only' },
                { icon: '🚫', text: 'Fraudulent activity will result in immediate account removal' },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="text-sm flex-shrink-0 mt-0.5">{item.icon}</span>
                  <span className="text-xs text-gray-600 leading-relaxed">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Agree Checkbox */}
          <label className="flex items-center gap-3 mb-5 cursor-pointer group">
            <div
              onClick={() => setAgreed(!agreed)}
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${agreed
                ? 'bg-green-600 border-green-600'
                : 'border-gray-300 bg-white group-hover:border-green-400'
                }`}
            >
              {agreed && <i className="ph-bold ph-check text-white text-xs"></i>}
            </div>
            <span className="text-xs text-gray-700 leading-relaxed">
              I agree to the{' '}
              <span className="text-green-700 font-bold">Terms & Conditions</span>
              {' '}and{' '}
              <span className="text-green-700 font-bold">Privacy Policy</span>
            </span>
          </label>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-100"></div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Choose Your Role</p>
            <div className="flex-1 h-px bg-gray-100"></div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-medium text-center">
              {error}
            </div>
          )}

          {/* Role Cards */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleSelectRole('farmer')}
              disabled={selecting || !agreed}
              className={`w-full border-2 rounded-2xl p-4 flex items-center gap-4 transition-all text-left active:scale-[0.98] ${agreed
                ? 'bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-500'
                : 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${agreed ? 'bg-green-600' : 'bg-gray-300'}`}>
                <span className="text-2xl">🌾</span>
              </div>
              <div>
                <p className="font-black text-gray-900">Farmer</p>
                <p className="text-gray-500 text-xs mt-0.5">Sell crops, rent machinery & connect with buyers</p>
              </div>
              {agreed && <i className="ph-bold ph-arrow-right text-green-500 text-lg ml-auto"></i>}
            </button>

            <button
              onClick={() => handleSelectRole('buyer')}
              disabled={selecting || !agreed}
              className={`w-full border-2 rounded-2xl p-4 flex items-center gap-4 transition-all text-left active:scale-[0.98] ${agreed
                ? 'bg-blue-50 hover:bg-blue-100 border-blue-200 hover:border-blue-500'
                : 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${agreed ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <span className="text-2xl">🛒</span>
              </div>
              <div>
                <p className="font-black text-gray-900">Buyer</p>
                <p className="text-gray-500 text-xs mt-0.5">Buy crops directly from farmers at fair prices</p>
              </div>
              {agreed && <i className="ph-bold ph-arrow-right text-blue-500 text-lg ml-auto"></i>}
            </button>
          </div>

          {selecting && (
            <div className="mt-5 flex items-center justify-center gap-2 text-gray-500 text-sm">
              <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
              Setting up your account...
            </div>
          )}

          {!agreed && (
            <p className="text-center text-xs text-gray-400 mt-4">
              ☝️ Agree to terms above to continue
            </p>
          )}
        </div>
      </div>

      <p className="text-green-200 text-xs mt-5 text-center">
        You can change your role later in Settings
      </p>
    </div>
  );
}

export default function SelectRolePage() {
  return (
    <Suspense fallback={
      <div className="w-full min-h-[100dvh] bg-green-700 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-white border-t-transparent animate-spin"></div>
      </div>
    }>
      <SelectRoleContent />
    </Suspense>
  );
}
