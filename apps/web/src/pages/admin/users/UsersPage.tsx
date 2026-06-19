import { useState } from 'react';
import { toast } from 'sonner';
import { normalizeUruguayPhone } from '../../../utils/phone';
import Pagination from '../../../components/ui/Pagination';
import { usePagination } from '../../../hooks/usePagination';
import { useUsers, useCreateUser, useUpdateUser, useToggleUserActive, useResetPassword, useForcePasswordChange, type Profile } from '../../../hooks/useUsers';
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
  email_confirmed: true, must_change_password: true,
};

export default function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const toggleActive = useToggleUserActive();

  const resetPassword = useResetPassword();
  const forcePasswordChange = useForcePasswordChange();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null);
  const [form, setForm] = useState<UserFormData>(defaultForm);
  const [resetModalUser, setResetModalUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetModalUser) return;
    try {
      await resetPassword.mutateAsync({ id: resetModalUser.id, password: newPassword });
      toast.success(`Contraseña de ${resetModalUser.full_name} actualizada. Se forzará cambio en el próximo login.`);
      setResetModalUser(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar la contraseña');
    }
  }

  async function handleForcePasswordChange(user: Profile) {
    const next = !user.must_change_password;
    try {
      await forcePasswordChange.mutateAsync({ id: user.id, must_change_password: next });
      toast.success(next ? `Se forzará cambio de contraseña a ${user.full_name}` : `Forzado removido para ${user.full_name}`);
    } catch {
      toast.error('Error al actualizar el usuario');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Usuarios</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Gestiona los usuarios del sistema</p>
        </div>
        <Button onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo usuario
        </Button>
      </div>

      {/* Tabla / Cards */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
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
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Nombre</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Rol</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Estado</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Teléfono</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {paginated.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs flex-shrink-0">
                            {user.full_name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{user.full_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={user.role === 'admin' ? 'blue' : 'yellow'}>
                          {user.role === 'admin' ? 'Admin' : 'Chofer'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={user.is_active ? 'green' : 'red'}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                          {user.must_change_password && (
                            <Badge variant="yellow">Cambio pendiente</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400">{user.phone ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(user)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setResetModalUser(user); setNewPassword(''); setShowPassword(false); }}>
                            Cambiar pass
                          </Button>
                          <button
                            title={user.must_change_password ? 'Quitar forzado de cambio' : 'Forzar cambio en próximo login'}
                            onClick={() => handleForcePasswordChange(user)}
                            className={`p-1.5 rounded-lg transition ${user.must_change_password ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </button>
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
            <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {paginated.map((user) => (
                <div key={user.id} className="p-4 space-y-2 dark:bg-gray-900">
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
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={user.role === 'admin' ? 'blue' : 'yellow'}>
                        {user.role === 'admin' ? 'Admin' : 'Chofer'}
                      </Badge>
                      <Badge variant={user.is_active ? 'green' : 'red'}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                      {user.must_change_password && (
                        <Badge variant="yellow">Cambio pendiente</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(user)} className="flex-1">
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setResetModalUser(user); setNewPassword(''); setShowPassword(false); }} className="flex-1">
                      Cambiar pass
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

      {/* Modal cambiar contraseña */}
      <Modal isOpen={!!resetModalUser} onClose={() => setResetModalUser(null)} title={`Cambiar contraseña — ${resetModalUser?.full_name ?? ''}`}>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Establecé una contraseña temporal. El usuario deberá cambiarla al iniciar sesión.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 pr-10 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-amber-700 dark:text-amber-300">Se activará automáticamente "forzar cambio en próximo login".</p>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" type="button" onClick={() => setResetModalUser(null)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" isLoading={resetPassword.isPending} className="flex-1">
              Cambiar contraseña
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
