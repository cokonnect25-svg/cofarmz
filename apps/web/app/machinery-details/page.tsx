'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';
import { isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';

interface BookedDateRange {
  start_date: string;
  end_date: string;
}

interface Machinery {
  id: string;
  name: string;
  model: string;
  year: number;
  power: string;
  drive: string;
  fuel: string;
  daily_rate: number;
  description: string;
  image_url: string;
  images: string[];
  location: string;
  owner_id: string;
  contact_phone: string;
}

function MachineryDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const machineryId = searchParams.get('id');
  const source = searchParams.get('source') || 'machinery-list';
  const { isAuthenticated, loading, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isReserving, setIsReserving] = useState(false);
  const [bookedDates, setBookedDates] = useState<BookedDateRange[]>([]);
  const [availabilityError, setAvailabilityError] = useState('');
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [expandDescription, setExpandDescription] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [machinery, setMachinery] = useState<Machinery | null>(null);
  const [loadingMachinery, setLoadingMachinery] = useState(true);
  const [ownerName, setOwnerName] = useState('Farm Owner');
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [loadingOwnerProfile, setLoadingOwnerProfile] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reservationId, setReservationId] = useState<number | null>(null);
  const [userBookedMachinery, setUserBookedMachinery] = useState(false);
  const [userPendingBooking, setUserPendingBooking] = useState<any | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<{ totalDays: number; totalPrice: number; startDate: string; endDate: string } | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [renterPhone, setRenterPhone] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const today = new Date().toISOString().split('T')[0];


  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, mounted, router]);

  // Fetch machinery details
  useEffect(() => {
    if (mounted && machineryId) {
      fetchMachineryDetails();
    }
  }, [mounted, machineryId]);

  useEffect(() => {
    if (mounted && user?.id && machinery?.owner_id) {
      fetchOwnerProfile(machinery.owner_id);
    }
  }, [mounted, user?.id, machinery?.owner_id]);

  // Fetch booked dates when machinery ID changes
  useEffect(() => {
    if (machinery?.id) {
      fetchBookedDates();
      fetchReviews();
    }
  }, [machinery?.id]);

  // Fetch favorite status
  useEffect(() => {
    if (mounted && user && machineryId) {
      checkFavoriteStatus();
      checkIfBookingExists();
    }
  }, [mounted, user, machineryId]);

  // Check if user has a completed booking for this machinery
  const checkIfBookingExists = async () => {
    if (!user || !machineryId) return;
    try {
      const response = await fetch(
        getApiUrl(`/api/reservations?user_id=${user.id}`)
      );
      if (response.ok) {
        const data = await response.json();
        // Check for pending booking on this machine
        const pendingBooking = data.find((r: any) =>
          r.machinery_id === machineryId &&
          r.user_id === user.id &&
          r.status === 'pending'
        );
        setUserPendingBooking(pendingBooking || null);

        // Filter for this specific machinery AND check that it belongs to current user AND has accepted status
        const completedBooking = data.find((r: any) =>
          r.machinery_id === machineryId &&
          r.user_id === user.id &&
          r.status === 'accepted'
        );
        
        if (completedBooking) {
          setReservationId(completedBooking.id);
          setUserBookedMachinery(true);
          const reviewResponse = await fetch(
            getApiUrl(`/api/reviews?reservation_id=${completedBooking.id}`)
          );
          if (reviewResponse.ok) {
            const reviews = await reviewResponse.json();
            const existingReview = reviews.find((r: any) => r.user_id === user.id);
            if (existingReview) {
              setReviewRating(existingReview.rating);
              setReviewText(existingReview.review_text || '');
            }
          }
        } else {
          setUserBookedMachinery(false);
        }
      }
    } catch (error) {
      console.error('Error checking booking:', error);
      setUserBookedMachinery(false);
    }
  };

 const fetchMachineryDetails = async () => {
  try {
    setLoadingMachinery(true);
    // Reset all state on fresh load
    setStartDate('');
    setEndDate('');
    setAvailabilityError('');
    setActiveImageIndex(0);
    setExpandDescription(false);
    setShowCalendar(false);

    const response = await fetch(getApiUrl(`/api/machinery/${machineryId}`));
    if (response.ok) {
      const data = await response.json();
      setMachinery(data);

      const userResponse = await fetch(getApiUrl(`/api/users/${data.owner_id}`));
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setOwnerName(userData.name || 'Farm Owner');
      }

      fetchOwnerProfile(data.owner_id);
    }
  } catch (error) {
    console.error('Error fetching machinery details:', error);
  } finally {
    setLoadingMachinery(false);
  }
};
  const fetchOwnerProfile = async (ownerId: string) => {
    try {
      setLoadingOwnerProfile(true);
      const response = await fetch(
        getApiUrl(`/api/farmers/profile?farmerId=${ownerId}${user?.id ? `&currentUserId=${encodeURIComponent(user.id)}` : ''}`),
        user?.id ? { headers: { 'x-user-id': user.id } } : undefined
      );
      if (response.ok) {
        const data = await response.json();
        setOwnerProfile(data);
      }
    } catch (error) {
      console.error('Error fetching owner profile:', error);
    } finally {
      setLoadingOwnerProfile(false);
    }
  };

  const fetchBookedDates = async () => {
    try {
      const response = await fetch(
        getApiUrl(`/api/machinery/${machinery?.id}/availability`)
      );
      if (response.ok) {
        const data = await response.json();
        setBookedDates(data.booked_dates || []);
      }
    } catch (error) {
      console.error('Error fetching booked dates:', error);
    }
  };

  const fetchReviews = async () => {
    if (!machineryId) return;
    try {
      setLoadingReviews(true);
      const response = await fetch(
        getApiUrl(`/api/reviews?machinery_id=${machineryId}`)
      );
      if (response.ok) {
        const data = await response.json();
        setReviews(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const checkFavoriteStatus = async () => {
    try {
      const response = await fetch(
        getApiUrl(`/api/machinery/${machineryId}/favorite`),
        {
          method: 'GET',
          headers: { 'x-user-id': user?.id || '' }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setIsFavorited(data.is_favorited);
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  const handleFavorite = async () => {
    if (!user) return;

    try {
      const response = await fetch(
        getApiUrl(`/api/machinery/${machineryId}/favorite`),
        {
          method: 'POST',
          headers: { 'x-user-id': user.id }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setIsFavorited(data.favorited);
      }
    } catch (error) {
      console.error('Error updating favorite:', error);
    }
  };

  const handleSubmitReview = async () => {
    if (!user || !reservationId || reviewRating === 0) {
      alert('Please provide a rating');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const response = await fetch(getApiUrl(`/api/reviews`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          machinery_id: machineryId,
          reservation_id: reservationId,
          rating: reviewRating,
          review_text: reviewText,
        }),
      });

      if (response.ok) {
        alert('Review submitted successfully!');
        setShowReviewModal(false);
        setReviewRating(0);
        setReviewText('');
        await fetchReviews();
      } else {
        alert('Failed to submit review. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Error submitting review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const getConflictingBookings = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    return bookedDates.filter((booking) => {
      const bookingStart = new Date(booking.start_date);
      const bookingEnd = new Date(booking.end_date);
      return !(endDate < bookingStart || startDate > bookingEnd);
    });
  };

  const checkDateAvailability = async (start: string, end: string) => {
    setIsCheckingAvailability(true);
    setAvailabilityError('');
    try {
      const response = await fetch(
        getApiUrl(`/api/machinery/${machinery?.id}/availability`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_date: start, end_date: end }),
        }
      );
      const data = await response.json();

      if (!data.available) {
        const conflicting = getConflictingBookings(start, end);
        setAvailabilityError(
          `This equipment is already booked for your selected dates. Unavailable: ${conflicting
            .map(
              (b: any) =>
                `${new Date(b.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - ${new Date(b.end_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`
            )
            .join(', ')}`
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailabilityError('Failed to check availability. Please try again.');
      return false;
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const calculateDays = (start: string, end: string) => {
    const startD = new Date(start);
    const endD = new Date(end);
    const diffTime = Math.abs(endD.getTime() - startD.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  };

  const dailyRate = machinery?.daily_rate || 450;
  const machineryId_ = machinery?.id || '';
  const machineryName = machinery?.name || 'Equipment';
  const ownerId = machinery?.owner_id || '';
  const fullDescription = machinery?.description || 'Premium quality equipment for rent.';
  const ownerCanCall = Boolean(ownerProfile?.can_call);
  const ownerRawPhone = machinery?.contact_phone || ownerProfile?.phone || '';
  const ownerHasPhone = Boolean(ownerRawPhone || ownerProfile?.has_phone);
  const ownerCallPhone = ownerCanCall && ownerRawPhone ? normalizePhoneNumber(ownerRawPhone) : null;
  const ownerCallUnavailableMessage = !ownerProfile
    ? 'Owner profile is still loading. Please try again.'
    : !ownerHasPhone
    ? 'Phone number is not available.'
    : !ownerProfile.calling_enabled
    ? 'This owner has disabled calls.'
    : ownerProfile?.followStatus === 'pending'
    ? 'Your follow request must be accepted before you can call.'
    : !ownerProfile?.isFollowing && user?.id !== ownerId
    ? 'Follow this owner and wait for acceptance before calling.'
    : 'Phone number not available for this equipment.';

  const totalDays = calculateDays(startDate, endDate);
  const totalPrice = totalDays * dailyRate;

  const trackOwnerCall = (sourceName: string) => {
    fetch(getApiUrl('/api/analytics'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'call_contact',
        userId: user?.id || null,
        userName: user?.name || null,
        userEmail: user?.email || null,
        pagePath: `/machinery-details?id=${machineryId_}`,
        entityType: 'user',
        entityId: ownerId,
        entityName: ownerProfile?.name || ownerName,
        metadata: {
          source: sourceName,
          machinery_id: machineryId_,
          machinery_name: machineryName,
        },
      }),
    }).catch(() => {});
  };

  const handleReserve = async () => {
    if (!user) return;

    const isAvailable = await checkDateAvailability(startDate, endDate);
    if (!isAvailable) return;
    
    setIsReserving(true);
    try {
      const response = await fetch(getApiUrl(`/api/reservations`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          owner_id: ownerId,
          machinery_id: machineryId_,
          machinery_name: machineryName,
          start_date: startDate,
          end_date: endDate,
          total_days: totalDays,
          daily_rate: dailyRate,
          total_price: totalPrice,
          renter_phone: normalizePhoneNumber(renterPhone) || null,
        }),
      });

      if (response.ok) {
        setShowDatePicker(false);
        await fetchBookedDates();
        setBookingDetails({ totalDays, totalPrice, startDate, endDate });
        setShowBookingSuccess(true);
      } else {
        alert('Failed to send booking request. Please try again.');
      }
    } catch (error) {
      console.error('Reservation error:', error);
      alert('Error sending booking request. Please try again.');
    } finally {
      setIsReserving(false);
    }
  };

  if (!mounted || loading || !isAuthenticated || loadingMachinery) {
    return (
      <div className="w-full min-h-[100dvh] bg-brand-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const isDateBooked = (date: string): boolean => {
    const checkDate = new Date(date);
    return bookedDates.some((booking) => {
      const start = new Date(booking.start_date);
      const end = new Date(booking.end_date);
      return checkDate >= start && checkDate <= end;
    });
  };

 const getNextAvailableDates = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  
  // Find next available start date
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + i);
    if (!isDateBooked(checkDate.toISOString().split('T')[0])) {
      startDate = checkDate;
      break;
    }
  }
  
  // Find next available end date (3 days after start by default)
  if (startDate) {
    let consecutiveDays = 0;
    for (let i = 1; i <= 30; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + i);
      if (!isDateBooked(checkDate.toISOString().split('T')[0])) {
        consecutiveDays++;
        if (consecutiveDays >= 3) {
          endDate = checkDate;
          break;
        }
      } else {
        consecutiveDays = 0;
      }
    }
    // If no 3 consecutive days found, just set 1 day
    if (!endDate) {
      endDate = startDate;
    }
  }
  
  return { startDate, endDate };
};

  {/*const renderCalendar = () => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    const days = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 0; i < 90; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const isBooked = isDateBooked(dateStr);
      const isSelected = dateStr === startDate || dateStr === endDate;
      const isInRange = startDate && endDate && new Date(dateStr) > new Date(startDate) && new Date(dateStr) < new Date(endDate);
      
      days.push(
        <div key={dateStr} className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] font-medium text-gray-400 uppercase">
            {monthNames[date.getMonth()]}
          </span>
          <button
            onClick={() => {
              if (isBooked && dateStr !== startDate && dateStr !== endDate) return;
              if (startDate && !endDate) {
                const start = new Date(startDate);
                const current = new Date(dateStr);
                if (current < start) {
                  setStartDate(dateStr);
                  setEndDate('');
                } else {
                  setEndDate(dateStr);
                }
              } else if (startDate && endDate) {
                setStartDate(dateStr);
                setEndDate('');
              } else {
                setStartDate(dateStr);
              }
            }}
            disabled={isBooked && dateStr !== startDate && dateStr !== endDate}
            className={`w-8 h-8 rounded-lg font-bold text-xs transition-all ${
              isSelected
                ? 'bg-brand-600 text-white shadow-md'
                : isInRange
                ? 'bg-brand-100 text-brand-700'
                : isBooked
                ? 'bg-red-100 text-red-600 cursor-not-allowed opacity-50'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {date.getDate()}
          </button>
          {isBooked && <span className="text-[7px] font-bold text-red-500 uppercase">Booked</span>}
        </div>
      );
    }
    
    return days;
  };*/}

  return (
    <>
      <div className="pt-4 text-gray-800 relative flex flex-col min-h-0">
        <div className="ambient-glow"></div>

        <header className="w-full px-6 pb-4 relative z-10 flex justify-between items-center">
          <button 
            className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-gray-900 active:scale-95 transition-transform" 
            onClick={() => {
              if (source === 'top-picks') {
                router.push('/top-picks');
              } else {
                router.push('/machinery-list');
              }
            }}
          >
            <i className="ph-bold ph-arrow-left text-lg"></i>
          </button>
          <button 
            onClick={handleFavorite}
            className="relative w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center active:scale-95 transition-all"
          >
            <i className={`ph-bold ph-heart text-lg ${isFavorited ? 'text-red-500 ph-fill' : 'text-gray-400'}`}></i>
          </button>
        </header>

        <section className="px-0 mb-2 relative z-10">
          {(() => {
            let rawImages = machinery?.images;
            if (typeof rawImages === 'string') {
              try { rawImages = JSON.parse(rawImages); } catch { rawImages = []; }
            }
            const allImages: string[] = Array.isArray(rawImages) && rawImages.length > 0
              ? rawImages
              : machinery?.image_url ? [machinery.image_url] : [];

            if (allImages.length === 0) return (
              <div className="relative w-full bg-gray-100 flex flex-col items-center justify-center gap-3" style={{aspectRatio:'16/9'}}>
                <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-400 text-sm font-medium">No image uploaded</p>
              </div>
            );

            return (
              <div>
                {/* Main swipeable image */}
                <div
                  className="relative w-full bg-gray-900 overflow-hidden"
                  style={{aspectRatio:'16/9'}}
                  onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
                  onTouchEnd={(e) => {
                    const diff = touchStartX - e.changedTouches[0].clientX;
                    if (Math.abs(diff) > 40) {
                      if (diff > 0) setActiveImageIndex(i => (i + 1) % allImages.length);
                      else setActiveImageIndex(i => (i - 1 + allImages.length) % allImages.length);
                    }
                  }}
                >
                  <img
                    src={allImages[activeImageIndex]}
                    alt={`${machinery?.name || 'Equipment'} ${activeImageIndex + 1}`}
                    className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {allImages.length > 1 && (
                    <>
                      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        {activeImageIndex + 1}/{allImages.length}
                      </div>
                      {/* Dot indicators */}
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                        {allImages.map((_, i) => (
                          <div key={i} className={`rounded-full transition-all duration-200 ${i === activeImageIndex ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`} />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Thumbnail horizontal scroll strip */}
                {allImages.length > 1 && (
                  <div
                    className="flex gap-2 px-3 py-2.5 bg-gray-900 overflow-x-scroll"
                    style={{scrollbarWidth:'none', WebkitOverflowScrolling:'touch'} as React.CSSProperties}
                  >
                    {allImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImageIndex(i)}
                        style={{flexShrink:0, width:64, height:64}}
                        className={`rounded-xl overflow-hidden border-2 transition-all duration-150 ${i === activeImageIndex ? 'border-white opacity-100' : 'border-transparent opacity-50'}`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </section>

        <section className="px-6 mb-6 relative z-10">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider mb-1 block">{machinery?.model || 'Equipment'}</span>
              <h1 className="text-3xl font-black text-gray-900 leading-tight">{machinery?.name || 'Equipment'}</h1>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-3 pb-5 border-b border-gray-200/60">
            <div className="flex gap-4 text-sm text-gray-500 font-medium">
            </div>
            
            <div className="text-right">
              <span className="text-2xl font-black text-brand-800">₹{machinery?.daily_rate || '0'}</span>
              <span className="text-[10px] font-medium text-gray-500 uppercase block">/ day</span>
            </div>
          </div>
        </section>

        <section className="mb-6 relative z-10">
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pl-6 pr-6 pb-2">
            {machinery?.power && (
              <div className="min-w-[100px] bg-white rounded-[16px] p-4 shadow-soft flex flex-col items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                  <i className="ph-bold ph-engine"></i>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-medium uppercase block">Power</span>
                  <span className="text-sm font-bold text-gray-900">{machinery.power}</span>
                </div>
              </div>
            )}

            {machinery?.year && (
              <div className="min-w-[100px] bg-white rounded-[16px] p-4 shadow-soft flex flex-col items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                  <i className="ph-bold ph-calendar-blank"></i>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-medium uppercase block">Year</span>
                  <span className="text-sm font-bold text-gray-900">{machinery.year}</span>
                </div>
              </div>
            )}

            {machinery?.drive && (
              <div className="min-w-[100px] bg-white rounded-[16px] p-4 shadow-soft flex flex-col items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                  <i className="ph-bold ph-steering-wheel"></i>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-medium uppercase block">Drive</span>
                  <span className="text-sm font-bold text-gray-900">{machinery.drive}</span>
                </div>
              </div>
            )}

            {machinery?.fuel && (
              <div className="min-w-[100px] bg-white rounded-[16px] p-4 shadow-soft flex flex-col items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                  <i className="ph-bold ph-gas-pump"></i>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-medium uppercase block">Fuel</span>
                  <span className="text-sm font-bold text-gray-900">{machinery.fuel}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Reviews Display Section */}
        {reviews.length > 0 && (
          <section className="px-6 mb-8 relative z-10">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Customer Reviews ({reviews.length})</h3>
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-[16px] p-4 shadow-soft border border-gray-100">
                  <div 
                    className="flex items-start gap-3 mb-3 cursor-pointer hover:bg-gray-50/50 p-1 -m-1 rounded-xl transition-all active:scale-[0.98]"
                    onClick={() => router.push(`/farmer-profile?id=${review.user_id}`)}
                  >
                    <img
                      src={review.reviewer_image }
                      alt={review.reviewer_name}
                      className="w-10 h-10 rounded-full object-cover bg-gray-100 shadow-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 text-sm hover:text-brand-600 transition-colors">{review.reviewer_name || 'Anonymous User'}</h4>
                      <div className="flex items-center gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <i
                            key={i}
                            className={`ph-${i < review.rating ? 'fill' : 'bold'} ph-star text-sm ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                          ></i>
                        ))}
                        <span className="text-xs text-gray-500 ml-1.5 font-medium">
                          {new Date(review.created_at).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {review.review_text && (
                    <p className="text-sm text-gray-600 leading-relaxed">{review.review_text}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Review Section - Show only if current user booked this machinery */}
        {userBookedMachinery && reservationId && (
          <section className="px-6 mb-8 relative z-10">
            <button
              onClick={() => setShowReviewModal(true)}
              className="w-full bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-[16px] py-4 font-bold shadow-lg shadow-amber-400/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <i className="ph-bold ph-star text-lg"></i>
              {reviewRating > 0 ? 'Edit Your Review' : 'Leave a Review'}
            </button>
          </section>
        )}

        {/* Owner / Lessor Info */}
        <section className="px-6 mb-8 relative z-10">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Rented by</h3>
          
          {loadingOwnerProfile ? (
            <div className="bg-white rounded-[20px] p-4 shadow-soft flex items-center justify-center h-24">
              <div className="w-6 h-6 rounded-full border-3 border-brand-200 border-t-brand-600 animate-spin"></div>
            </div>
          ) : ownerProfile ? (
            <div className="bg-white rounded-[24px] p-5 shadow-soft hover:shadow-lg transition-shadow cursor-pointer active:scale-[0.98]" onClick={() => router.push(`/farmer-profile?id=${ownerId}`)}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                  <img
                    src={ownerProfile.image || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + ownerId}
                    alt={ownerProfile.name}
                    className="w-12 h-12 rounded-full object-cover bg-gray-100"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{ownerProfile.name || ownerName}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <i className="ph-fill ph-check-circle text-brand-500"></i> Verified Partner
                    </p>
                  </div>
                </div>
                <i className="ph-bold ph-arrow-right text-gray-400 text-lg"></i>
              </div>

              <div className="flex gap-3 mb-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/farmer-profile?id=${ownerId}&tab=followers`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors active:scale-95"
                >
                  <i className="ph-bold ph-user-circle text-brand-600 text-sm"></i>
                  <span className="text-xs font-bold text-gray-900">{ownerProfile.followers_count || 0} Followers</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/farmer-profile?id=${ownerId}&tab=following`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors active:scale-95"
                >
                  <i className="ph-bold ph-user-check text-blue-600 text-sm"></i>
                  <span className="text-xs font-bold text-gray-900">{ownerProfile.following_count || 0} Following</span>
                </button>
              </div>

              {ownerProfile.location && (
                <p className="text-xs text-gray-600 mb-4 flex items-center gap-2">
                  <i className="ph-fill ph-map-pin text-brand-600"></i>
                  {ownerProfile.location}
                </p>
              )}

              <div className="flex gap-3 mb-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/farmer-profile?id=${ownerId}&tab=crops`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-50 rounded-lg hover:bg-green-100 transition-colors active:scale-95"
                >
                  <i className="ph-bold ph-plant text-green-600 text-sm"></i>
                  <span className="text-xs font-bold text-gray-900">{ownerProfile.crops_count || 0} Crops</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/farmer-profile?id=${ownerId}&tab=equipment`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors active:scale-95"
                >
                  <i className="ph-bold ph-wrench text-blue-600 text-sm"></i>
                  <span className="text-xs font-bold text-gray-900">{ownerProfile.equipments_count || 0} Equipment</span>
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (ownerCallPhone) {
                      trackOwnerCall('machinery_details');
                      window.location.href = `tel:${ownerCallPhone}`;
                    } else {
                      alert(ownerCallUnavailableMessage);
                    }
                  }}
                  className={`flex-1 rounded-[12px] py-3 font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform ${
                    ownerCallPhone
                      ? 'bg-green-50 hover:bg-green-100 text-green-700'
                      : 'bg-gray-50 text-gray-400 border border-gray-100'
                  }`}
                >
                  <i className="ph-bold ph-phone text-lg"></i>
                  <span className="text-sm">Call</span>
                </button>
                <button 
                  onClick={() => router.push(`/messages?ownerId=${ownerId}&machineryId=${machineryId_}&ownerName=${encodeURIComponent(ownerProfile?.name || ownerName)}`)}
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-[12px] py-3 font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <i className="ph-bold ph-chat-circle-text text-lg"></i>
                  <span className="text-sm">Chat</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const lat = ownerProfile.latitude;
                    const lon = ownerProfile.longitude;
                    const loc = ownerProfile.location;
                    if (lat && lon) {
                      window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
                    } else if (loc) {
                      window.open(`https://www.google.com/maps/search/${encodeURIComponent(loc)}`, '_blank');
                    } else {
                      alert('This user has not set a location yet.');
                    }
                  }}
                  className="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-[12px] py-3 font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <i className="ph-bold ph-directions text-lg"></i>
                  <span className="text-sm">Maps</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[20px] p-4 shadow-soft mb-4 cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98]" onClick={() => router.push(`/farmer-profile?id=${ownerId}`)}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                  <img 
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 150'%3E%3Crect fill='%23e5e7eb' width='150' height='150'/%3E%3Ccircle cx='75' cy='50' r='20' fill='%239ca3af'/%3E%3Cpath d='M 50 85 Q 75 75 100 85 L 100 150 L 50 150 Z' fill='%239ca3af'/%3E%3C/svg%3E" 
                    alt="Owner" 
                    className="w-12 h-12 rounded-full object-cover" 
                  />
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{ownerName}</h4>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <i className="ph-fill ph-check-circle text-brand-500"></i> Verified Partner
                    </p>
                  </div>
                </div>
                <i className="ph-bold ph-arrow-right text-gray-400 text-lg"></i>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (ownerCallPhone) {
                      trackOwnerCall('machinery_owner_card');
                      window.location.href = `tel:${ownerCallPhone}`;
                    } else {
                      alert(ownerCallUnavailableMessage);
                    }
                  }}
                  className={`flex-1 rounded-[12px] py-3 font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform ${
                    ownerCallPhone
                      ? 'bg-green-50 hover:bg-green-100 text-green-700'
                      : 'bg-gray-50 text-gray-400 border border-gray-100'
                  }`}
                >
                  <i className="ph-bold ph-phone text-lg"></i>
                  <span className="text-sm">Call</span>
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/chat/${ownerId}?machineryId=${machineryId_}`);
                  }}
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-[12px] py-3 font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <i className="ph-bold ph-chat-circle-text text-lg"></i>
                  <span className="text-sm">Chat</span>
                </button>
                <button
                  onClick={() => {
                    const lat = ownerProfile?.latitude;
                    const lon = ownerProfile?.longitude;
                    const loc = machinery?.location || ownerProfile?.location;
                    if (lat && lon) {
                      window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
                    } else if (loc) {
                      window.open(`https://www.google.com/maps/search/${encodeURIComponent(loc)}`, '_blank');
                    } else {
                      alert('This user has not set a location yet.');
                    }
                  }}
                  className="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-[12px] py-3 font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <i className="ph-bold ph-directions text-lg"></i>
                  <span className="text-sm">Maps</span>
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="px-6 mb-8 relative z-10">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Description</h3>
          <div className={`text-sm text-gray-600 leading-relaxed font-medium ${!expandDescription ? 'line-clamp-2' : ''}`}>
            {fullDescription}
          </div>
          <button 
            onClick={() => setExpandDescription(!expandDescription)}
            className="text-brand-600 font-bold mt-2 text-sm active:opacity-70 transition-opacity">
            {expandDescription ? 'Show less' : 'Read more'}
          </button>
        </section>

        <section className="px-6 mb-8 relative z-10">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Pickup Location</h3>
          {(() => {
            const locationStr = machinery?.location || ownerProfile?.location || null;
            return (
              <button
                onClick={() => {
                  if (locationStr) {
                    window.open(`https://www.google.com/maps/search/${encodeURIComponent(locationStr)}`, '_blank');
                  }
                }}
                className={`w-full bg-white rounded-[20px] p-4 shadow-soft flex items-start gap-4 hover:shadow-lg transition-shadow active:scale-[0.98] ${locationStr ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="w-12 h-12 rounded-[12px] bg-brand-50 flex items-center justify-center flex-shrink-0 text-brand-600">
                  <i className="ph-fill ph-map-pin-line text-2xl"></i>
                </div>
                <div className="text-left flex-1">
                  <h4 className="font-bold text-gray-900 text-sm">{locationStr || 'Location not set'}</h4>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">
                    {locationStr ? 'Tap to open in Google Maps' : 'Owner has not added a location yet'}
                  </p>
                  {locationStr && (
                    <div className="mt-2 text-xs font-bold text-brand-700 flex items-center gap-1">
                      <i className="ph-bold ph-directions text-sm"></i> Get Directions
                    </div>
                  )}
                </div>
                {locationStr && <i className="ph-bold ph-arrow-up-right text-brand-600 flex-shrink-0 text-lg"></i>}
              </button>
            );
          })()}
        </section>

        <section className="px-6 relative z-10">
  <div className="bg-white rounded-[24px] p-5 shadow-soft border border-gray-100">
    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
      <i className="ph-bold ph-calendar-check text-brand-600"></i> Availability
    </h3>

    {/* 30-day Calendar — always visible */}
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-gray-700">Next 30 Days</h4>
        <button
          onClick={() => {
            const next = getNextAvailableDates();
            if (next.startDate) setStartDate(next.startDate.toISOString().split('T')[0]);
            if (next.endDate) setEndDate(next.endDate.toISOString().split('T')[0]);
          }}
          className="text-xs text-brand-600 font-bold px-3 py-1.5 rounded-lg bg-brand-50 active:scale-95 transition-transform"
        >
          Next Available
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 hide-scrollbar">
        {Array.from({ length: 30 }).map((_, i) => {
          const date = new Date();
          date.setHours(0, 0, 0, 0);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          const booked = isDateBooked(dateStr);
          const isStart = dateStr === startDate;
          const isEnd = dateStr === endDate;
          const inRange = startDate && endDate &&
            new Date(dateStr) > new Date(startDate) &&
            new Date(dateStr) < new Date(endDate);
          const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

          return (
            <button
              key={dateStr}
              disabled={booked}
              onClick={() => {
                if (booked) return;
                if (!startDate || (startDate && endDate)) {
                  setStartDate(dateStr);
                  setEndDate('');
                  setAvailabilityError('');
                } else {
                  if (new Date(dateStr) < new Date(startDate)) {
                    setStartDate(dateStr);
                    setEndDate('');
                  } else {
                    // Check if any booked date falls in range
                    const hasConflict = bookedDates.some(b => {
                      const bs = new Date(b.start_date);
                      const be = new Date(b.end_date);
                      const rs = new Date(startDate);
                      const re = new Date(dateStr);
                      return !(re < bs || rs > be);
                    });
                    if (hasConflict) {
                      setAvailabilityError('Selected range includes already booked dates. Please choose different dates.');
                      setEndDate('');
                    } else {
                      setEndDate(dateStr);
                      setAvailabilityError('');
                    }
                  }
                }
              }}
              className={`flex-shrink-0 flex flex-col items-center gap-1 w-11 py-2.5 rounded-xl border-2 transition-all
                ${isStart || isEnd
                  ? 'bg-brand-600 border-brand-600 text-white shadow-md'
                  : inRange
                  ? 'bg-brand-100 border-brand-200 text-brand-700'
                  : booked
                  ? 'bg-red-50 border-red-200 text-red-400 cursor-not-allowed opacity-60'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-brand-300'
                }`}
            >
              <span className="text-[9px] font-bold uppercase">
                {dayNames[date.getDay()]}
              </span>
              <span className="text-sm font-black">{date.getDate()}</span>
              {booked && (
                <span className="text-[7px] font-bold text-red-400 uppercase">Booked</span>
              )}
              {(isStart) && (
                <span className="text-[7px] font-bold text-white uppercase">Start</span>
              )}
              {(isEnd) && (
                <span className="text-[7px] font-bold text-white uppercase">End</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-brand-600"></div>
          <span className="text-[10px] text-gray-500 font-medium">Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
          <span className="text-[10px] text-gray-500 font-medium">Booked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-white border border-gray-200"></div>
          <span className="text-[10px] text-gray-500 font-medium">Available</span>
        </div>
      </div>
    </div>

    {/* Date Inputs */}
    <div className="space-y-4 mb-4">
      <div>
        <label className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
          <i className="ph-bold ph-calendar-blank text-brand-600"></i>
          From Date
        </label>
        <input
          type="date"
          value={startDate}
          min={today}
          onChange={(e) => {
            setStartDate(e.target.value);
            setAvailabilityError('');
            if (endDate && e.target.value > endDate) setEndDate('');
          }}
          className="w-full bg-[#F4F5F0] rounded-[16px] px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
          <i className="ph-bold ph-calendar-check text-brand-600"></i>
          To Date
        </label>
        <input
          type="date"
          value={endDate}
          min={startDate || today}
          onChange={(e) => {
            const newEnd = e.target.value;
            // Check conflict
            if (startDate) {
              const hasConflict = bookedDates.some(b => {
                const bs = new Date(b.start_date);
                const be = new Date(b.end_date);
                const rs = new Date(startDate);
                const re = new Date(newEnd);
                return !(re < bs || rs > be);
              });
              if (hasConflict) {
                setAvailabilityError('Selected range includes already booked dates. Please choose different dates.');
                setEndDate('');
                return;
              }
            }
            setEndDate(newEnd);
            setAvailabilityError('');
          }}
          className="w-full bg-[#F4F5F0] rounded-[16px] px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all"
        />
      </div>
    </div>

    {/* Error message */}
    {availabilityError && (
      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[12px] flex items-start gap-2">
        <i className="ph-bold ph-warning-circle text-red-500 text-lg flex-shrink-0 mt-0.5"></i>
        <p className="text-xs font-semibold text-red-700">{availabilityError}</p>
      </div>
    )}

    <div className="flex justify-between items-center mb-5 text-sm">
      <span className="text-gray-500 font-medium">Estimated Total ({totalDays} days)</span>
      <span className="font-black text-gray-900 text-lg">₹{totalPrice.toLocaleString()}</span>
    </div>

    {userPendingBooking ? (
      <div className="w-full bg-amber-50 border-2 border-amber-200 rounded-[16px] py-4 px-4 text-center">
        <p className="font-black text-amber-800 text-sm flex items-center justify-center gap-2">
          <i className="ph-bold ph-clock text-amber-600 text-base"></i>
          Booking Request Pending
        </p>
        <p className="text-xs text-amber-600 mt-1">
          {userPendingBooking.start_date
            ? `${new Date(userPendingBooking.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(userPendingBooking.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
            : 'Waiting for owner approval'}
        </p>
        <button
          onClick={() => router.push('/user-profile')}
          className="mt-3 text-xs font-bold text-amber-700 underline underline-offset-2"
        >
          View in My Bookings
        </button>
      </div>
    ) : (
      <button
        onClick={() => {
          if (!startDate || !endDate) return;
          if (availabilityError) return;
          setShowPhoneModal(true);
        }}
        disabled={isReserving || !startDate || !endDate || !!availabilityError}
        className="w-full bg-brand-800 text-white rounded-[16px] py-4 font-bold shadow-lg shadow-brand-800/30 active:scale-[0.98] transition-transform flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isReserving ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Sending Request...
          </>
        ) : !startDate || !endDate ? (
          <>Select Dates to Book <i className="ph-bold ph-arrow-right"></i></>
        ) : (
          <>Request to Book <i className="ph-bold ph-arrow-right"></i></>
        )}
      </button>
    )}
    <p className="text-[10px] text-center text-gray-400 mt-3 font-medium">
      A booking request will be sent to the equipment owner
    </p>
  </div>
</section>

        {/* Phone Number Modal */}
        {showPhoneModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end px-4 pb-[calc(60px+env(safe-area-inset-bottom)+16px)]">
            <div className="w-full bg-white rounded-t-[32px] p-6 pb-8">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold text-gray-900">Your Mobile Number</h2>
                <button onClick={() => setShowPhoneModal(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <i className="ph-bold ph-x text-lg text-gray-600"></i>
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-5">The equipment owner will contact you at this number to confirm the booking.</p>
              <div className="relative mb-5">
                <i className="ph-bold ph-phone absolute left-4 top-3.5 text-gray-400"></i>
                <input
                  type="tel"
                  value={renterPhone}
                  onChange={(e) => {
  const value = e.target.value.replace(/[^\d+\s-]/g, '');
  setRenterPhone(value);
}}
                  placeholder="+91 9876543210"
                  className="w-full bg-[#F4F5F0] rounded-[16px] pl-10 pr-4 py-3.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  autoFocus
                />
              </div>
              <button
onClick={() => {
  if (!isValidPhoneNumber(renterPhone)) {
    alert('Enter a valid mobile number with country code');
    return;
  }

  setShowPhoneModal(false);
  handleReserve();
}}
                disabled={isReserving}
                className="w-full bg-brand-800 text-white rounded-[16px] py-4 font-bold shadow-lg active:scale-[0.98] transition-transform flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {isReserving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Booking...</>
                ) : (
                  <>Confirm & Request Booking <i className="ph-bold ph-arrow-right"></i></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Date Picker Modal */}
{showDatePicker && (
  <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end px-4 pb-[calc(60px+env(safe-area-inset-bottom)+16px)]">
    
    <div className="w-full bg-white rounded-t-[32px] max-h-[60vh] flex flex-col shadow-2xl">
      <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto mt-2 mb-2"></div>

      {/* 🔵 HEADER (fixed) */}
      <div className="p-6 pb-4 border-b border-gray-100 shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Select Dates</h2>
          <button 
            onClick={() => {
              setShowDatePicker(false);
              setAvailabilityError('');
            }}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:scale-95"
          >
            <i className="ph-bold ph-x text-lg"></i>
          </button>
        </div>
      </div>

      {/* 🟡 SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* Equipment Info */}
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-[16px]">
          <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            <i className="ph-bold ph-info text-lg"></i> Equipment Details
          </h3>
          <p className="text-sm text-blue-700">{machinery?.name} - {machinery?.model}</p>
        </div>

        {/* Booked Dates */}
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const futureBookedDates = bookedDates.filter(range => {
            const endDate = new Date(range.end_date);
            endDate.setHours(0, 0, 0, 0);
            return endDate >= today;
          });

          return futureBookedDates.length > 0 && (
            <div className="bg-red-50 border-2 border-red-300 rounded-[16px] p-4 mb-6">
              <h4 className="text-sm font-bold text-red-900 mb-3 flex items-center gap-2">
                <i className="ph-bold ph-calendar-x text-lg"></i> Already Booked
              </h4>
              <div className="space-y-2">
                {futureBookedDates.map((range, idx) => (
                  <div key={idx} className="bg-white border border-red-200 rounded-lg p-3 text-xs text-red-700 font-semibold flex justify-between">
                    <span>
                      {new Date(range.start_date).toLocaleDateString('en-IN')} - {new Date(range.end_date).toLocaleDateString('en-IN')}
                    </span>
                    <i className="ph-bold ph-lock text-red-500"></i>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Calendar */}
        <div className="mb-6 p-4 bg-gray-50 rounded-[16px]">
          <h3 className="font-bold text-gray-900 mb-4">Calendar</h3>
          {/* <div className="grid grid-cols-7 gap-2 max-h-[200px] overflow-y-auto">
            {renderCalendar()}
          </div> */}
        </div>

        {/* Date Inputs */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-xs font-bold text-gray-700 mb-2 block">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[#F4F5F0] rounded-[16px] px-4 py-3.5 text-sm font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 mb-2 block">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#F4F5F0] rounded-[16px] px-4 py-3.5 text-sm font-bold"
            />
          </div>
        </div>

        {/* Price Summary */}
        <div className="bg-brand-50 rounded-[16px] p-4 mb-6">
          <div className="flex justify-between">
            <span>{totalDays} Days</span>
            <span className="font-bold">₹{totalPrice}</span>
          </div>
        </div>

      </div>

      {/* 🔵 FOOTER (fixed CTA) */}
      <div className="p-4 border-t border-gray-100 bg-white shrink-0">
        <div className="flex gap-3">
          
          <button
            onClick={() => setShowDatePicker(false)}
            className="flex-1 bg-gray-100 text-gray-900 rounded-[16px] py-3.5 font-bold"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              if (!startDate || !endDate) return;
              setShowDatePicker(false);
              setShowPhoneModal(true);
            }}
            disabled={!startDate || !endDate}
            className="flex-1 bg-brand-800 text-white rounded-[16px] py-3.5 font-bold disabled:opacity-50"
          >
            Confirm & Request
          </button>

        </div>
      </div>

    </div>
  </div>
)}

        {/* Review Modal */}
        {showReviewModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end">
            <div className="w-full bg-white rounded-t-[32px] p-6 pb-8 animate-in slide-in-from-bottom max-h-[70vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Leave a Review</h2>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:scale-95"
                >
                  <i className="ph-bold ph-x text-lg"></i>
                </button>
              </div>

              <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-[16px]">
                <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <i className="ph-bold ph-wrench text-lg"></i> {machinery?.name}
                </h3>
                <p className="text-sm text-blue-700">{machinery?.model}</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-900 mb-4">Rate Your Experience</label>
                <div className="flex gap-2 justify-center mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className="text-4xl transition-all hover:scale-110 active:scale-95"
                    >
                      <i
                        className={`ph-${reviewRating >= star ? 'fill' : 'bold'} ph-star ${
                          reviewRating >= star ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                      ></i>
                    </button>
                  ))}
                </div>
                <p className="text-center text-sm font-bold text-gray-600 mt-2">
                  {reviewRating === 0
                    ? 'Select a rating'
                    : reviewRating === 1
                    ? 'Poor'
                    : reviewRating === 2
                    ? 'Fair'
                    : reviewRating === 3
                    ? 'Good'
                    : reviewRating === 4
                    ? 'Very Good'
                    : 'Excellent'}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-900 mb-2">Your Review (Optional)</label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value.slice(0, 500))}
                  maxLength={500}
                  placeholder="Share your experience with this equipment..."
                  className="w-full bg-[#F4F5F0] rounded-[16px] px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none h-24"
                />
                <p className="text-xs text-gray-500 mt-1 text-right">{reviewText.length}/500</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="flex-1 bg-gray-100 text-gray-900 rounded-[16px] py-3.5 font-bold active:scale-[0.98] transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={isSubmittingReview || reviewRating === 0}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-[16px] py-3.5 font-bold shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmittingReview ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <i className="ph-bold ph-check-circle"></i> Submit Review
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Booking Success Modal */}
        {showBookingSuccess && bookingDetails && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end px-4 pb-[calc(60px+env(safe-area-inset-bottom)+16px)]">
            <div className="bg-white rounded-t-3xl w-full max-w-md px-6 pt-6 pb-10 animate-slide-up">
              {/* Success icon */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <i className="ph-bold ph-check-circle text-4xl text-green-600"></i>
                </div>
                <h2 className="text-xl font-black text-gray-900">Booking Requested!</h2>
                <p className="text-sm text-gray-500 mt-1 text-center">Your request has been sent to the owner</p>
              </div>

              {/* Booking summary */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Equipment</span>
                  <span className="font-semibold text-gray-900">{machineryName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">From</span>
                  <span className="font-semibold text-gray-900">{new Date(bookingDetails.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">To</span>
                  <span className="font-semibold text-gray-900">{new Date(bookingDetails.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Days</span>
                  <span className="font-semibold text-gray-900">{bookingDetails.totalDays} days</span>
                </div>
                <div className="h-px bg-gray-200 my-1"></div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 font-semibold">Total</span>
                  <span className="font-black text-green-700 text-base">₹{bookingDetails.totalPrice.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Owner contact */}
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">Owner Contact</p>
                <div className="flex items-center gap-3">
                  <div className="cursor-pointer" onClick={() => { setShowBookingSuccess(false); router.push(`/farmer-profile?id=${ownerId}`); }}>
                    <img
                      src={ownerProfile?.image }
                      alt={ownerName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  </div>
                  <div className="flex-1 cursor-pointer" onClick={() => { setShowBookingSuccess(false); router.push(`/farmer-profile?id=${ownerId}`); }}>
                    <p className="font-bold text-gray-900 text-sm underline underline-offset-2">{ownerName}</p>
                    {ownerCallPhone ? (
                      <p className="text-green-700 font-semibold text-sm">{ownerCallPhone}</p>
                    ) : (
                      <p className="text-gray-400 text-xs">Calls unavailable</p>
                    )}
                  </div>
                  {ownerCallPhone && (
                    <a
                      href={`tel:${ownerCallPhone}`}
                      onClick={() => trackOwnerCall('booking_success')}
                      className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center shadow-md"
                    >
                      <i className="ph-bold ph-phone text-white text-lg"></i>
                    </a>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowBookingSuccess(false);
                    router.push('/my-reservations');
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold text-sm transition"
                >
                  View My Bookings
                </button>
                <button
                  onClick={() => setShowBookingSuccess(false)}
                  className="px-5 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm transition hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

    </>
  );
}

export default function MachineryDetailsPage() {
  return (
    <Suspense fallback={
      <div className="w-full min-h-[100dvh] bg-brand-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    }>
      <MachineryDetailsContent />
    </Suspense>
  );
}
