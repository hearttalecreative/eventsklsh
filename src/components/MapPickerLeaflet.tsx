import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
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

const MC = MapContainer as any;
const TL = TileLayer as any;
const MK = Marker as any;

interface MapPickerLeafletProps {
  lat?: number;
  lng?: number;
  heightClass?: string;
  onChange: (lat: number, lng: number) => void;
}

const ClickHandler: React.FC<{ setPos: (lat: number, lng: number) => void } > = ({ setPos }) => {
  useMapEvents({
    click(e) {
      setPos(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const MapPickerLeaflet: React.FC<MapPickerLeafletProps> = ({ lat, lng, heightClass = 'h-64', onChange }) => {
  const [position, setPosition] = useState<[number, number] | null>(lat !== undefined && lng !== undefined ? [lat, lng] : null);
  const setPos = (la: number, ln: number) => {
    setPosition([la, ln]);
    onChange(la, ln);
  };

  // Default center
  const center: [number, number] = position || [0, 0];

  return (
    <div className={`w-full ${heightClass} rounded-md overflow-hidden border`}>
      {/* @ts-ignore */}
      <MC center={center as any} zoom={position ? 13 : 2} scrollWheelZoom={false} className="w-full h-full">
        {/* @ts-ignore */}
        <TL
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler setPos={setPos} />
        {position && (
          // @ts-ignore
          <MK
            position={position as any}
            draggable
            eventHandlers={{
              dragend: (e) => {
                // @ts-ignore
                const m = e.target as L.Marker;
                const p = m.getLatLng();
                setPos(p.lat, p.lng);
              },
            }}
          />
        )}
      </MC>
    </div>
  );
};

export default MapPickerLeaflet;
