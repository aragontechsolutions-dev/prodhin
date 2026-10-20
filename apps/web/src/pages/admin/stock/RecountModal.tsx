import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { useEggTypes, type EggType } from '../../../hooks/useEggTypes';
import { useRegisterCount } from '../../../hooks/useTruckStock';

interface Props {
  driverId: string | null;
  driverName: string;
  currentStock: Map<string, number>; // egg_type_id -> cp (del chofer)
  onClose: () => void;
}

function dotColor(color: EggType['color']): string {
  if (color === 'rojo') return '#ef4444';
  if (color === 'blanco') return '#d1d5db';
  return '#f59e0b';
}

export default function RecountModal({ driverId, driverName, currentStock, onClose }: Props) {
  const { data: eggTypes } = useEggTypes();
  const register = useRegisterCount();
  const [values, setValues] = useState<Record<string, string>>({});

  const active = (eggTypes ?? []).filter((t) => t.is_active);

  useEffect(() => {
    if (!driverId) return;
    const init: Record<string, string> = {};
    active.forEach((t) => { init[t.id] = String(currentStock.get(t.id) ?? 0); });
    setValues(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  async function save() {
    if (!driverId) return;
    const items = active.map((t) => ({
      egg_type_id: t.id,
      cajas_plasticas: parseInt((values[t.id] ?? '0').replace(/[^0-9]/g, ''), 10) || 0,
    }));
    try {
      await register.mutateAsync({ driver_id: driverId, items });
      toast.success('Recuento registrado');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  return (
    <Modal isOpen={driverId !== null} onClose={onClose} title={`Recuento — ${driverName}`} size="md">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ingresá cuántas cajas plásticas hay REALMENTE en el camión de cada tipo (valor contado).
          Una categoría sin valor se toma como 0. Esto fija el stock y corrige cualquier desvío.
        </p>
        <div className="space-y-2">
          {active.map((t) => (
            <div key={t.id} className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor(t.color) }} />
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{t.name}</span>
              <input
                type="number" min={0}
                placeholder="0"
                value={values[t.id] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [t.id]: e.target.value }))}
                onBlur={(e) => { if (e.target.value.trim() === '') setValues((v) => ({ ...v, [t.id]: '0' })); }}
                className="w-24 text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 text-center"
              />
              <span className="text-xs text-gray-400 w-6">cp</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={register.isPending}>Cancelar</Button>
          <Button type="button" onClick={save} isLoading={register.isPending}>Guardar recuento</Button>
        </div>
      </div>
    </Modal>
  );
}
