import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';

export type AuthProviderType = 'none' | 'supabase';

export type AuthContextValue = {
  provider: AuthProviderType;
  status: 'disabled' | 'loading' | 'authenticated' | 'unauthenticated';
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const noopAsync = async () => {
  /* noop */
};

export const fallbackAuthContext: AuthContextValue = {
  provider: 'none',
  status: 'disabled',
  user: null,
  signIn: noopAsync,
  signOut: noopAsync,
};

export const AuthContext = createContext<AuthContextValue>(fallbackAuthContext);
