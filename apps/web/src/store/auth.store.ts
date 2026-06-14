import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'chofer';
  is_active: boolean;
  must_change_password: boolean;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      isLoading: true,
      setUser: (user) => set({ user, isLoading: false }),
      setProfile: (profile) => set({ profile }),
      signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, profile: null });
      },
    }),
    {
      name: 'prodhin-auth',
      partialize: (state) => ({ profile: state.profile }),
    },
  ),
);
