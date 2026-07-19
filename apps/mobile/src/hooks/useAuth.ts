import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { markSessionExpired } from '../lib/sessionNotice';
import type { Profile } from '../types';

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_active, must_change_password')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Error de red u otro problema transitorio: NO cerramos la sesión
      // (para no desloguear a un chofer que quedó sin conexión), solo no
      // autenticamos todavía.
      setProfile(null);
      setLoading(false);
      return;
    }

    if (!data || !data.is_active) {
      // No hay perfil (usuario borrado, p. ej. tras un reset) o está inactivo:
      // la sesión guardada ya no es válida → avisar, limpiarla y volver al login.
      markSessionExpired();
      try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* noop */ }
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(data);
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    // scope 'local' borra la sesión guardada aunque no haya red, así no se
    // restaura sola al volver al login (evita el "auto-login" tras logout).
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // ignorar errores de red: la sesión local igual se limpia
    }
    setProfile(null);
  }

  return { profile, setProfile, loading, signIn, signOut };
}
