'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';


function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [savedEquipment, setSavedEquipment] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const tab = searchParams.get('tab') || 'preferences';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, mounted, router]);

  const fetchSavedEquipment = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoadingSaved(true);
      setSavedEquipment([]);
      
      const url = getApiUrl(`/api/machinery/favorites`);
      const response = await fetch(url, {
        headers: { 'x-user-id': user.id }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setSavedEquipment(data?.favorites || []);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching saved equipment:', errorMsg);
      setSavedEquipment([]);
    } finally {
      setLoadingSaved(false);
    }
  }, [user?.id]);

  const handleRemoveFavorite = useCallback(async (machineryId: string) => {
    if (!user) return;
    try {
      await fetch(getApiUrl(`/api/machinery/${machineryId}/favorite`), {
        method: 'POST',
        headers: { 'x-user-id': user.id }
      });
      setSavedEquipment(prev => prev.filter(item => item.id !== machineryId));
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  }, [user]);

  useEffect(() => {
    if (tab === 'saved' && mounted && user?.id && isAuthenticated) {
      fetchSavedEquipment();
    }
  }, [tab, mounted, user?.id, isAuthenticated]);

  if (!mounted || loading || !isAuthenticated) {
    return (
      <div className="w-full min-h-[100dvh] bg-brand-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Personal Information Tab
  const renderPersonalInfo = () => (
    <section className="px-6 mb-6 relative z-10">
      <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-2">Personal Information</h3>
      <div className="bg-white rounded-[24px] shadow-soft overflow-hidden">
        <div className="p-4 border-b border-gray-100/60">
          <label className="text-xs font-bold text-gray-500 uppercase">Full Name</label>
          <input type="text" defaultValue={user?.name || ''} className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="p-4 border-b border-gray-100/60">
          <label className="text-xs font-bold text-gray-500 uppercase">Email</label>
          <input type="email" defaultValue={user?.email || ''} className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="p-4">
          <label className="text-xs font-bold text-gray-500 uppercase">Phone</label>
          <input type="tel" placeholder="+91 9999999999" className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>
      <button className="w-full mt-4 bg-brand-500 text-white rounded-[16px] p-3 font-bold text-sm active:scale-[0.98] transition-transform">Save Changes</button>
    </section>
  );

  // Payment Methods Tab
  const renderPaymentMethods = () => (
    <section className="px-6 mb-6 relative z-10">
      <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-2">Payment Methods</h3>
      <div className="bg-white rounded-[24px] shadow-soft overflow-hidden">
        <div className="p-4 border-b border-gray-100/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <i className="ph-bold ph-credit-card text-blue-600 text-lg"></i>
            </div>
            <div>
              <span className="font-bold text-sm text-gray-900">Visa Card</span>
              <span className="text-xs text-gray-400 font-medium">**** **** **** 4242</span>
            </div>
          </div>
          <i className="ph-bold ph-check-circle text-brand-500"></i>
        </div>
      </div>
      <button className="w-full mt-4 bg-gray-100 text-gray-900 rounded-[16px] p-3 font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
        <i className="ph-bold ph-plus"></i> Add Payment Method
      </button>
    </section>
  );

  // Farm Profile Tab
  const renderFarmProfile = () => (
    <section className="px-6 mb-6 relative z-10">
      <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-2">Farm Profile</h3>
      <div className="bg-white rounded-[24px] shadow-soft overflow-hidden">
        <div className="p-4 border-b border-gray-100/60">
          <label className="text-xs font-bold text-gray-500 uppercase">Farm Name</label>
          <input type="text" placeholder="Your Farm Name" className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="p-4 border-b border-gray-100/60">
          <label className="text-xs font-bold text-gray-500 uppercase">Farm Location</label>
          <input type="text" placeholder="Enter location" className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="p-4">
          <label className="text-xs font-bold text-gray-500 uppercase">Farm Description</label>
          <textarea placeholder="Describe your farm..." className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 h-24 resize-none"></textarea>
        </div>
      </div>
      <button className="w-full mt-4 bg-brand-500 text-white rounded-[16px] p-3 font-bold text-sm active:scale-[0.98] transition-transform">Save Farm Profile</button>
    </section>
  );

  // Saved Equipment Tab
  const renderSavedEquipment = () => (
    <section className="px-6 mb-6 relative z-10">
      <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-2">Saved Equipment</h3>
      {loadingSaved ? (
        <div className="bg-white rounded-[24px] shadow-soft overflow-hidden p-8 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-3 border-brand-200 border-t-brand-600 animate-spin"></div>
        </div>
      ) : savedEquipment.length === 0 ? (
        <div className="bg-white rounded-[24px] shadow-soft overflow-hidden">
          <div className="p-4 text-center text-gray-500">
            <i className="ph-bold ph-heart text-3xl text-gray-300 mb-2 block"></i>
            <p className="text-sm font-medium">No saved equipment yet</p>
            <p className="text-xs text-gray-400 mt-1">Equipment you save will appear here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {savedEquipment.map((machinery) => (
            <div key={machinery.id} className="bg-white rounded-[16px] shadow-soft p-4 flex gap-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push(`/machinery-details?id=${machinery.id}`)}>
              <div className="w-20 h-20 rounded-[12px] bg-gray-200 overflow-hidden flex-shrink-0">
                <img 
                  src={machinery.image_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Crect fill="%23e5e7eb" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="16" fill="%239ca3af"%3E%3C/text%3E%3C/svg%3E'} 
                  alt={machinery.name} 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Crect fill="%23e5e7eb" width="200" height="200"/%3E%3C/svg%3E';
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 text-sm truncate">{machinery.name}</h4>
                <p className="text-xs text-gray-500 mb-2">{machinery.model}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-brand-600">₹{machinery.daily_rate}/day</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFavorite(machinery.id);
                    }}
                    className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors active:scale-95"
                  >
                    <i className="ph-fill ph-heart text-lg"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <>
      <div className="pt-4 text-gray-800 relative min-min-h-[100dvh]" suppressHydrationWarning>
        <div className="ambient-glow"></div>

        {/* Header */}
        <header className="w-full px-6 pb-6 relative z-10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-gray-900 active:scale-95 transition-transform" onClick={() => router.push('/user-profile')}>
              <i className="ph-bold ph-arrow-left text-lg"></i>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {tab === 'preferences' ? 'Settings' : tab === 'personal-info' ? 'Personal Info' : tab === 'payment' ? 'Payment Methods' : tab === 'farm-profile' ? 'Farm Profile' : 'Saved Equipment'}
            </h1>
          </div>
        </header>

        {/* Tab Navigation */}
        {tab !== 'preferences' && (
          <div className="px-6 mb-4 relative z-10 flex gap-2 overflow-x-auto pb-2">
            <button onClick={() => router.push('/settings?tab=personal-info')} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${tab === 'personal-info' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Personal Info</button>
            <button onClick={() => router.push('/settings?tab=payment')} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${tab === 'payment' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Payment</button>
            <button onClick={() => router.push('/settings?tab=farm-profile')} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${tab === 'farm-profile' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Farm Profile</button>
            <button onClick={() => router.push('/settings?tab=saved')} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${tab === 'saved' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Saved</button>
          </div>
        )}

        {/* Render Content Based on Tab */}
        {tab === 'personal-info' && renderPersonalInfo()}
        {tab === 'payment' && renderPaymentMethods()}
        {tab === 'farm-profile' && renderFarmProfile()}
        {tab === 'saved' && renderSavedEquipment()}

        {/* Preferences Tab (Default) */}
        {tab === 'preferences' && (
          <>
            <section className="px-6 mb-6 relative z-10">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-2">Preferences</h3>
              <div className="bg-white rounded-[24px] shadow-soft overflow-hidden">
                <div className="w-full flex items-center justify-between p-4 border-b border-gray-100/60 active:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                      <i className="ph-fill ph-bell-ringing text-lg"></i>
                    </div>
                    <div>
                      <span className="font-bold text-sm text-gray-900 block">Push Notifications</span>
                      <span className="text-xs text-gray-400 font-medium">Alerts for rentals & messages</span>
                    </div>
                  </div>
                  <div className="w-11 h-6 bg-brand-500 rounded-full relative flex items-center px-0.5 shadow-inner transition-colors">
                    <div className="w-5 h-5 bg-white rounded-full translate-x-5 shadow-sm transition-transform"></div>
                  </div>
                </div>

                <div className="w-full flex items-center justify-between p-4 border-b border-gray-100/60 active:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#F4F5F0] flex items-center justify-center text-gray-600">
                      <i className="ph-bold ph-map-pin text-lg"></i>
                    </div>
                    <div>
                      <span className="font-bold text-sm text-gray-900 block">Location Services</span>
                      <span className="text-xs text-gray-400 font-medium">To find nearby equipment</span>
                    </div>
                  </div>
                  <div className="w-11 h-6 bg-brand-500 rounded-full relative flex items-center px-0.5 shadow-inner transition-colors">
                    <div className="w-5 h-5 bg-white rounded-full translate-x-5 shadow-sm transition-transform"></div>
                  </div>
                </div>

                <div className="w-full flex items-center justify-between p-4 border-b border-gray-100/60 active:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#F4F5F0] flex items-center justify-center text-gray-600">
                      <i className="ph-bold ph-globe text-lg"></i>
                    </div>
                    <span className="font-bold text-sm text-gray-900">Currency & Region</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">INR (IN)</span>
                    <i className="ph-bold ph-caret-right text-gray-400"></i>
                  </div>
                </div>
              </div>
            </section>

            <section className="px-6 mb-6 relative z-10">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-2">Security</h3>
              <div className="bg-white rounded-[24px] shadow-soft overflow-hidden">
                <div className="w-full flex items-center justify-between p-4 border-b border-gray-100/60 active:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#F4F5F0] flex items-center justify-center text-gray-600">
                      <i className="ph-bold ph-lock-key text-lg"></i>
                    </div>
                    <span className="font-bold text-sm text-gray-900">Change Password</span>
                  </div>
                  <i className="ph-bold ph-caret-right text-gray-400"></i>
                </div>

                <div className="w-full flex items-center justify-between p-4 active:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#F4F5F0] flex items-center justify-center text-gray-600">
                      <i className="ph-bold ph-fingerprint text-lg"></i>
                    </div>
                    <span className="font-bold text-sm text-gray-900">Face ID / Touch ID</span>
                  </div>
                  <div className="w-11 h-6 bg-gray-200 rounded-full relative flex items-center px-0.5 shadow-inner transition-colors">
                    <div className="w-5 h-5 bg-white rounded-full translate-x-0 shadow-sm transition-transform border border-gray-100"></div>
                  </div>
                </div>
              </div>
            </section>

            <section className="px-6 mb-6 relative z-10">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-2">About App</h3>
              <div className="bg-white rounded-[24px] shadow-soft overflow-hidden">
                <div className="w-full flex items-center justify-between p-4 border-b border-gray-100/60 active:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#F4F5F0] flex items-center justify-center text-gray-600">
                      <i className="ph-bold ph-file-text text-lg"></i>
                    </div>
                    <span className="font-bold text-sm text-gray-900">Terms of Service</span>
                  </div>
                  <i className="ph-bold ph-caret-right text-gray-400"></i>
                </div>

                <div className="w-full flex items-center justify-between p-4 active:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#F4F5F0] flex items-center justify-center text-gray-600">
                      <i className="ph-bold ph-shield-check text-lg"></i>
                    </div>
                    <span className="font-bold text-sm text-gray-900">Privacy Policy</span>
                  </div>
                  <i className="ph-bold ph-caret-right text-gray-400"></i>
                </div>
              </div>
            </section>

            <section className="px-6 relative z-10 flex flex-col items-center gap-4">
              <button className="w-full bg-red-50 text-red-600 rounded-[16px] p-4 shadow-sm flex items-center justify-center gap-2 font-bold text-sm active:scale-[0.98] transition-transform">
                <i className="ph-bold ph-trash text-lg"></i> Delete Account
              </button>

              <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase mt-4 mb-8">
                Version 2.4.1 (Build 492)
              </p>
            </section>
          </>
        )}
      </div>

    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
