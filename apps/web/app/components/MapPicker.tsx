'use client';

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { Loader } from 'lucide-react';

interface MapPickerProps {
  onLocationSelect: (location: { lat: number; lng: number; name: string }) => void;
  initialLocation?: { lat: number; lng: number; name: string };
}

// Fix for leaflet marker icons
if (typeof window !== 'undefined') {
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

function MapEvents({ onLocationSelect, markerRef }: { 
  onLocationSelect: (lat: number, lng: number) => void;
  markerRef: React.RefObject<L.Marker>;
}) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPicker({ onLocationSelect, initialLocation }: MapPickerProps) {
  const [position, setPosition] = useState<[number, number]>([
    initialLocation?.lat || 20.5937,
    initialLocation?.lng || 78.9629,
  ]);
  const [loading, setLoading] = useState(false);
  const [gettingCurrent, setGettingCurrent] = useState(false);
  const markerRef = useRef<L.Marker>(null);

  const getCurrentLocation = async () => {
    setGettingCurrent(true);
    try {
      let lat: number, lng: number;

      if (Capacitor.isNativePlatform()) {
        try {
          // Request permissions first
          const permissions = await Geolocation.requestPermissions();
          if (permissions.location === 'denied') {
            alert('Location permission denied. Please enable it in settings.');
            setGettingCurrent(false);
            return;
          }
          
          const coordinates = await Geolocation.getCurrentPosition();
          lat = coordinates.coords.latitude;
          lng = coordinates.coords.longitude;
        } catch (nativeError) {
          console.error('Native geolocation error, falling back to browser:', nativeError);
          // Fallback to browser geolocation on error
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: false
            });
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        }
      } else {
        // Web fallback
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            { timeout: 10000, enableHighAccuracy: false }
          );
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      }

      setPosition([lat, lng]);
      await getReverseGeocodeLocation(lat, lng);
    } catch (error) {
      console.error('Error getting current location:', error);
      alert('Unable to get your current location. Please try clicking on the map to select a location manually.');
    } finally {
      setGettingCurrent(false);
    }
  };

  const getReverseGeocodeLocation = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      const locationName = data.address?.city || 
                          data.address?.town || 
                          data.address?.village || 
                          data.name || 
                          `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      onLocationSelect({
        lat,
        lng,
        name: locationName,
      });
    } catch (error) {
      console.error('Error getting location name:', error);
      onLocationSelect({
        lat,
        lng,
        name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setPosition([lat, lng]);
    await getReverseGeocodeLocation(lat, lng);
  };

  const handleMarkerDragEnd = async () => {
    if (markerRef.current) {
      const latLng = markerRef.current.getLatLng();
      setPosition([latLng.lat, latLng.lng]);
      await getReverseGeocodeLocation(latLng.lat, latLng.lng);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="p-4 bg-blue-50 border-b space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={getCurrentLocation}
            disabled={gettingCurrent}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {gettingCurrent ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Getting location...
              </>
            ) : (
              '📍 Use Current Location'
            )}
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-gray-700">
            <strong>Click on map</strong> or <strong>drag the marker</strong> to select location
          </p>
          {loading && <p className="text-xs text-gray-500">Getting location name...</p>}
        </div>
      </div>
      <div className="flex-1 relative">
        <MapContainer
          center={position}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
          className="z-10"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <Marker 
            ref={markerRef}
            position={position}
            draggable={true}
            eventHandlers={{
              dragend: handleMarkerDragEnd,
            }}
          />
          <MapEvents onLocationSelect={handleMapClick} markerRef={markerRef} />
        </MapContainer>
      </div>
    </div>
  );
}
