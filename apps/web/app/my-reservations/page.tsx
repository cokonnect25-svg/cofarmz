'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';


interface Reservation {
  id: number;
  machinery_name: string;
  machinery_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  daily_rate: number | string;
  total_price: number | string;
  status: string;
  image_url?: string;
}

interface MachineryDetails {
  image_url: string;
}

export default function MyReservationsPage() {
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(true);

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
      fetchReservations();
    }
  }, [user, isAuthenticated]);

  const fetchReservations = async () => {
    try {
      // Auto-cancel pending bookings with no response after 2 days
      await fetch(`/api/reservations/auto-cancel`, { method: 'POST' }).catch(() => {});

      const url = `/api/reservations?user_id=${user?.id}`;
      console.log('Fetching reservations from:', url);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('Reservations fetched:', data);
        
        // Fetch images for each reservation
        const reservationsWithImages = await Promise.all(
          data.map(async (reservation: Reservation) => {
            if (reservation.machinery_id) {
              try {
                const machineRes = await fetch(`/api/machinery/${reservation.machinery_id}`);
                if (machineRes.ok) {
                  const machineData = await machineRes.json();
                  return { ...reservation, image_url: machineData.image_url };
                }
              } catch (err) {
                if (err instanceof Error) {
                  console.error('Failed to fetch machinery image:', err.message);
                } else {
                  console.error('Failed to fetch machinery image');
                }
              }
            }
            return reservation;
          })
        );
        
        setReservations(reservationsWithImages);
      } else {
        console.error('Failed to fetch:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch reservations:', error);
    } finally {
      setLoadingReservations(false);
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
            <h1 className="text-2xl font-bold text-gray-900">My Reservations</h1>
          </div>
        </header>

        {/* Reservations List */}
        <section className="px-6 mb-8 relative z-10">
          {loadingReservations ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
            </div>
          ) : reservations.length === 0 ? (
            <div className="bg-white rounded-[24px] p-8 shadow-soft text-center">
              <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ph-bold ph-calendar-blank text-3xl text-brand-600"></i>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">No Reservations Yet</h2>
              <p className="text-sm text-gray-500 mb-4">Start renting equipment from nearby farmers</p>
              <button 
                onClick={() => router.push('/machinery-list')}
                className="bg-brand-800 text-white px-6 py-3 rounded-[16px] font-bold text-sm active:scale-[0.98] transition-transform">
                Browse Equipment
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {reservations.map((reservation) => {
                const startDate = new Date(reservation.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const endDate = new Date(reservation.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                return (
                  <div key={reservation.id} className="bg-white rounded-[20px] overflow-hidden shadow-soft">
                    <div className="w-full h-44 bg-gray-100 overflow-hidden relative">
                      {reservation.image_url ? (
                        <img
                          src={reservation.image_url}
                          alt={reservation.machinery_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-100">
                          <i className="ph-bold ph-tractor text-4xl text-gray-300"></i>
                          <p className="text-xs text-gray-400 font-medium">No image</p>
                        </div>
                      )}
                      {/* Status badge overlay */}
                      <span className={`absolute top-3 right-3 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm ${
                        reservation.status === 'confirmed' ? 'bg-green-600 text-white' :
                        reservation.status === 'pending' ? 'bg-yellow-500 text-white' :
                        reservation.status === 'cancelled' ? 'bg-gray-500 text-white' :
                        'bg-red-500 text-white'
                      }`}>
                        <i className={`ph-bold ${
                          reservation.status === 'confirmed' ? 'ph-check-circle' :
                          reservation.status === 'pending' ? 'ph-clock' :
                          reservation.status === 'cancelled' ? 'ph-x-circle' :
                          'ph-x-circle'
                        }`}></i>
                        {reservation.status === 'confirmed' ? 'Confirmed' :
                         reservation.status === 'pending' ? 'Awaiting Response' :
                         reservation.status === 'cancelled' ? 'Cancelled' :
                         'Rejected'}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">{reservation.machinery_name}</h3>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Booking ID: #{reservation.id}
                          </p>
                        </div>
                      <div></div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-gray-100">
                      <div className="flex items-start gap-2">
                        <i className="ph-bold ph-calendar-blank text-gray-400 mt-0.5"></i>
                        <div>
                          <p className="text-[10px] text-gray-500 font-medium">Dates</p>
                          <p className="text-sm font-bold text-gray-900">{startDate} - {endDate}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <i className="ph-bold ph-calendar-blank text-gray-400 mt-0.5"></i>
                        <div>
                          <p className="text-[10px] text-gray-500 font-medium">Duration</p>
                          <p className="text-sm font-bold text-gray-900">{reservation.total_days} days</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium text-sm">Daily Rate: ₹{Number(reservation.daily_rate).toFixed(2)}</span>
                      <span className="text-lg font-black text-green-700">₹{Number(reservation.total_price).toFixed(2)}</span>
                    </div>

                      {reservation.status === 'pending' && (
                        <div className="mt-4 p-3 bg-yellow-50 rounded-[12px] text-[12px] text-yellow-800 font-medium flex items-start gap-2">
                          <i className="ph-bold ph-info mt-0.5 flex-shrink-0"></i>
                          <span>Waiting for the equipment owner to confirm your booking request</span>
                        </div>
                      )}

                      {reservation.status === 'confirmed' && (
                        <div className="mt-4 p-3 bg-green-50 rounded-[12px] text-[12px] text-green-800 font-medium flex items-start gap-2">
                          <i className="ph-bold ph-check-circle mt-0.5 flex-shrink-0"></i>
                          <span>Your booking has been confirmed! Contact the owner to arrange pickup.</span>
                        </div>
                      )}

                      {reservation.status === 'rejected' && (
                        <div className="mt-4 p-3 bg-red-50 rounded-[12px] text-[12px] text-red-800 font-medium flex items-start gap-2">
                          <i className="ph-bold ph-x-circle mt-0.5 flex-shrink-0"></i>
                          <span>The owner has declined your booking request. Try different dates or find other equipment.</span>
                        </div>
                      )}
                      {reservation.status === 'cancelled' && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-[12px] text-[12px] text-gray-700 font-medium flex items-start gap-2">
                          <i className="ph-bold ph-x-circle mt-0.5 flex-shrink-0"></i>
                          <span>This booking was automatically cancelled — no response from the owner within 2 days.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

    </>
  );
}
