import { useState } from 'react';
import { toast } from 'sonner';
import {
  useEggTypes,
  useCreateEggType,
  useUpdateEggType,
  useDeleteEggType,
  type EggType,
} from '../../../hooks/useEggTypes';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';

const colorOptions = [
  { value: '', label: 'Sin color (otro)' },
  { value: 'rojo', label: 'Rojo' },
  { value: 'blanco', label: 'Blanco' },
];

function dotColor(color: EggType['color']): string {
  if (color === 'rojo') return '#ef4444';
  if (color === 'blanco') return '#d1d5db';
  return '#f59e0b';
}

export default function EggTypesPage() {
  const { data: eggTypes, isLoading } = useEggTypes();
  const createEgg = useCreateEggType();
  const updateEgg = useUpdateEggType();
  const deleteEgg = useDeleteEggType();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EggType | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EggType | null>(null);

  const [form, setForm] = useState({ name: '', color: '' as '' | 'rojo' | 'blanco', sort_order: 0, is_active: true, eggs_per_package: '', packages_per_box: '' });

  function openCreate() {
    const nextOrder = (eggTypes ?? []).reduce((max, t) => Math.max(max, t.sort_order), 0) + 10;
    setEditing(null);
    setForm({ name: '', color: '', sort_order: nextOrder, is_active: true, eggs_per_package: '', packages_per_box: '' });
    setFormOpen(true);
  }

  function openEdit(t: EggType) {
    setEditing(t);
    setForm({
      name: t.name, color: t.color ?? '', sort_order: t.sort_order, is_active: t.is_active,
      eggs_per_package: t.eggs_per_package != null ? String(t.eggs_per_package) : '',
      packages_per_box: t.packages_per_box != null ? String(t.packages_per_box) : '',
    });
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    const epp = parseInt(form.eggs_per_package, 10);
    const ppb = parseInt(form.packages_per_box, 10);
    const input = {
      name: form.name.trim(),
      color: form.color === '' ? null : form.color,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
      eggs_per_package: Number.isFinite(epp) && epp > 0 ? epp : null,
      packages_per_box: Number.isFinite(ppb) && ppb > 0 ? ppb : null,
    };
    try {
      if (editing) {
        await updateEgg.mutateAsync({ id: editing.id, input });
        toast.success('Categoría actualizada');
      } else {
        await createEgg.mutateAsync(input);
        toast.success('Categoría creada');
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  async function toggleActive(t: EggType) {
    try {
      await updateEgg.mutateAsync({ id: t.id, input: { is_active: !t.is_active } });
      toast.success(t.is_active ? 'Categoría desactivada' : 'Categoría activada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteEgg.mutateAsync(confirmDelete.id);
      toast.success('Categoría eliminada');
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
      setConfirmDelete(null);
    }
  }

  const isSaving = createEgg.isPending || updateEgg.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Categorías de huevo</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestioná los tipos de huevo disponibles en la app
          </p>
        </div>
        <Button onClick={openCreate}>+ Nueva categoría</Button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !(eggTypes ?? []).length ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
            No hay categorías. Creá la primera.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Categoría</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Color</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Envase</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Orden</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {(eggTypes ?? []).map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: dotColor(t.color) }} />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 capitalize">{t.color ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 text-xs">
                      {t.eggs_per_package != null || t.packages_per_box != null
                        ? `${t.eggs_per_package ?? '?'} huevos/paq · ${t.packages_per_box ?? '?'} paq/caja`
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400">{t.sort_order}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={t.is_active ? 'green' : 'red'}>{t.is_active ? 'Activa' : 'Inactiva'}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(t)}>
                          {t.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(t)}>Eliminar</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Consejo: si una categoría ya tiene entregas o preferencias, no se puede eliminar.
        Desactivala para que deje de aparecer en la app sin perder el historial.
      </p>

      {/* Modal crear/editar */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar categoría' : 'Nueva categoría'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ej: Rojo Mediano"
            required
          />
          <Select
            label="Color"
            value={form.color}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value as '' | 'rojo' | 'blanco' }))}
            options={colorOptions}
          />
          <Input
            label="Orden"
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
            hint="Menor número aparece primero"
          />
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Envasado (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Huevos por paquete"
                type="number"
                value={form.eggs_per_package}
                onChange={(e) => setForm((f) => ({ ...f, eggs_per_package: e.target.value.replace(/[^0-9]/g, '') }))}
                placeholder="Ej: 6"
              />
              <Input
                label="Paquetes por caja"
                type="number"
                value={form.packages_per_box}
                onChange={(e) => setForm((f) => ({ ...f, packages_per_box: e.target.value.replace(/[^0-9]/g, '') }))}
                placeholder="Ej: 24"
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Solo para productos envasados. Sirve para el control fino de devoluciones (ej: 4 paquetes de "x6" = 24 huevos).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300"
            />
            Activa (visible en la app)
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmar eliminación */}
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Eliminar categoría"
        message={`¿Eliminar "${confirmDelete?.name}"? Si tiene entregas o preferencias asociadas no se podrá borrar; en ese caso desactivala.`}
        isLoading={deleteEgg.isPending}
      />
    </div>
  );
}
