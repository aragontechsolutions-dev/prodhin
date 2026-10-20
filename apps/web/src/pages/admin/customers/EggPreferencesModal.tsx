import type { Customer } from '@prodhin/shared';
import Modal from '../../../components/ui/Modal';
import { useEggTypes, type EggType } from '../../../hooks/useEggTypes';
import {
  useCustomerPreferences,
  useAddPreference,
  useRemovePreference,
  useSetPrimaryPreference,
} from '../../../hooks/useCustomerPreferences';
import { getDisplayName } from './CustomersPage';

function eggDotColor(color: EggType['color']): string {
  if (color === 'rojo') return '#ef4444';
  if (color === 'blanco') return '#d1d5db';
  return '#f59e0b';
}

export default function EggPreferencesModal({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const { data: eggTypes } = useEggTypes();
  const { data: preferences } = useCustomerPreferences();
  const addPref = useAddPreference();
  const removePref = useRemovePreference();
  const setPrimary = useSetPrimaryPreference();

  const isOpen = customer !== null;
  const myPrefs = (preferences ?? []).filter((p) => p.customer_id === customer?.id);
  const selectedIds = new Set(myPrefs.map((p) => p.egg_type_id));
  const primaryId = myPrefs.find((p) => p.is_primary)?.egg_type_id ?? null;
  const busy = addPref.isPending || removePref.isPending || setPrimary.isPending;

  function toggle(eggTypeId: string) {
    if (!customer) return;
    if (selectedIds.has(eggTypeId)) {
      removePref.mutate({ customer_id: customer.id, egg_type_id: eggTypeId });
    } else {
      addPref.mutate({
        customer_id: customer.id,
        egg_type_id: eggTypeId,
        make_primary: myPrefs.length === 0,
      });
    }
  }

  function makePrimary(eggTypeId: string) {
    if (!customer || primaryId === eggTypeId) return;
    setPrimary.mutate({ customer_id: customer.id, egg_type_id: eggTypeId });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customer ? `Tipos de huevo — ${getDisplayName(customer)}` : 'Tipos de huevo'}
      size="lg"
    >
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Marcá los tipos que este cliente suele comprar. Con la estrella definís el
          <span className="font-semibold"> principal</span> (se usa para prellenar la entrega).
          El chofer igual puede entregar cualquier tipo.
        </p>

        <div className="flex flex-wrap gap-2">
          {(eggTypes ?? []).map((t) => {
            const selected = selectedIds.has(t.id);
            const isPrimary = primaryId === t.id;
            return (
              <div
                key={t.id}
                className={`flex items-center gap-2 rounded-full border pl-3 pr-2 py-1.5 transition
                  ${isPrimary
                    ? 'bg-amber-50 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700'
                    : selected
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800'
                      : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(t.id)}
                  className="flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: eggDotColor(t.color) }} />
                  <span className={`text-sm font-semibold ${
                    selected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300'
                  }`}>
                    {t.name}
                  </span>
                </button>
                {selected && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => makePrimary(t.id)}
                    title={isPrimary ? 'Principal' : 'Marcar como principal'}
                    className="text-base leading-none disabled:opacity-50 hover:scale-110 transition"
                  >
                    {isPrimary ? '⭐' : '☆'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {myPrefs.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Este cliente no tiene tipos asignados aún.</p>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
