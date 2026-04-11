'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';


interface BookingRequest {
  id: number;
  user_id: string;
  machinery_id: string;
  machinery_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  daily_rate: string;
  total_price: string;
  status: string;
  created_at: string;
  image_url?: string;
  renter_name?: string;
  renter_email?: string;
  renter_image?: string;
}

export default function BookingRequestsPage() {
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, mounted, router]);

  useEffect(() => {
    if (user && isAuthenticated) {
      fetchBookingRequests();
    }
  }, [user, isAuthenticated]);

  const fetchBookingRequests = async () => {
    try {
      const url = `/api/reservations?owner_id=${user?.id}`;
      console.log('Fetching booking requests from:', url);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('Booking requests fetched:', data);
        
        // Fetch images for each booking request
        const requestsWithImages = await Promise.all(
          data.map(async (request: BookingRequest) => {
            let machineImageUrl = request.image_url;
            if (request.machinery_id && !machineImageUrl) {
              try {
                const machineRes = await fetch(`/api/machinery/${request.machinery_id}`);
                if (machineRes.ok) {
                  const machineData = await machineRes.json();
                  machineImageUrl = machineData.image_url;
                }
              } catch (err) {
                if (err instanceof Error) {
                  console.error('Failed to fetch machinery image:', err.message);
                } else {
                  console.error('Failed to fetch machinery image');
                }
              }
            }
            return { ...request, image_url: machineImageUrl };
          })
        );
        
        setBookingRequests(requestsWithImages);
      } else {
        console.error('Failed to fetch:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch booking requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleAcceptBooking = async (id: number) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/reservations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'accepted' }),
      });

      if (response.ok) {
        const updated = await response.json();
        setBookingRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'accepted' } : req));
        alert('Booking confirmed! Customer will contact you for pickup details.');
      } else {
        alert('Failed to accept booking. Please try again.');
      }
    } catch (error) {
      console.error('Error accepting booking:', error);
      alert('Error processing your request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectBooking = async (id: number) => {
    if (!confirm('Are you sure you want to decline this booking request?')) return;

    setProcessingId(id);
    try {
      const response = await fetch(`/api/reservations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'rejected' }),
      });

      if (response.ok) {
        setBookingRequests(prev => prev.map(req => req.id === id ? { ...req, status: 'rejected' } : req));
        alert('Booking declined.');
      } else {
        alert('Failed to decline booking. Please try again.');
      }
    } catch (error) {
      console.error('Error rejecting booking:', error);
      alert('Error processing your request.');
    } finally {
      setProcessingId(null);
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

  const pendingRequests = bookingRequests.filter(r => r.status === 'pending');
  const respondedRequests = bookingRequests.filter(r => r.status !== 'pending');

  return (
    <>
      <div className="pt-4 text-gray-800 relative min-h-screen" suppressHydrationWarning>
        <div className="ambient-glow"></div>

        {/* Header */}
        <header className="w-full px-6 pb-6 relative z-10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button 
              className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center text-gray-900 active:scale-95 transition-transform" 
              onClick={() => router.push('/')}>
              <i className="ph-bold ph-arrow-left text-lg"></i>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Booking Requests</h1>
          </div>
        </header>

        {/* Stats */}
        <section className="px-6 mb-6 relative z-10">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-yellow-100 rounded-[20px] p-4">
              <p className="text-[10px] text-yellow-700 font-bold uppercase mb-1">Pending</p>
              <p className="text-2xl font-black text-yellow-800">{pendingRequests.length}</p>
            </div>
            <div className="bg-green-100 rounded-[20px] p-4">
              <p className="text-[10px] text-green-700 font-bold uppercase mb-1">Confirmed</p>
              <p className="text-2xl font-black text-green-800">{respondedRequests.filter(r => r.status === 'accepted').length}</p>
            </div>
          </div>
        </section>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <section className="px-6 mb-8 relative z-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Awaiting Your Response</h2>
            <div className="space-y-4">
              {pendingRequests.map((request) => {
                const startDate = new Date(request.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const endDate = new Date(request.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                return (
                  <div key={request.id} className="bg-white rounded-[20px] overflow-hidden shadow-soft border-l-4 border-yellow-400">
                    {request.image_url && (
                      <div className="w-full h-32 bg-gray-200 overflow-hidden">
                        <img 
                          src={request.image_url} 
                          alt={request.machinery_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      {/* Renter Info */}
                      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-100">
                        {request.renter_image ? (
                          <img 
                            src={request.renter_image} 
                            alt={request.renter_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-brand-200 flex items-center justify-center">
                            <i className="ph-bold ph-user text-brand-700"></i>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-500 font-medium">Requested by</p>
                          <p className="font-bold text-gray-900 text-sm truncate">{request.renter_name || 'Unknown User'}</p>
                          <p className="text-[10px] text-gray-500 truncate">{request.renter_email}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">{request.machinery_name}</h3>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Booking ID: #{request.id}
                          </p>
                        </div>
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1.5">
                        <i className="ph-bold ph-clock"></i>
                        Pending
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-gray-100">
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium">Dates</p>
                        <p className="text-sm font-bold text-gray-900">{startDate} - {endDate}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium\">Duration</p>
                        <p className="text-sm font-bold text-gray-900">{request.total_days} days</p>
                      </div>
                    </div>

                    <div className="mb-4 pb-4 border-b border-gray-100">
                      <p className="text-gray-600 font-medium text-sm mb-1">Rental Value</p>
                      <p className="text-xl font-black text-brand-800">${Number(request.total_price).toFixed(2)}</p>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleRejectBooking(request.id)}
                        disabled={processingId === request.id}
                        className="flex-1 bg-red-50 text-red-600 border border-red-100 rounded-[12px] py-3 font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50">
                        Reject
                      </button>
                      <button 
                        onClick={() => handleAcceptBooking(request.id)}
                        disabled={processingId === request.id}
                        className="flex-1 bg-green-600 text-white rounded-[12px] py-3 font-bold text-sm shadow-lg shadow-green-600/20 active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                        {processingId === request.id ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          </>
                        ) : (
                          <>
                            <i className="ph-bold ph-check"></i>
                            Confirm
                          </>
                        )}
                      </button>
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Responded Requests */}
        {respondedRequests.length > 0 && (
          <section className="px-6 mb-8 relative z-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Responded Requests</h2>
            <div className="space-y-4">
              {respondedRequests.map((request) => {
                const startDate = new Date(request.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const endDate = new Date(request.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                return (
                  <div key={request.id} className={`bg-white rounded-[20px] overflow-hidden shadow-soft border-l-4 ${
                    request.status === 'accepted' ? 'border-green-400' : 'border-red-400'
                  }`}>
                    {request.image_url && (
                      <div className="w-full h-32 bg-gray-200 overflow-hidden">
                        <img 
                          src={request.image_url} 
                          alt={request.machinery_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">{request.machinery_name}</h3>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Booking ID: #{request.id}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
                          request.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          <i className={`ph-bold ${request.status === 'accepted' ? 'ph-check-circle' : 'ph-x-circle'}`}></i>
                          {request.status === 'accepted' ? 'Confirmed' : 'Declined'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{startDate} - {endDate}</span>
                        <span className="font-bold text-gray-900">${Number(request.total_price).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty State */}
        {bookingRequests.length === 0 && (
          <section className="px-6 mb-8 relative z-10">
            <div className="bg-white rounded-[24px] p-8 shadow-soft text-center">
              <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ph-bold ph-inbox text-3xl text-brand-600"></i>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">No Booking Requests</h2>
              <p className="text-sm text-gray-500">When farmers request to rent your equipment, they'll appear here</p>
            </div>
          </section>
        )}
      </div>

    </>
  );
}
