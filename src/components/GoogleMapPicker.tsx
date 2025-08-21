import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, useLoadScript, Autocomplete } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/config/googleMaps';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [manualAddress, setManualAddress] = useState(address || '');
  const autoRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync manual address with prop
  useEffect(() => {
    setManualAddress(address || '');
  }, [address]);

  // If we have an address initially, geocode it
  useEffect(() => {
    if (!isLoaded || !address || center) return;
    console.log('Geocoding address:', address);
    // @ts-ignore
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results: any, status: string) => {
      console.log('Geocoding result:', status, results);
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        const c = { lat: loc.lat(), lng: loc.lng() };
        setCenter(c);
        setMarker(c);
      } else {
        console.warn('Geocoding failed:', status, address);
      }
    });
  }, [isLoaded, address, center]);

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setMarker(pos);
    setCenter(pos);
    
    // Reverse geocode to address
    // @ts-ignore
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: pos }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]?.formatted_address) {
        const newAddress = results[0].formatted_address;
        setManualAddress(newAddress);
        onAddressChange(newAddress);
      }
    });
  }, [onAddressChange]);

  const onMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setMarker(pos);
    setCenter(pos);
    
    // @ts-ignore
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: pos }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]?.formatted_address) {
        const newAddress = results[0].formatted_address;
        setManualAddress(newAddress);
        onAddressChange(newAddress);
      }
    });
  }, [onAddressChange]);

  const onAutoLoad = (ac: google.maps.places.Autocomplete) => {
    console.log('Autocomplete loaded');
    autoRef.current = ac;
  };

  const onAutoPlaceChanged = () => {
    console.log('Place changed');
    const place = autoRef.current?.getPlace();
    console.log('Selected place:', place);
    
    const loc = place?.geometry?.location;
    if (loc) {
      const pos = { lat: loc.lat(), lng: loc.lng() };
      console.log('Setting position from autocomplete:', pos);
      setCenter(pos);
      setMarker(pos);
      
      // Clear the autocomplete input after selection
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
    
    const fmt = place?.formatted_address || place?.name || '';
    if (fmt) {
      console.log('Setting address from autocomplete:', fmt);
      setManualAddress(fmt);
      onAddressChange(fmt);
    }
  };

  const handleManualAddressChange = (value: string) => {
    setManualAddress(value);
    onAddressChange(value);
  };

  const geocodeManualAddress = async () => {
    if (!isLoaded || !manualAddress.trim()) return;
    
    // @ts-ignore
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: manualAddress }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        const pos = { lat: loc.lat(), lng: loc.lng() };
        setCenter(pos);
        setMarker(pos);
      }
    });
  };

  const mapCenter = useMemo(() => marker || center || { lat: 34.0522, lng: -118.2437 }, [marker, center]);

  if (loadError) {
    console.error('Google Maps load error:', loadError);
    return (
      <div className="w-full p-4 border rounded-md">
        <p className="text-red-500 text-sm">Error loading Google Maps</p>
        <div className="mt-2">
          <Label>Manual Address Input</Label>
          <Input 
            value={manualAddress} 
            onChange={(e) => handleManualAddressChange(e.target.value)}
            placeholder="Enter address manually" 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Manual Address Input */}
      <div className="space-y-1">
        <Label>Dirección Manual</Label>
        <div className="flex gap-2">
          <Input 
            value={manualAddress} 
            onChange={(e) => handleManualAddressChange(e.target.value)}
            placeholder="Escribe la dirección completa aquí" 
            className="flex-1"
          />
          <button
            type="button"
            onClick={geocodeManualAddress}
            className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Google Maps with Autocomplete */}
      <div className={`w-full ${heightClass} rounded-md overflow-hidden border`}> 
        {!isLoaded ? (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
            Cargando mapa de Google...
          </div>
        ) : (
          <div className="w-full h-full">
            <div className="p-2 bg-muted/30">
              <Label className="text-xs text-muted-foreground mb-1 block">Búsqueda con Google Places</Label>
              <Autocomplete 
                onLoad={onAutoLoad} 
                onPlaceChanged={onAutoPlaceChanged}
                options={{
                  componentRestrictions: { country: ['us', 'mx'] },
                  fields: ['formatted_address', 'geometry', 'name', 'place_id'],
                  types: ['establishment', 'geocode']
                }}
              >
                <input 
                  ref={inputRef} 
                  placeholder="Busca un lugar específico..." 
                  className="w-full px-3 py-2 text-sm rounded border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary" 
                />
              </Autocomplete>
            </div>
            <div style={{ height: 'calc(100% - 70px)' }}>
              <GoogleMap 
                mapContainerStyle={{ width: '100%', height: '100%' }} 
                center={mapCenter} 
                zoom={(marker || center) ? 15 : 10} 
                onClick={onMapClick} 
                options={{ 
                  streetViewControl: false, 
                  mapTypeControl: false, 
                  fullscreenControl: false 
                }}
              >
                {marker && (
                  <Marker 
                    position={marker} 
                    draggable 
                    onDragEnd={onMarkerDragEnd}
                    title={manualAddress || 'Ubicación seleccionada'} 
                  />
                )}
              </GoogleMap>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleMapPicker;
