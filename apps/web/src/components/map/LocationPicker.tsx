import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Corregir íconos de Leaflet con bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(
        parseFloat(e.latlng.lat.toFixed(6)),
        parseFloat(e.latlng.lng.toFixed(6)),
      );
    },
  });
  return null;
}

const DEFAULT_CENTER: [number, number] = [-34.9011, -54.9595]; // Maldonado, Uruguay
const DEFAULT_ZOOM = 13;

export default function LocationPicker({ lat, lng, onChange }: Props) {
  const hasPosition = lat !== null && lng !== null;
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (hasPosition && mapRef.current) {
      mapRef.current.setView([lat!, lng!], mapRef.current.getZoom());
    }
  }, [lat, lng, hasPosition]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500">
        Haz clic en el mapa para seleccionar la ubicación del cliente
      </p>
      <div className="h-64 rounded-xl overflow-hidden border border-gray-200">
        <MapContainer
          center={hasPosition ? [lat!, lng!] : DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onChange={onChange} />
          {hasPosition && <Marker position={[lat!, lng!]} />}
        </MapContainer>
      </div>
      {hasPosition && (
        <p className="text-xs text-green-600 font-medium">
          Ubicación seleccionada: {lat}, {lng}
        </p>
      )}
    </div>
  );
}
