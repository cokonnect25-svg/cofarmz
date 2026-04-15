'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApiUrl } from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsLoading(true);

    try {
      const response = await fetch(
        getApiUrl(`/api/auth/forgot-password`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to send reset email');
      }

      setSuccess(true);
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-brand-50 to-white relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-brand-100/30 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/20 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl pointer-events-none"></div>

      <div className="relative z-10 w-full h-screen flex flex-col justify-between px-6 py-8">
        {/* Header */}
        <div className="flex flex-col items-center pt-8">
          <button
            onClick={() => router.push('/login')}
            className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-gray-900 active:scale-95 transition-transform mb-6 self-start"
          >
            <i className="ph-bold ph-arrow-left text-lg"></i>
          </button>
          <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mb-4">
            <i className="ph-fill ph-envelope text-3xl text-brand-600"></i>
          </div>
          <h1 className="text-3xl font-black text-gray-900 text-center mb-2">Reset Password</h1>
          <p className="text-sm text-gray-500 font-medium text-center max-w-xs">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-[16px] p-4 flex gap-3">
              <i className="ph-fill ph-warning-circle text-red-500 text-lg flex-shrink-0 mt-0.5"></i>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-[16px] p-4 flex gap-3">
              <i className="ph-fill ph-check-circle text-green-600 text-lg flex-shrink-0 mt-0.5"></i>
              <div className="flex-1">
                <p className="text-sm text-green-800 font-bold mb-1">Check your email</p>
                <p className="text-xs text-green-700">
                  We've sent a password reset link to your email. Check your inbox and spam folder.
                </p>
              </div>
            </div>
          )}

          {!success ? (
            <>
              {/* Email Input */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-900">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-4 bg-white border-2 border-gray-200 rounded-2xl focus:border-brand-500 focus:outline-none transition-all placeholder:text-gray-400 font-medium text-gray-900"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-brand-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand-600/30 hover:bg-brand-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="ph-bold ph-paper-plane-tilt text-lg"></i>
                    Send Reset Link
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSuccess(false);
                setEmail('');
              }}
              className="w-full bg-brand-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand-600/30 hover:bg-brand-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <i className="ph-bold ph-arrow-counterclockwise text-lg"></i>
              Send Another Email
            </button>
          )}
        </form>

        {/* Footer */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-gray-600 text-center font-medium">
            Remember your password?{' '}
            <button
              onClick={() => router.push('/login')}
              className="text-brand-600 font-bold hover:text-brand-700 transition-colors"
            >
              Sign in
            </button>
          </p>

          <div className="flex gap-4 text-xs text-gray-400 font-medium text-center">
            <button className="hover:text-gray-600 transition-colors">Terms</button>
            <span>•</span>
            <button className="hover:text-gray-600 transition-colors">Privacy</button>
          </div>
        </div>
      </div>
    </div>
  );
}
