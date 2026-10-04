import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { useEggTypes } from '../../../hooks/useEggTypes';
import { useUpdateDelivery, DELIVERY_STATUS_LABEL, type DeliveryRow, type DeliveryStatus, type PaymentMethod } from '../../../hooks/useDeliveries';
import { priceUnitLabel } from '../../../lib/pricing';

const STATUSES: DeliveryStatus[] = ['entregado', 'cliente_ausente', 'rechazado', 'sin_stock'];

interface EditItem { egg_type_id: string; cajas: number; price: string }

export default function EditDeliveryModal({ delivery, onClose }: { delivery: DeliveryRow | null; onClose: () => void }) {
  const { data: eggTypes } = useEggTypes();
  const update = useUpdateDelivery();

  const [status, setStatus] = useState<DeliveryStatus>('entregado');
  const [mode, setMode] = useState<'cp' | 'cartones'>('cp');
  const [payment, setPayment] = useState<PaymentMethod>('efectivo');
  const [recogidas, setRecogidas] = useState(0);
  const [devueltas, setDevueltas] = useState(0);
  const [items, setItems] = useState<EditItem[]>([]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!delivery) return;
    setStatus(delivery.status);
    setMode(delivery.mode);
    setPayment(delivery.payment_method ?? 'efectivo');
    setRecogidas(delivery.cajas_recogidas);
    setDevueltas(delivery.cajas_devueltas ?? 0);
    setItems(delivery.items.map((it) => ({ egg_type_id: it.egg_type_id, cajas: it.cajas_plasticas, price: it.unit_price != null ? String(it.unit_price) : '' })));
    setReason('');
  }, [delivery]);

  const active = (eggTypes ?? []).filter((t) => t.is_active);
  const typeById = (id: string) => (eggTypes ?? []).find((t) => t.id === id);

  function setItem(i: number, patch: Partial<EditItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addItem() {
    const first = active[0]?.id ?? '';
    setItems((prev) => [...prev, { egg_type_id: first, cajas: 0, price: '' }]);
  }

  async function save() {
    if (!delivery) return;
    if (!reason.trim()) {
      toast.error('Escribí el motivo de la corrección');
      return;
    }
    // Validación de precio mínimo
    if (status === 'entregado') {
      for (const it of items) {
        const t = typeById(it.egg_type_id);
        const price = parseFloat(it.price.replace(',', '.'));
        if (it.cajas > 0 && t?.min_price != null && (!Number.isFinite(price) || price < t.min_price)) {
          toast.error(`${t.name}: el precio no puede ser menor a $${t.min_price} por ${priceUnitLabel(t.is_packaged)}`);
          return;
        }
      }
    }
    try {
      await update.mutateAsync({
        id: delivery.id,
        status,
        mode,
        payment_method: status === 'entregado' ? payment : null,
        cajas_recogidas: recogidas,
        cajas_devueltas: mode === 'cp' ? devueltas : 0,
        reason: reason.trim(),
        items: status === 'entregado' ? items.map((it) => {
          const t = typeById(it.egg_type_id);
          const price = parseFloat(it.price.replace(',', '.'));
          return {
            egg_type_id: it.egg_type_id,
            cajas_plasticas: it.cajas,
            unit_price: Number.isFinite(price) && price > 0 ? price : null,
            is_packaged: t?.is_packaged ?? false,
            packages_per_box: t?.packages_per_box ?? null,
          };
        }) : [],
      });
      toast.success('Entrega corregida');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  return (
    <Modal isOpen={delivery !== null} onClose={onClose} title="Corregir entrega" size="lg">
      <div className="p-6 space-y-4">
        {delivery && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {delivery.customer_name} · {delivery.driver_name} · {new Date(delivery.delivered_at).toLocaleDateString('es-UY')}
          </p>
        )}

        {/* Estado */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {STATUSES.map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)}
                className={`text-sm px-3 py-1.5 rounded-full border ${status === s ? 'bg-primary-500 text-white border-primary-500' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                {DELIVERY_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {status === 'entregado' && (
          <>
            {/* Forma de pago */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Forma de pago</label>
              <div className="flex gap-2 mt-1">
                {(['efectivo', 'credito'] as PaymentMethod[]).map((p) => (
                  <button key={p} type="button" onClick={() => setPayment(p)}
                    className={`text-sm px-3 py-1.5 rounded-full border ${payment === p ? 'bg-primary-500 text-white border-primary-500' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'}`}>
                    {p === 'credito' ? 'Crédito' : 'Efectivo'}
                  </button>
                ))}
              </div>
            </div>

            {/* Líneas */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipos, cantidades (cp) y precio</label>
              <div className="space-y-2 mt-1">
                {items.map((it, i) => {
                  const t = typeById(it.egg_type_id);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={it.egg_type_id}
                        onChange={(e) => setItem(i, { egg_type_id: e.target.value })}
                        className="flex-1 text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100"
                      >
                        {active.map((at) => <option key={at.id} value={at.id}>{at.name}</option>)}
                      </select>
                      <input
                        type="number" min={0}
                        value={it.cajas}
                        onChange={(e) => setItem(i, { cajas: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-16 text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 text-center"
                        title="Cajas plásticas"
                      />
                      <input
                        type="number" min={0}
                        value={it.price}
                        onChange={(e) => setItem(i, { price: e.target.value.replace(/[^0-9.,]/g, '') })}
                        placeholder={t ? `$/${priceUnitLabel(t.is_packaged)}` : '$'}
                        className="w-24 text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 text-center"
                        title={t ? `Precio por ${priceUnitLabel(t.is_packaged)}${t.min_price != null ? ` (mín. $${t.min_price})` : ''}` : 'Precio'}
                      />
                      <button type="button" onClick={() => removeItem(i)} className="text-red-500 px-2">✕</button>
                    </div>
                  );
                })}
                <button type="button" onClick={addItem} className="text-sm text-primary-600 dark:text-primary-400 font-medium">+ Agregar tipo</button>
              </div>
            </div>

            {/* Modo + recogidas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Modo</label>
                <select value={mode} onChange={(e) => setMode(e.target.value as 'cp' | 'cartones')}
                  className="w-full mt-1 text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100">
                  <option value="cp">Deja cajas plásticas</option>
                  <option value="cartones">En cartones</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cajas recogidas</label>
                <input type="number" min={0} value={recogidas}
                  onChange={(e) => setRecogidas(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full mt-1 text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100" />
              </div>
            </div>
            {mode === 'cp' && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cajas devueltas en el acto</label>
                <input type="number" min={0} value={devueltas}
                  onChange={(e) => setDevueltas(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full mt-1 text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100" />
                <p className="text-xs text-gray-400 mt-1">De las que se dejaron, cuántas se vaciaron y volvieron en el momento.</p>
              </div>
            )}
          </>
        )}

        {/* Motivo (obligatorio) */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Motivo de la corrección <span className="text-red-500">*</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: el chofer marcó Rojo Mediano pero entregó Blanco Mediano."
            className="w-full mt-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 min-h-[70px]"
          />
          <p className="text-xs text-gray-400 mt-1">Queda registrado en la auditoría.</p>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={update.isPending}>Cancelar</Button>
          <Button type="button" onClick={save} isLoading={update.isPending}>Guardar corrección</Button>
        </div>
      </div>
    </Modal>
  );
}
