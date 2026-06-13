import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth.store';

export function useAuth() {
  const { user, profile, isLoading, setUser, setProfile, signOut } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, full_name, role, is_active')
            .eq('id', session.user.id)
            .single();

          setProfile(profileData);
        } else {
          setProfile(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [setUser, setProfile]);

  return { user, profile, isLoading, signOut };
}
