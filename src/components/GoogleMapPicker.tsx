import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, useLoadScript, Autocomplete } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/config/googleMaps';

interface GoogleMapPickerProps {
  address?: string;
  onAddressChange: (address: string) => void;
  heightClass?: string;
}

const containerStyle: React.CSSProperties = { width: '100%', height: '100%' };

const libraries: ("places")[] = ['places'];

const GoogleMapPicker: React.FC<GoogleMapPickerProps> = ({ address, onAddressChange, heightClass = 'h-64' }) => {
  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries });
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const autoRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // If we have an address initially, geocode it
  useEffect(() => {
    if (!isLoaded || !address || center) return;
    // @ts-ignore
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        const c = { lat: loc.lat(), lng: loc.lng() };
        setCenter(c);
        setMarker(c);
      }
    });
  }, [isLoaded, address, center]);

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setMarker(pos);
    // Reverse geocode to address
    // @ts-ignore
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: pos }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]?.formatted_address) {
        onAddressChange(results[0].formatted_address);
      }
    });
  }, [onAddressChange]);

  const onMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setMarker(pos);
    // @ts-ignore
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: pos }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]?.formatted_address) {
        onAddressChange(results[0].formatted_address);
      }
    });
  }, [onAddressChange]);

  const onAutoLoad = (ac: google.maps.places.Autocomplete) => {
    autoRef.current = ac;
  };

  const onAutoPlaceChanged = () => {
    const place = autoRef.current?.getPlace();
    const loc = place?.geometry?.location;
    if (loc) {
      const pos = { lat: loc.lat(), lng: loc.lng() };
      setCenter(pos);
      setMarker(pos);
    }
    const fmt = place?.formatted_address || place?.name;
    if (fmt) onAddressChange(fmt);
  };

  const mapCenter = useMemo(() => marker || center || { lat: 0, lng: 0 }, [marker, center]);

  if (loadError) return null;

  return (
    <div className={`w-full ${heightClass} rounded-md overflow-hidden border`}> 
      {!isLoaded ? (
        <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">Cargando mapa…</div>
      ) : (
        <div className="w-full h-full">
          <div className="p-2">
            <Autocomplete onLoad={onAutoLoad} onPlaceChanged={onAutoPlaceChanged}>
              <input ref={inputRef} defaultValue={address || ''} placeholder="Busca una dirección" className="w-full px-3 py-2 rounded border bg-background text-foreground" />
            </Autocomplete>
          </div>
          <GoogleMap mapContainerStyle={containerStyle} center={mapCenter} zoom={(marker || center) ? 14 : 2} onClick={onMapClick} options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}>
            {marker && (
              <Marker position={marker} draggable onDragEnd={onMarkerDragEnd} />
            )}
          </GoogleMap>
        </div>
      )}
    </div>
  );
};

export default GoogleMapPicker;
