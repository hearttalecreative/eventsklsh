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
    console.log('Geocoding initial address:', address);
    // @ts-ignore
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results: any, status: string) => {
      console.log('Initial geocoding result:', status, results);
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        const c = { lat: loc.lat(), lng: loc.lng() };
        setCenter(c);
        setMarker(c);
      } else {
        console.warn('Initial geocoding failed:', status, address);
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
    console.log('Autocomplete place changed');
    const place = autoRef.current?.getPlace();
    console.log('Selected place:', place);
    
    // Get location from the selected place
    const loc = place?.geometry?.location;
    if (loc) {
      const pos = { lat: loc.lat(), lng: loc.lng() };
      console.log('Setting map position from autocomplete:', pos);
      
      // Update both center and marker immediately
      setCenter(pos);
      setMarker(pos);
    }
    
    // Get formatted address from the selected place
    const fmt = place?.formatted_address || place?.name || '';
    if (fmt) {
      console.log('Setting address from autocomplete:', fmt);
      setManualAddress(fmt);
      onAddressChange(fmt);
    }
    
    // Clear the autocomplete input after selection
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleManualAddressChange = (value: string) => {
    setManualAddress(value);
    onAddressChange(value);
    
    // If manual address is changed, try to geocode it automatically (debounced)
    if (value.trim() && isLoaded) {
      const timeoutId = setTimeout(() => {
        // @ts-ignore
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: value }, (results: any, status: string) => {
          if (status === 'OK' && results?.[0]?.geometry?.location) {
            const loc = results[0].geometry.location;
            const pos = { lat: loc.lat(), lng: loc.lng() };
            setCenter(pos);
            setMarker(pos);
          }
        });
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  };

  const mapCenter = useMemo(() => marker || center || { lat: 34.0522, lng: -118.2437 }, [marker, center]);

  if (loadError) {
    console.error('Google Maps load error:', loadError);
    return (
      <div className="w-full p-4 border rounded-md">
        <p className="text-red-500 text-sm">Error loading Google Maps</p>
        <div className="mt-2">
          <Label>Dirección Manual</Label>
          <Input 
            value={manualAddress} 
            onChange={(e) => handleManualAddressChange(e.target.value)}
            placeholder="Escribe la dirección manualmente" 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Google Places Autocomplete - Separate from manual input */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Buscar en Google Maps</Label>
        {!isLoaded ? (
          <div className="w-full p-3 border rounded-md bg-muted text-sm text-muted-foreground">
            Cargando Google Places...
          </div>
        ) : (
          <Autocomplete 
            onLoad={onAutoLoad} 
            onPlaceChanged={onAutoPlaceChanged}
            options={{
              componentRestrictions: { country: ['us', 'mx'] },
              fields: ['formatted_address', 'geometry', 'name', 'place_id'],
              types: ['establishment', 'geocode']
            }}
          >
            <Input
              ref={inputRef} 
              placeholder="Busca un lugar específico (ej: Starbucks, Hotel Marriott, etc.)" 
              className="w-full"
            />
          </Autocomplete>
        )}
        <p className="text-xs text-muted-foreground">Selecciona una opción del menú desplegable para ubicar automáticamente en el mapa</p>
      </div>

      {/* Manual Address Input - Completely separate */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Dirección Manual</Label>
        <Input 
          value={manualAddress} 
          onChange={(e) => handleManualAddressChange(e.target.value)}
          placeholder="Escribe la dirección completa manualmente" 
        />
        <p className="text-xs text-muted-foreground">Escribe la dirección si no la encuentras en la búsqueda de Google</p>
      </div>

      {/* Google Map */}
      <div className={`w-full ${heightClass} rounded-md overflow-hidden border`}> 
        {!isLoaded ? (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
            Cargando mapa de Google...
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default GoogleMapPicker;
