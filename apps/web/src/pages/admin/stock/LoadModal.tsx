import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { useEggTypes, type EggType } from '../../../hooks/useEggTypes';
import { useRegisterLoad } from '../../../hooks/useTruckStock';

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

export default function LoadModal({ driverId, driverName, currentStock, onClose }: Props) {
  const { data: eggTypes } = useEggTypes();
  const register = useRegisterLoad();
  const [values, setValues] = useState<Record<string, string>>({});

  const active = (eggTypes ?? []).filter((t) => t.is_active);

  useEffect(() => {
    if (!driverId) return;
    setValues({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  async function save() {
    if (!driverId) return;
    const items = active.map((t) => ({
      egg_type_id: t.id,
      cajas_plasticas: parseInt((values[t.id] ?? '0').replace(/[^0-9]/g, ''), 10) || 0,
    }));
    if (items.every((it) => it.cajas_plasticas === 0)) {
      toast.error('Ingresá al menos una cantidad a cargar');
      return;
    }
    try {
      await register.mutateAsync({ driver_id: driverId, items });
      toast.success('Carga registrada');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  return (
    <Modal isOpen={driverId !== null} onClose={onClose} title={`Registrar carga — ${driverName}`} size="md">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ingresá cuántas cajas plásticas se SUMAN al camión de cada tipo. Los campos vacíos no se cargan.
        </p>
        <div className="space-y-2">
          {active.map((t) => (
            <div key={t.id} className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor(t.color) }} />
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                {t.name}
                <span className="text-xs text-gray-400 ml-2">en camión: {currentStock.get(t.id) ?? 0}</span>
              </span>
              <span className="text-gray-400 text-sm">+</span>
              <input
                type="number" min={0}
                placeholder="0"
                value={values[t.id] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [t.id]: e.target.value }))}
                className="w-24 text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 text-center"
              />
              <span className="text-xs text-gray-400 w-6">cp</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={register.isPending}>Cancelar</Button>
          <Button type="button" onClick={save} isLoading={register.isPending}>Registrar carga</Button>
        </div>
      </div>
    </Modal>
  );
}
