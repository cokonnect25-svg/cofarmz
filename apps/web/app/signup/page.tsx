'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export default function SignupPage() {
  const router = useRouter();
  const { signUp, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [userType, setUserType] = useState<'farmer' | 'buyer'>('farmer');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  // useEffect removed to avoid double-redirection conflict with manual sign-up flow


  if (!mounted || loading) {
    return (
      <div className="w-full h-screen bg-green-700 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-white border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password || !confirmPassword) { setError('Please fill in all fields.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!agreedToTerms) { setError('Please agree to the Terms of Service.'); return; }

    setIsLoading(true);
    try {
      await signUp(email, password, name);
      // Redirect to select-role which shows full Terms & Conditions and lets user pick their role
      window.location.replace('/select-role');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exist')) {
        setError('An account with this email already exists. Please sign in.');
      } else if (msg.toLowerCase().includes('password')) {
        setError('Password does not meet requirements.');
      } else {
        setError(msg || 'Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://cofarmz-backend-866114557322.asia-south1.run.app').replace(/\/$/, '');
      if (Capacitor.isNativePlatform()) {
        const callbackURL = 'com.cofarmz.app://auth-callback';
        const authUrl = `${backendUrl}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackURL)}`;
        await Browser.open({ url: authUrl, windowName: '_self' });
      } else {
        const callbackURL = `${window.location.origin}/auth-callback`;
        const authUrl = `${backendUrl}/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackURL)}`;
        window.location.href = authUrl;
      }
    } catch (err: any) {
      console.error('Google Sign-in Error:', err);
      setError(err.message || 'Google sign-in failed. Please try again.');
      setIsLoading(false);
    }
  };

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 8 ? 2 : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full"></div>
          <div className="absolute top-1/3 -left-16 w-64 h-64 bg-white/5 rounded-full"></div>
          <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-black/10 rounded-full"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-16">
            <div className="w-20 h-20 rounded-2xl bg-white p-1.5 shadow-2xl flex-shrink-0 border border-white/30">
              <img
                src="/assets/cofarmz-logo.png"
                alt="CoFarmz"
                className="w-full h-full rounded-xl object-cover"
              />
            </div>
            <div>
              <span className="text-white font-black text-3xl tracking-tight drop-shadow-lg block">CoFarmz</span>
              <span className="text-green-200 text-xs font-medium tracking-widest uppercase">Agri Platform</span>
            </div>
          </div>

          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            Join CoFarmz Today
          </h2>
          <p className="text-green-100 text-lg leading-relaxed max-w-sm">
            Your Global Farmer &amp; Buyer Network — Growing Together, Selling Smarter.
          </p>
        </div>

        <div className="relative z-10 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">👨‍🌾</div>
            <div>
              <p className="text-white font-semibold text-sm">Rajesh Kumar</p>
              <p className="text-green-200 text-xs">Farmer from Punjab</p>
            </div>
          </div>
          <p className="text-green-50 text-sm leading-relaxed">
            "CoFarmz helped me earn extra income by renting my tractor during the off-season. Amazing platform!"
          </p>
          <div className="flex gap-0.5 mt-3">
            {[1, 2, 3, 4, 5].map(i => <span key={i} className="text-yellow-300 text-sm">★</span>)}
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="w-full lg:w-7/12 flex flex-col justify-center items-center px-6 py-4 lg:py-10 bg-white min-h-[100dvh] overflow-y-auto overflow-x-hidden">
        {/* Mobile logo */}
        <div className="lg:hidden flex flex-col items-center gap-2 mb-4 mt-2">          <div className="w-16 h-16 rounded-2xl bg-green-700 p-1.5 shadow-xl border-2 border-green-100">
            <img src="/assets/cofarmz-logo.png" alt="CoFarmz" className="w-full h-full rounded-xl object-cover" />
          </div>
          <div className="text-center">
            <span className="text-gray-900 font-black text-xl block">CoFarmz</span>
            <span className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">Agri Network</span>
          </div>
        </div>

        <div className="w-full max-w-lg">
          <div className="mb-5">
            <h1 className="text-2xl lg:text-3xl font-black text-gray-900 mb-1">Create your account</h1>
            <p className="text-gray-500 text-xs lg:text-sm">Start renting and listing farm equipment today</p>
          </div>
          {/* Error */}
          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Account Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">I am a</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUserType('farmer')}
                  className={`py-3 px-4 rounded-xl border-2 font-semibold text-sm transition flex items-center justify-center gap-2 ${userType === 'farmer'
                      ? 'border-green-600 bg-green-50 text-green-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                >
                  <span className="text-lg">🧑‍🌾</span>
                  Farmer
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('buyer')}
                  className={`py-3 px-4 rounded-xl border-2 font-semibold text-sm transition flex items-center justify-center gap-2 ${userType === 'buyer'
                      ? 'border-green-600 bg-green-50 text-green-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                >
                  <span className="text-lg">🛒</span>
                  Buyer
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rajesh Kumar"
                disabled={isLoading}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isLoading}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm pr-11"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPassword
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                    }
                  </svg>
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= passwordStrength ? strengthColor[passwordStrength] : 'bg-gray-200'}`}></div>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-gray-500">{strengthLabel[passwordStrength]}</span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  disabled={isLoading}
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm pr-11 ${confirmPassword && confirmPassword !== password ? 'border-red-300' : 'border-gray-300'
                    }`}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showConfirm
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                    }
                  </svg>
                </button>
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="text-xs text-red-500 mt-1">Passwords don&apos;t match</p>
              )}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3 pt-1">
              <input
                type="checkbox"
                id="terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
              />
              <label htmlFor="terms" className="text-sm text-gray-600 leading-relaxed cursor-pointer">
                I accept CoFarmz&apos;s{' '}
                <a href="/terms" target="_blank" className="text-green-700 font-semibold hover:underline">Terms & Conditions</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" className="text-green-700 font-semibold hover:underline">Privacy Policy</a>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !email || !password || !name || !agreedToTerms}
              className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-xl font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm mt-2"
            >
              {isLoading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Creating account...</>
              ) : 'Create account'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">or</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              disabled={isLoading || !agreedToTerms}
              onClick={handleGoogleSignIn}
              className={`w-full bg-white text-gray-700 py-3 rounded-xl font-semibold text-sm border border-gray-300 transition flex items-center justify-center gap-3 shadow-sm ${!agreedToTerms ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <button onClick={() => router.push('/login')} className="text-green-700 font-semibold hover:text-green-800 transition">
              Sign in
            </button>
          </p>

          <div className="flex justify-center gap-6 mt-6 text-xs text-gray-400">
            <a href="/terms" className="hover:text-gray-600 transition">Terms of Service</a>
            <a href="/privacy" className="hover:text-gray-600 transition">Privacy Policy</a>
            <a href="/help" className="hover:text-gray-600 transition">Help</a>
          </div>
        </div>
      </div>
    </div>
  );
}
