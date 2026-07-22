'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { authClient } from '@/lib/auth-client';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { CapacitorCookies } from '@capacitor/core';
import { getApiUrl } from '@/lib/api';
import { storeMobileSession } from '@/hooks/useAuth';

function LoginContent() {
  const router = useRouter();
  const { signIn, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => { setMounted(true); }, []);

useEffect(() => {
  if (Capacitor.isNativePlatform()) {
    GoogleAuth.initialize({
      clientId: '866114557322-neeln0vj5sa2rslac9h8dvfvvceaoina.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
      
    });
  }
}, []);

  // useEffect removed to avoid double-redirection conflict with manual sign-in flow


  if (!mounted || loading) {
    return (
      <div className="w-full min-h-[100dvh] bg-green-700 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-white border-t-transparent animate-spin"></div>
      </div>
    );
  }


  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      console.log('Attempting login for:', email);
      const result = await signIn(email, password);
      const signedInUser = result.data?.user;
      await fetch(getApiUrl('/api/analytics'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'login',
          userId: signedInUser?.id || null,
          userName: signedInUser?.name || null,
          userEmail: signedInUser?.email || email,
          pagePath: '/login',
          metadata: { method: 'email' },
        }),
      }).catch(() => {});
      console.log('Login successful, redirecting home...');

      console.log('Login successful, redirecting home...');
      // Force a hard redirection to reload app content and hydrate cookies
      window.location.replace('/');
    } catch (err: any) {
      console.error('Login Error:', err);
      setError(err.message || 'Invalid email or password.');
      setIsLoading(false);
    }
  };

const handleGoogleSignIn = async () => {
  setError('');
  setIsLoading(true);

  try {
    // 📱 MOBILE FLOW
    if (Capacitor.isNativePlatform()) {

      // 🔥 FORCE ACCOUNT PICKER EVERY TIME
      await GoogleAuth.signOut().catch(() => {});

      const user = await GoogleAuth.signIn();

      const idToken = user.authentication?.idToken;

      if (!idToken) {
        throw new Error('No ID token received');
      }

      // 🔥 send token to backend
      const res = await fetch(getApiUrl('/api/auth/mobile/google-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: idToken }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server error (HTTP ${res.status})`);
      }

      if (!data.success) {
        throw new Error(data.message || `Login failed (HTTP ${res.status})`);
      }

      if (data.user) {
        storeMobileSession(data.user);
        await fetch(getApiUrl('/api/analytics'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'login',
            userId: data.user.id || null,
            userName: data.user.name || null,
            userEmail: data.user.email || null,
            pagePath: '/login',
            metadata: { method: 'google_mobile' },
          }),
        }).catch(() => {});
      }

      if (data.signedToken) {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          'https://cofarmz-backend-866114557322.asia-south1.run.app';

        await CapacitorCookies.setCookie({
          url: backendUrl,
          key: 'cofarmz.session_token',
          value: data.signedToken,
        });
      }

      window.location.href = '/';
    }

    // 🌐 WEB FLOW
    else {
      const callbackURL = `${window.location.origin}/auth-callback`;

      // 🔥 ADD prompt=select_account FOR WEB
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL,
        errorCallbackURL: `${window.location.origin}/login`,
      });

      if (result.error) {
        throw new Error(result.error.message || 'Google sign-in could not be started.');
      }
    }
  } catch (err: any) {
    console.error('Google Sign-in Error:', err);
    setError(
      err.message ||
        'Google sign-in failed. Check your connection and try again.'
    );
    setIsLoading(false);
  }
};
  return (
    <div className="min-min-h-[100dvh] flex bg-gray-50">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-green-900 via-green-700 to-emerald-600 flex-col justify-between p-14 relative overflow-hidden">
        {/* Background circles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-white/5 rounded-full"></div>
          <div className="absolute top-1/2 -left-24 w-80 h-80 bg-white/5 rounded-full"></div>
          <div className="absolute -bottom-32 right-1/4 w-96 h-96 bg-black/10 rounded-full"></div>
          <div className="absolute bottom-1/4 -right-16 w-64 h-64 bg-emerald-400/10 rounded-full"></div>
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-4">
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

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-10">
          <h2 className="text-5xl font-black text-white leading-tight mb-4">
            Your Global<br />Farmer &amp;<br />Buyer Network
          </h2>
          <p className="text-green-100 text-lg font-medium mb-10">
            Growing Together, Selling Smarter.
          </p>

          <div className="space-y-4 mb-10">
            {[
              { icon: '🌾', text: 'Connect with nearby farmers & buyers worldwide' },
              { icon: '💰', text: 'Trade crops directly at fair prices' },
              { icon: '🚜', text: 'Rent equipment from nearby farmers & earn' },
              { icon: '🎬', text: 'Share farming knowledge through reels' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-4">
                <span className="w-10 h-10 rounded-2xl bg-white/15 border border-white/10 flex items-center justify-center text-xl flex-shrink-0 shadow-sm">{item.icon}</span>
                <span className="text-green-50 text-sm font-semibold">{item.text}</span>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* Right Panel — Form */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center items-center px-6 py-4 lg:py-12 bg-white min-h-[100dvh]">
        {/* Mobile logo — full branded header */}
        <div className="lg:hidden flex flex-col items-center gap-2 mb-6 mt-4">
          <div className="w-16 h-16 rounded-2xl bg-green-700 p-1.5 shadow-xl border-2 border-green-100">
            <img
              src="/assets/cofarmz-logo.png"
              alt="CoFarmz"
              className="w-full h-full rounded-xl object-cover"
            />
          </div>
          <div className="text-center">
            <span className="text-gray-900 font-black text-xl block">CoFarmz</span>
            <span className="text-gray-400 text-[10px] font-medium uppercase tracking-widest">Agri Network</span>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-6">
            <h1 className="text-2xl lg:text-3xl font-black text-gray-900 mb-1">Welcome back</h1>
            <p className="text-gray-500 text-xs lg:text-sm">Sign in to your CoFarmz account</p>
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

          <form onSubmit={handleSignIn} className="space-y-5">
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
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-semibold text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  className="text-xs font-semibold text-green-700 hover:text-green-800 transition"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Terms Checkbox */}
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
                I accept the{' '}
                <a href="/terms" target="_blank" className="text-green-700 font-semibold hover:underline">Terms & Conditions</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" className="text-green-700 font-semibold hover:underline">Privacy Policy</a>
              </label>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading || !email || !password || !agreedToTerms}
              className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-xl font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Signing in...</>
              ) : 'Sign in'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">or</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleSignIn}
              className={`w-full bg-white text-gray-700 py-3 rounded-xl font-semibold text-sm border border-gray-300 transition flex items-center justify-center gap-3 shadow-sm ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
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

          <p className="text-center text-sm text-gray-500 mt-8">
            Don&apos;t have an account?{' '}
            <button onClick={() => router.push('/signup')} className="text-green-700 font-semibold hover:text-green-800 transition">
              Create one free
            </button>
          </p>

          <div className="mt-8 p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm">
  <p className="text-green-50 text-sm mb-2">
    Not sure what CoFarmz is?
  </p>
  <a
    href="/about"
    className="inline-block text-white font-semibold text-sm hover:underline"
  >
    Explore About Us →
  </a>
</div>

          <div className="flex justify-center gap-6 mt-8 text-xs text-gray-400">
            <a href="/terms" className="hover:text-gray-600 transition">Terms of Service</a>
            <a href="/privacy" className="hover:text-gray-600 transition">Privacy Policy</a>
            <a href="/help" className="hover:text-gray-600 transition">Help</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="w-full min-h-[100dvh] bg-green-700 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-white border-t-transparent animate-spin"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
