'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

function RentMachineryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'Tractor',
    year: '',
    power: '',
    description: '',
    daily_rate: '',
    contact_phone: '',
    location: '',
    latitude: '',
    longitude: '',
    available_now: true,
  });
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const locationSearchTimeout = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, mounted, router]);

  // Load equipment data if editing
  useEffect(() => {
    if (mounted) {
      const id = searchParams.get('id');
      if (id) {
        loadEquipmentData(id);
      }
    }
  }, [mounted, searchParams]);

  const loadEquipmentData = async (id: string) => {
    setIsLoadingEdit(true);
    setEditingId(id);
    try {
      const apiUrl = `/api/machinery/${id}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Failed to load equipment');
      const equipment = await response.json();

      setFormData({
        name: equipment.name || '',
        category: equipment.model || 'Tractor',
        year: equipment.year?.toString() || '',
        power: equipment.power || '',
        description: equipment.description || '',
        daily_rate: equipment.daily_rate?.toString() || '',
        contact_phone: equipment.contact_phone || '',
        location: equipment.location || '',
        latitude: equipment.latitude?.toString() || '',
        longitude: equipment.longitude?.toString() || '',
        available_now: true,
      });

      // Load existing images
      let existingImages: string[] = [];
      try {
        const raw = equipment.images;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) existingImages = parsed;
      } catch {}
      if (existingImages.length === 0 && equipment.image_url) {
        existingImages = [equipment.image_url];
      }
      setPhotos(existingImages);
    } catch (error) {
      console.error('Error loading equipment:', error);
      setSubmitError('Failed to load equipment data');
    } finally {
      setIsLoadingEdit(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (category: string) => {
    setFormData(prev => ({ ...prev, category }));
  };

  const handleToggleAvailable = () => {
    setFormData(prev => ({ ...prev, available_now: !prev.available_now }));
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setSubmitError('Geolocation not supported. Please type your location manually.');
      return;
    }
    setDetectingLocation(true);
    setSubmitError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          // Build short address: village/town/city + state
          const addr = data.address || {};
          const parts = [
            addr.village || addr.suburb || addr.town || addr.city_district || addr.city,
            addr.state_district || addr.county,
            addr.state,
          ].filter(Boolean);
          const locationName = parts.length > 0 ? parts.join(', ') : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
          setFormData(prev => ({ ...prev, location: locationName, latitude: lat.toString(), longitude: lon.toString() }));
        } catch {
          setFormData(prev => ({ ...prev, location: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, latitude: lat.toString(), longitude: lon.toString() }));
        } finally {
          setDetectingLocation(false);
        }
      },
      (err) => {
        setDetectingLocation(false);
        if (err.code === 1) {
          setSubmitError('Location permission denied. Please allow location in browser settings, or type your location manually.');
        } else if (err.code === 2) {
          setSubmitError('Location unavailable. Please type your location manually.');
        } else {
          setSubmitError('Location detection timed out. Please type your location manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleLocationInput = (value: string) => {
    setFormData(prev => ({ ...prev, location: value, latitude: '', longitude: '' }));
    setLocationSuggestions([]);
    if (locationSearchTimeout.current) clearTimeout(locationSearchTimeout.current);
    if (value.trim().length < 3) return;
    locationSearchTimeout.current = setTimeout(async () => {
      setLocationSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&addressdetails=1&limit=5&countrycodes=in`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        setLocationSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setLocationSuggestions([]);
      } finally {
        setLocationSearching(false);
      }
    }, 400);
  };

  const handleSelectLocationSuggestion = (item: any) => {
    const addr = item.address || {};
    const parts = [
      addr.village || addr.suburb || addr.town || addr.city_district || addr.city,
      addr.state_district || addr.county,
      addr.state,
    ].filter(Boolean);
    const locationName = parts.length > 0 ? parts.join(', ') : item.display_name;
    setFormData(prev => ({ ...prev, location: locationName, latitude: item.lat, longitude: item.lon }));
    setLocationSuggestions([]);
  };

  const handlePhotoCapture = async () => {
    try {
      setPhotoLoading(true);

      if (Capacitor.isNativePlatform()) {
        // Use native camera
        const image = await Camera.getPhoto({
          quality: 90,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Prompt,
        });

        if (image.dataUrl && photos.length < 5) {
          setPhotos([...photos, image.dataUrl]);
        }
      } else {
        // Web fallback: file input
        fileInputRef.current?.click();
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length && photos.length < 5; i++) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === 'string') {
          setPhotos(prev => {
            if (prev.length < 5) {
              return [...prev, event.target.result as string];
            }
            return prev;
          });
        }
      };
      reader.readAsDataURL(files[i]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Upload a single photo to R2 and return the public URL
  const uploadSinglePhoto = async (dataUrl: string, filename: string): Promise<string> => {
    const fetchRes = await fetch(dataUrl);
    const blob = await fetchRes.blob();
    const fd = new FormData();
    fd.append('file', blob, filename);
    const uploadRes = await fetch(`/api/upload`, { method: 'POST', body: fd });
    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Photo upload failed (${uploadRes.status}): ${err}`);
    }
    const data = await uploadRes.json();
    if (!data.url || !data.url.startsWith('http')) {
      throw new Error('Upload succeeded but no public URL returned from R2.');
    }
    return data.url;
  };

  // Upload ALL photos — skip already-uploaded URLs, only upload new data URLs
  const uploadAllPhotos = async (): Promise<{ imageUrl: string | null; images: string[] }> => {
    if (photos.length === 0) return { imageUrl: null, images: [] };
    const urls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      if (photo.startsWith('http')) {
        // Already uploaded — keep as-is
        urls.push(photo);
      } else {
        // New data URL — upload to R2
        const url = await uploadSinglePhoto(photo, `equipment-${i === 0 ? 'cover' : `photo-${i}`}.jpg`);
        urls.push(url);
      }
    }
    return { imageUrl: urls[0], images: urls };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    // Validate user is logged in
    if (!user?.id) {
      setSubmitError('You must be logged in to publish equipment');
      return;
    }

    // Validate required fields
    if (!formData.name.trim() || !formData.daily_rate.trim()) {
      setSubmitError('Please fill in equipment name and daily rate');
      return;
    }
    if (!formData.contact_phone.trim()) {
      setSubmitError('Mobile number is required. Renters need to contact you.');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Submitting form with user ID:', user.id);
      console.log('Form data:', formData);
      console.log('Editing ID:', editingId);
      
      const apiBaseUrl = '';

      // Step 1: Upload all photos to R2 FIRST (skips already-uploaded URLs)
      let imageUrl: string | null = null;
      let images: string[] = [];
      if (photos.length > 0) {
        setSubmitError('Uploading photos...');
        const uploaded = await uploadAllPhotos();
        imageUrl = uploaded.imageUrl;
        images = uploaded.images;
        setSubmitError(null);
      }

      if (editingId) {
        // UPDATE existing equipment
        const updateBody: any = {
          name: formData.name,
          model: formData.category,
          year: formData.year ? parseInt(formData.year) : null,
          power: formData.power || null,
          description: formData.description || null,
          daily_rate: parseFloat(formData.daily_rate),
          contact_phone: formData.contact_phone || null,
          // Always save current photos state (even if unchanged)
          image_url: imageUrl || null,
          images: images,
        };

        const res = await fetch(`${apiBaseUrl}/api/machinery/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Failed to update equipment' }));
          throw new Error(err.error || 'Failed to update equipment');
        }

        setSubmitSuccess(true);
        setTimeout(() => router.push('/user-profile?tab=equipment'), 2000);
      } else {
        // CREATE new equipment — include imageUrl from the start
        const res = await fetch(`${apiBaseUrl}/api/machinery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner_id: user.id,
            name: formData.name,
            model: formData.category,
            year: formData.year ? parseInt(formData.year) : null,
            power: formData.power || null,
            description: formData.description || null,
            daily_rate: parseFloat(formData.daily_rate),
            contact_phone: formData.contact_phone || null,
            image_url: imageUrl,
            images: images,
            location: formData.location || null,
            latitude: formData.latitude ? parseFloat(formData.latitude) : null,
            longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Failed to create listing' }));
          throw new Error(err.error || 'Failed to create listing');
        }

        setSubmitSuccess(true);
        setFormData({ name: '', category: 'Tractor', year: '', power: '', description: '', daily_rate: '', contact_phone: '', location: '', latitude: '', longitude: '', available_now: true });
        setPhotos([]);
        setTimeout(() => router.push('/user-profile'), 2000);
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Failed to publish listing');
      console.error('Submit error:', errorMessage);
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted || loading || !isAuthenticated) {
    return (
      <div className="w-full h-screen bg-brand-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Success message
  if (submitSuccess) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-green-50 to-brand-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6 bg-white rounded-[28px] p-10 shadow-lg max-w-sm mx-auto">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
            <i className="ph-bold ph-check text-5xl text-green-600"></i>
          </div>
          
          {/* Messages */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{editingId ? 'Equipment Updated!' : 'Equipment Listed!'}</h2>
            <p className="text-base text-gray-600 mb-1">{editingId ? 'Your changes have been saved' : 'Your equipment is now available for rent'}</p>
            <p className="text-sm text-gray-500 font-medium">{editingId ? 'Check your equipment list' : 'Check "Available Fleet" to see your listing'}</p>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-3 mt-4">
            <button
              onClick={() => router.push(editingId ? '/user-profile?tab=equipment' : '/machinery-list')}
              className="w-full bg-brand-800 text-white rounded-[16px] py-4 font-bold text-base shadow-md shadow-brand-800/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <i className={`ph-bold ${editingId ? 'ph-user' : 'ph-eye'}`}></i>
              {editingId ? 'Go to Equipment' : 'View in Fleet'}
            </button>
            <button
              onClick={() => router.push('/user-profile')}
              className="w-full bg-gray-100 text-gray-800 rounded-[16px] py-4 font-bold text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2 hover:bg-gray-200"
            >
              <i className="ph-bold ph-home text-lg"></i>
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pt-4 text-gray-800 relative min-h-screen pb-40 pb-20" suppressHydrationWarning>
        <div className="ambient-glow"></div>

        {/* Header */}
        <header className="w-full px-6 pb-6 relative z-10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-gray-900 active:scale-95 transition-transform" onClick={() => router.push(editingId ? '/user-profile?tab=equipment' : '/user-profile')}>
              <i className="ph-bold ph-arrow-left text-lg"></i>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{editingId ? 'Edit Equipment' : 'List Equipment'}</h1>
          </div>
          <button className="w-10 h-10 rounded-full bg-[#F4F5F0] flex items-center justify-center text-gray-400">
            <i className="ph-bold ph-question text-lg"></i>
          </button>
        </header>

        {/* Error Message */}
        {submitError && (
          <div className="mx-6 mb-6 bg-red-50 border border-red-200 rounded-[16px] p-4 flex items-start gap-3">
            <i className="ph-bold ph-warning text-red-600 text-lg flex-shrink-0 mt-0.5"></i>
            <div>
              <p className="text-sm font-bold text-red-900">Error</p>
              <p className="text-xs text-red-700">{submitError}</p>
            </div>
          </div>
        )}

        {/* Photo Upload Module */}
        <section className="px-6 mb-6 relative z-10">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-2">Photos</h3>
          <div className="bg-white rounded-[24px] p-4 shadow-soft">
            {photos.length === 0 ? (
              <button
                type="button"
                onClick={handlePhotoCapture}
                disabled={photoLoading}
                className="w-full h-40 border-2 border-dashed border-gray-200 rounded-[18px] flex flex-col items-center justify-center bg-[#F4F5F0]/50 text-gray-400 active:scale-[0.98] transition-transform cursor-pointer hover:bg-brand-50 hover:border-brand-200 hover:text-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-2 text-brand-600">
                  <i className="ph-bold ph-camera-plus text-xl"></i>
                </div>
                <span className="text-sm font-bold text-gray-700">Add Photos</span>
                <span className="text-[10px] font-medium text-gray-400 mt-0.5">Tap to take or upload (up to 5)</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative group">
                    <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-32 rounded-[16px] object-cover" />
                    {idx === 0 && <div className="absolute top-2 left-2 bg-brand-600 text-white text-[10px] font-bold px-2 py-1 rounded-[8px]">Cover</div>}
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                    >
                      <i className="ph-bold ph-x text-sm"></i>
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <button
                    type="button"
                    onClick={handlePhotoCapture}
                    disabled={photoLoading}
                    className="h-32 border-2 border-dashed border-gray-200 rounded-[16px] flex flex-col items-center justify-center bg-[#F4F5F0]/50 hover:bg-brand-50 hover:border-brand-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="ph-bold ph-plus text-2xl text-gray-400"></i>
                    <span className="text-[10px] font-bold text-gray-500 mt-1">{photos.length}/5</span>
                  </button>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </section>

        {/* Basic Info Form */}
        <section className="px-6 mb-6 relative z-10">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-2">Equipment Details</h3>
          <div className="bg-white rounded-[24px] shadow-soft p-5 flex flex-col gap-5">

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 ml-1">Title / Model Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full bg-[#F4F5F0] rounded-[16px] px-4 py-3.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-shadow placeholder:text-gray-400 placeholder:font-medium"
                placeholder="e.g. John Deere 8R 370"
              />
            </div>

            {/* Category Scroll */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 ml-1">Category</label>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1">
                {['Tractor', 'Harvester', 'Implement', 'Loader'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`px-5 py-2.5 rounded-[14px] text-xs font-bold whitespace-nowrap active:scale-95 transition-transform ${
                      formData.category === cat
                        ? 'bg-brand-800 text-white shadow-md shadow-brand-800/20'
                        : 'bg-[#F4F5F0] text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Specs Grid */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-700 mb-2 ml-1">Year</label>
                <div className="relative">
                  <input
                    type="number"
                    name="year"
                    value={formData.year}
                    onChange={handleInputChange}
                    className="w-full bg-[#F4F5F0] rounded-[16px] px-4 py-3.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-shadow placeholder:text-gray-400 placeholder:font-medium"
                    placeholder="2021"
                  />
                  <i className="ph-bold ph-calendar-blank absolute right-4 top-3.5 text-gray-400"></i>
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-700 mb-2 ml-1">Power (HP)</label>
                <div className="relative">
                  <input
                    type="number"
                    name="power"
                    value={formData.power}
                    onChange={handleInputChange}
                    className="w-full bg-[#F4F5F0] rounded-[16px] px-4 py-3.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-shadow placeholder:text-gray-400 placeholder:font-medium"
                    placeholder="370"
                  />
                  <i className="ph-bold ph-engine absolute right-4 top-3.5 text-gray-400"></i>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 ml-1">Description</label>
              <textarea
                rows={3}
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="w-full bg-[#F4F5F0] rounded-[16px] px-4 py-3.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-shadow placeholder:text-gray-400 resize-none"
                placeholder="Describe the condition, features, and any requirements for the renter..."
              ></textarea>
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 ml-1">Contact Mobile Number</label>
              <div className="relative">
                <i className="ph-bold ph-phone absolute left-4 top-3.5 text-gray-400"></i>
                <input
                  type="tel"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleInputChange}
                  className="w-full bg-[#F4F5F0] rounded-[16px] pl-10 pr-4 py-3.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-shadow placeholder:text-gray-400 placeholder:font-medium"
                  placeholder="+91 9876543210"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 ml-1">Equipment Location</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <i className="ph-bold ph-map-pin absolute left-4 top-3.5 text-gray-400 z-10"></i>
                  {locationSearching && (
                    <div className="absolute right-4 top-3.5 w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin z-10"></div>
                  )}
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={(e) => handleLocationInput(e.target.value)}
                    className="w-full bg-[#F4F5F0] rounded-[16px] pl-10 pr-4 py-3.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-shadow placeholder:text-gray-400 placeholder:font-medium"
                    placeholder="Type city or address..."
                    autoComplete="off"
                  />
                  {/* Suggestions dropdown */}
                  {locationSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-[16px] shadow-lg border border-gray-100 overflow-hidden z-50">
                      {locationSuggestions.map((item, i) => {
                        const addr = item.address || {};
                        const parts = [
                          addr.village || addr.suburb || addr.town || addr.city_district || addr.city,
                          addr.state_district || addr.county,
                          addr.state,
                        ].filter(Boolean);
                        const label = parts.length > 0 ? parts.join(', ') : item.display_name;
                        return (
                          <button
                            key={i}
                            type="button"
                            onMouseDown={() => handleSelectLocationSuggestion(item)}
                            onTouchEnd={() => handleSelectLocationSuggestion(item)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-gray-50 active:bg-gray-100 flex items-center gap-3 border-b border-gray-50 last:border-0"
                          >
                            <i className="ph ph-map-pin text-brand-600 flex-shrink-0"></i>
                            <span className="truncate">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={detectingLocation}
                  className="px-4 py-3 bg-brand-600 text-white rounded-[16px] font-bold text-xs whitespace-nowrap flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {detectingLocation ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <i className="ph-bold ph-navigation-arrow"></i>
                  )}
                  {detectingLocation ? 'Detecting...' : 'Detect'}
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* Pricing & Terms */}
        <section className="px-6 mb-8 relative z-10">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-2">Pricing & Terms</h3>
          <div className="bg-white rounded-[24px] shadow-soft p-5 flex flex-col gap-5">

            <div className="relative">
              <label className="block text-xs font-bold text-gray-700 mb-2 ml-1">Daily Rate</label>
              <div className="absolute left-4 top-[35px] text-gray-400 font-bold text-sm">₹</div>
              <input
                type="number"
                name="daily_rate"
                value={formData.daily_rate}
                onChange={handleInputChange}
                className="w-full bg-[#F4F5F0] rounded-[16px] pl-8 pr-4 py-3.5 text-base font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-shadow placeholder:text-gray-300"
                placeholder="0"
              />
              <div className="absolute right-4 top-[36px] text-xs font-bold text-gray-400 uppercase">/ Day</div>
            </div>

            <div className="w-full h-px bg-gray-100"></div>

            <button
              onClick={handleToggleAvailable}
              className="flex items-center justify-between p-3 bg-[#F4F5F0]/50 border border-gray-100 rounded-[16px] active:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-brand-600 shadow-sm">
                  <i className="ph-fill ph-check-circle text-lg"></i>
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-gray-900">Available Now</span>
                  <span className="block text-[10px] text-gray-500 font-medium">Ready for immediate rental</span>
                </div>
              </div>
              {/* Toggle */}
              <div className={`w-11 h-6 rounded-full relative flex items-center px-0.5 shadow-inner transition-colors ${formData.available_now ? 'bg-brand-500' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${formData.available_now ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </button>

          </div>
        </section>

        {/* Publish/Save Action */}
        <section className="px-6 mb-8 relative z-10">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoadingEdit}
            className="w-full bg-brand-800 text-white rounded-[16px] py-4 shadow-lg shadow-brand-800/30 active:scale-[0.98] transition-transform flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="font-bold text-base">{editingId ? 'Saving...' : 'Publishing...'}</span>
              </>
            ) : (
              <>
                <span className="font-bold text-base">{editingId ? 'Save Changes' : 'Publish Listing'}</span>
                <i className={`ph-bold ${editingId ? 'ph-floppy-disk' : 'ph-paper-plane-tilt'} text-lg`}></i>
              </>
            )}
          </button>
          <p className="text-[10px] text-center text-gray-400 mt-3 font-medium uppercase tracking-wide">{editingId ? 'Changes will be saved immediately' : 'Listing goes live immediately'}</p>
        </section>

      </div>

    </>
  );
}

export default function RentMachineryPage() {
  return (
    <Suspense>
      <RentMachineryContent />
    </Suspense>
  );
}
