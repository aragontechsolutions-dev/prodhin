import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Customer } from '@prodhin/shared';
import { getDisplayName } from './CustomersPage';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';

function makeIcon(type: 'empresa' | 'persona_fisica') {
  const isEmpresa = type === 'empresa';
  const bg = isEmpresa ? '#3b82f6' : '#eab308';
  const emoji = isEmpresa ? '🏢' : '👤';
  const html = `
    <div style="
      width:36px;height:36px;border-radius:50% 50% 50% 0;
      background:${bg};transform:rotate(-45deg);
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
    ">
      <span style="transform:rotate(45deg);font-size:16px;line-height:1">${emoji}</span>
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -36] });
}

interface Props {
  customers: Customer[];
  onEdit: (c: Customer) => void;
}

const DEFAULT_CENTER: [number, number] = [-34.9011, -54.9595]; // Maldonado, Uruguay

export default function CustomerMapView({ customers, onEdit }: Props) {
  const active = customers.filter((c) => c.is_active && c.lat && c.lng);
  const [selected, setSelected] = useState<Customer | null>(null);

  return (
    <div className="relative">
      <div className="h-[60vh] rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {active.map((c) => (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={makeIcon(c.customer_type)}
              eventHandlers={{ click: () => setSelected(c) }}
            >
              <Popup>
                <div className="min-w-[160px] space-y-1">
                  <p className="font-semibold text-gray-900 text-sm">{getDisplayName(c)}</p>
                  <p className="text-xs text-gray-600">{c.phone}</p>
                  <p className="text-xs text-gray-500 leading-tight">{c.address}</p>
                  <button
                    onClick={() => onEdit(c)}
                    className="text-xs text-primary-600 font-medium hover:underline mt-1"
                  >
                    Editar cliente →
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Panel lateral de cliente seleccionado (mobile) */}
      {selected && (
        <div className="mt-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900">{getDisplayName(selected)}</p>
              <Badge variant={selected.customer_type === 'empresa' ? 'blue' : 'yellow'}>
                {selected.customer_type === 'empresa' ? 'Empresa' : 'Persona'}
              </Badge>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              ✕
            </button>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p>📞 {selected.phone}</p>
            <p>📍 {selected.address}</p>
            {selected.contact_name && <p>👤 {selected.contact_name}</p>}
            {selected.notes && <p className="text-gray-500 text-xs">{selected.notes}</p>}
          </div>
          <Button size="sm" onClick={() => onEdit(selected)} className="w-full">
            Editar cliente
          </Button>
        </div>
      )}

      <p className="text-xs text-gray-500 text-center mt-2">
        {active.length} cliente{active.length !== 1 ? 's' : ''} en el mapa · Haz clic en un pin para ver detalles
      </p>
    </div>
  );
}
