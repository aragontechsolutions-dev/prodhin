import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) throw new Error('No autenticado');

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error de red' }));
    throw new Error(error.message ?? 'Error del servidor');
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
