'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      setIsValidToken(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(
          `/api/auth/verify-reset-token?token=${token}`,
          { method: 'GET' }
        );

        if (!response.ok) {
          setError('This reset link has expired. Please request a new one.');
          setIsValidToken(false);
          return;
        }

        setIsValidToken(true);
      } catch (err) {
        setError('Failed to verify reset link.');
        setIsValidToken(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/auth/reset-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidToken === null) {
    return (
      <div className="w-full h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600 text-sm font-medium">Verifying link...</p>
        </div>
      </div>
    );
  }

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
            <i className="ph-fill ph-lock text-3xl text-brand-600"></i>
          </div>
          <h1 className="text-3xl font-black text-gray-900 text-center mb-2">Set New Password</h1>
          <p className="text-sm text-gray-500 font-medium text-center max-w-xs">
            Create a new password for your account
          </p>
        </div>

        {/* Form Section */}
        {isValidToken ? (
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
                  <p className="text-sm text-green-800 font-bold mb-1">Password reset successfully</p>
                  <p className="text-xs text-green-700">Redirecting to login...</p>
                </div>
              </div>
            )}

            {!success && (
              <>
                {/* Password Input */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-900">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-4 bg-white border-2 border-gray-200 rounded-2xl focus:border-brand-500 focus:outline-none transition-all placeholder:text-gray-400 font-medium text-gray-900"
                    disabled={isLoading}
                    required
                  />
                  <p className="text-xs text-gray-400 font-medium">At least 8 characters</p>
                </div>

                {/* Confirm Password Input */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-900">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-4 bg-white border-2 border-gray-200 rounded-2xl focus:border-brand-500 focus:outline-none transition-all placeholder:text-gray-400 font-medium text-gray-900"
                    disabled={isLoading}
                    required
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !password || !confirmPassword}
                  className="w-full bg-brand-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand-600/30 hover:bg-brand-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                      Resetting...
                    </>
                  ) : (
                    <>
                      <i className="ph-bold ph-check text-lg"></i>
                      Reset Password
                    </>
                  )}
                </button>
              </>
            )}
          </form>
        ) : (
          <div className="w-full flex flex-col gap-4">
            <div className="bg-red-50 border border-red-200 rounded-[16px] p-4 flex gap-3">
              <i className="ph-fill ph-warning-circle text-red-500 text-lg flex-shrink-0 mt-0.5"></i>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
            <button
              onClick={() => router.push('/forgot-password')}
              className="w-full bg-brand-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand-600/30 hover:bg-brand-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <i className="ph-bold ph-arrow-left text-lg"></i>
              Request Another Reset Link
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-gray-600 text-center font-medium">
            Know your password?{' '}
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
            <p className="text-gray-600 text-sm font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
