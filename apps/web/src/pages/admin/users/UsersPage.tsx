import { useState } from 'react';
import { toast } from 'sonner';
import { normalizeUruguayPhone } from '../../../utils/phone';
import Pagination from '../../../components/ui/Pagination';
import { usePagination } from '../../../hooks/usePagination';
import { useUsers, useCreateUser, useUpdateUser, useToggleUserActive, type Profile } from '../../../hooks/useUsers';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';

const roleOptions = [
  { value: 'chofer', label: 'Chofer' },
  { value: 'admin', label: 'Admin' },
];

interface UserFormData {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: 'admin' | 'chofer';
  email_confirmed: boolean;
  must_change_password: boolean;
}

const defaultForm: UserFormData = {
  email: '', password: '', full_name: '', phone: '', role: 'chofer',
  email_confirmed: true, must_change_password: false,
};

export default function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const toggleActive = useToggleUserActive();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null);
  const [form, setForm] = useState<UserFormData>(defaultForm);

  function openCreate() {
    setEditingUser(null);
    setForm(defaultForm);
    setModalOpen(true);
  }

  function openEdit(user: Profile) {
    setEditingUser(user);
    setForm({
      email: user.email ?? '',
      password: '',
      full_name: user.full_name,
      phone: user.phone ?? '',
      role: user.role,
      email_confirmed: true,
      must_change_password: user.must_change_password ?? false,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingUser) {
        await updateUser.mutateAsync({
          id: editingUser.id,
          data: { full_name: form.full_name, phone: form.phone ? normalizeUruguayPhone(form.phone) : null, role: form.role, must_change_password: form.must_change_password },
        });
        toast.success('Usuario actualizado correctamente');
      } else {
        if (!form.password || form.password.length < 6) {
          toast.error('La contraseña debe tener al menos 6 caracteres');
          return;
        }
        await createUser.mutateAsync({
          ...form,
          phone: form.phone ? normalizeUruguayPhone(form.phone) : '',
          must_change_password: form.must_change_password,
        });
        toast.success('Usuario creado correctamente');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar el usuario');
    }
  }

  async function handleToggleActive() {
    if (!confirmUser) return;
    try {
      await toggleActive.mutateAsync({ id: confirmUser.id, is_active: !confirmUser.is_active });
      toast.success(`Usuario ${confirmUser.is_active ? 'desactivado' : 'activado'} correctamente`);
    } catch {
      toast.error('Error al cambiar el estado del usuario');
    }
    setConfirmUser(null);
  }

  const isSubmitting = createUser.isPending || updateUser.isPending;
  const { paginated, page, totalPages, pageSize, changePage, changePageSize } = usePagination(users ?? []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona los usuarios del sistema</p>
        </div>
        <Button onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo usuario
        </Button>
      </div>

      {/* Tabla / Cards */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !users?.length ? (
          <div className="text-center py-16 text-gray-500 text-sm">
            No hay usuarios registrados aún.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Nombre</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Rol</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Estado</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Teléfono</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs flex-shrink-0">
                            {user.full_name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.full_name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={user.role === 'admin' ? 'blue' : 'yellow'}>
                          {user.role === 'admin' ? 'Admin' : 'Chofer'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={user.is_active ? 'green' : 'red'}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{user.phone ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(user)}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant={user.is_active ? 'danger' : 'secondary'}
                            onClick={() => setConfirmUser(user)}
                          >
                            {user.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {paginated.map((user) => (
                <div key={user.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs">
                        {user.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{user.full_name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant={user.role === 'admin' ? 'blue' : 'yellow'}>
                        {user.role === 'admin' ? 'Admin' : 'Chofer'}
                      </Badge>
                      <Badge variant={user.is_active ? 'green' : 'red'}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(user)} className="flex-1">
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant={user.is_active ? 'danger' : 'secondary'}
                      onClick={() => setConfirmUser(user)}
                      className="flex-1"
                    >
                      {user.is_active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              total={users?.length ?? 0}
              onPageChange={changePage}
              onPageSizeChange={changePageSize}
            />
          </>
        )}
      </div>

      {/* Modal crear/editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? 'Editar usuario' : 'Nuevo usuario'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre completo"
            required
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="Juan Pérez"
          />
          {!editingUser && (
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="usuario@email.com"
            />
          )}
          {!editingUser && (
            <Input
              label="Contraseña"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
              hint="El usuario podrá cambiarla luego"
            />
          )}
          <Input
            label="Teléfono"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="09X XXX XXX o +598 9X XXX XXX"
          />
          <Select
            label="Rol"
            required
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'chofer' }))}
            options={roleOptions}
          />

          {!editingUser && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.email_confirmed}
                onChange={(e) => setForm((f) => ({ ...f, email_confirmed: e.target.checked }))}
                className="w-4 h-4 accent-primary-500 rounded"
              />
              <span className="text-sm text-gray-700">
                Verificar email automáticamente
              </span>
            </label>
          )}

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.must_change_password}
              onChange={(e) => setForm((f) => ({ ...f, must_change_password: e.target.checked }))}
              className="w-4 h-4 accent-primary-500 rounded"
            />
            <span className="text-sm text-gray-700">
              Forzar cambio de contraseña en el próximo inicio de sesión
            </span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="flex-1">
              {editingUser ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmar activar/desactivar */}
      <ConfirmDialog
        isOpen={!!confirmUser}
        onClose={() => setConfirmUser(null)}
        onConfirm={handleToggleActive}
        isLoading={toggleActive.isPending}
        title={confirmUser?.is_active ? 'Desactivar usuario' : 'Activar usuario'}
        message={
          confirmUser?.is_active
            ? `¿Desactivar a ${confirmUser?.full_name}? No podrá iniciar sesión.`
            : `¿Activar a ${confirmUser?.full_name}? Podrá acceder al sistema nuevamente.`
        }
      />
    </div>
  );
}
