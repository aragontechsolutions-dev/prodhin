import { useMemo, useState } from 'react';
import { useTruckStock } from '../../../hooks/useTruckStock';
import { useUsers } from '../../../hooks/useUsers';
import { useEggTypes, type EggType } from '../../../hooks/useEggTypes';
import RecountModal from './RecountModal';
import LoadModal from './LoadModal';

function dotColor(color: EggType['color']): string {
  if (color === 'rojo') return '#ef4444';
  if (color === 'blanco') return '#d1d5db';
  return '#f59e0b';
}
function cajones(cp: number): string {
  const c = cp / 2;
  return Number.isInteger(c) ? String(c) : c.toFixed(1);
}

export default function StockPage() {
  const { data: stock, isLoading } = useTruckStock();
  const { data: users } = useUsers();
  const { data: eggTypes } = useEggTypes();

  const eggMap = useMemo(() => {
    const m = new Map<string, EggType>();
    (eggTypes ?? []).forEach((t) => m.set(t.id, t));
    return m;
  }, [eggTypes]);

  const byDriver = useMemo(() => {
    const m = new Map<string, { egg: EggType; cp: number }[]>();
    for (const r of stock ?? []) {
      if (r.cajas_plasticas <= 0) continue;
      const egg = eggMap.get(r.egg_type_id);
      if (!egg) continue;
      const arr = m.get(r.driver_id) ?? [];
      arr.push({ egg, cp: r.cajas_plasticas });
      m.set(r.driver_id, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.egg.sort_order - b.egg.sort_order);
    return m;
  }, [stock, eggMap]);

  // Stock por chofer como Map<egg_type_id, cp> (para prellenar el recuento)
  const stockByDriver = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const r of stock ?? []) {
      const dm = m.get(r.driver_id) ?? new Map<string, number>();
      dm.set(r.egg_type_id, r.cajas_plasticas);
      m.set(r.driver_id, dm);
    }
    return m;
  }, [stock]);

  const [recounting, setRecounting] = useState<{ id: string; name: string } | null>(null);
  const [loading2, setLoading2] = useState<{ id: string; name: string } | null>(null);

  const choferes = (users ?? []).filter((u) => u.role === 'chofer' && u.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stock de camiones</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Lo que hay en cada camión ahora (último recuento + cargas − entregas).
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : choferes.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center text-sm text-gray-400 border border-gray-100 dark:border-gray-800">
          No hay choferes activos.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {choferes.map((c) => {
            const items = byDriver.get(c.id) ?? [];
            const totalCp = items.reduce((s, it) => s + it.cp, 0);
            return (
              <div key={c.id} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">🚚</span>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{c.full_name}</p>
                  </div>
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-1 rounded-full whitespace-nowrap">
                    {totalCp} cp · {cajones(totalCp)} cj
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-gray-400 text-center">Camión vacío o sin datos.</p>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {items.map((it) => (
                      <div key={it.egg.id} className="px-5 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor(it.egg.color) }} />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{it.egg.name}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {it.cp} cp <span className="text-xs font-medium text-gray-400">· {cajones(it.cp)} cj</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                  <button
                    onClick={() => setLoading2({ id: c.id, name: c.full_name })}
                    className="flex-1 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg py-2 transition"
                  >
                    ➕ Registrar carga
                  </button>
                  <button
                    onClick={() => setRecounting({ id: c.id, name: c.full_name })}
                    className="flex-1 text-sm font-semibold text-teal-700 dark:text-teal-400 border border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg py-2 transition"
                  >
                    🔢 Recuento
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        cp = cajas plásticas · cj = cajones (1 cajón = 2 cajas plásticas). El admin registra cargas y recuentos acá; el chofer solo ve su stock. Las entregas descuentan solas.
      </p>

      <LoadModal
        driverId={loading2?.id ?? null}
        driverName={loading2?.name ?? ''}
        currentStock={loading2 ? (stockByDriver.get(loading2.id) ?? new Map()) : new Map()}
        onClose={() => setLoading2(null)}
      />
      <RecountModal
        driverId={recounting?.id ?? null}
        driverName={recounting?.name ?? ''}
        currentStock={recounting ? (stockByDriver.get(recounting.id) ?? new Map()) : new Map()}
        onClose={() => setRecounting(null)}
      />
    </div>
  );
}
