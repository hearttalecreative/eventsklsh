import React, { useEffect, useMemo, useState } from 'react';
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/config/googleMaps';

interface GoogleMapDisplayProps {
  lat?: number;
  lng?: number;
  address?: string | null;
  name?: string;
  heightClass?: string;
  zoom?: number;
}

const containerStyle: React.CSSProperties = { width: '100%', height: '100%' };

const GoogleMapDisplay: React.FC<GoogleMapDisplayProps> = ({ lat, lng, address, name, heightClass = 'h-64', zoom = 13 }) => {
  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(lat != null && lng != null ? { lat, lng } : null);

  // Geocode address when no lat/lng provided or when address changes
  useEffect(() => {
    if (!isLoaded || !address) return;
    
    // Always geocode the address to get accurate coordinates
    // @ts-ignore
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        setCenter({ lat: loc.lat(), lng: loc.lng() });
      } else {
        console.warn('Geocoding failed:', status, address);
      }
    });
  }, [isLoaded, address]);

  const mapCenter = useMemo(() => center || { lat: 0, lng: 0 }, [center]);

  if (loadError) return null;

  return (
    <div className={`w-full ${heightClass} rounded-lg overflow-hidden border`}> 
      {!isLoaded ? (
        <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">Cargando mapa…</div>
      ) : (
        <GoogleMap mapContainerStyle={containerStyle} center={mapCenter} zoom={center ? zoom : 2} options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}>
          {center && <Marker position={center} title={name} />}
        </GoogleMap>
      )}
    </div>
  );
};

export default GoogleMapDisplay;
