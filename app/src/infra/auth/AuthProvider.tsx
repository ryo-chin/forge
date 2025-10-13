import React, { useMemo, type ReactNode } from 'react';
import { useSupabaseAuth } from '../supabase/useSupabaseAuth.ts';
import { isSupabaseDataSourceEnabled } from '../config/timeDataSource.ts';
import {
  AuthContext,
  fallbackAuthContext,
  type AuthContextValue,
} from './authContext.ts';

const detectAuthProvider = () =>
  isSupabaseDataSourceEnabled() ? 'supabase' : 'none';

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const provider = detectAuthProvider();
  const supabaseEnabled = provider === 'supabase';
  const supabaseAuth = useSupabaseAuth(supabaseEnabled);
  const { status, user, signInWithGoogle, signOut } = supabaseAuth;

  const value = useMemo<AuthContextValue>(() => {
    if (!supabaseEnabled) {
      return fallbackAuthContext;
    }
    return {
      provider,
      status,
      user,
      signIn: signInWithGoogle,
      signOut,
    };
  }, [
    provider,
    supabaseEnabled,
    signInWithGoogle,
    signOut,
    status,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
