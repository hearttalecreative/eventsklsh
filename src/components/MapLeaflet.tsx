import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

interface MapLeafletProps {
  lat: number;
  lng: number;
  name?: string;
}

const MapLeaflet: React.FC<MapLeafletProps> = ({ lat, lng, name }) => {
  const position = [lat, lng] as unknown as any; // casting to satisfy TS in this setup
  return (
    <div className="w-full h-64 rounded-lg overflow-hidden border animate-fade-in">
      {/* Casting props to any avoids type friction with react-leaflet in strict TS environments */}
      <MapContainer {...({ center: position, zoom: 13, scrollWheelZoom: false, className: 'w-full h-full' } as any)}>
        <TileLayer
          {...({ attribution: '© OpenStreetMap contributors', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' } as any)}
        />
        <Marker position={position}>
          <Popup>{name}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

export default MapLeaflet;
