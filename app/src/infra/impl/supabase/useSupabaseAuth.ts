import type { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from './client.ts';

type AuthStatus = 'disabled' | 'loading' | 'authenticated' | 'unauthenticated';

type SupabaseAuthHook = {
  status: AuthStatus;
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const noopAsync = async () => {
  /* noop */
};

export const useSupabaseAuth = (enabled: boolean): SupabaseAuthHook => {
  const [status, setStatus] = useState<AuthStatus>(enabled ? 'loading' : 'disabled');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
      setUser(null);
      return;
    }

    const client = getSupabaseClient();
    let active = true;

    client.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) {
        setUser(null);
        setStatus('unauthenticated');
      } else {
        setUser(data.user);
        setStatus('authenticated');
      }
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setStatus(nextUser ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [enabled]);

  const signInWithGoogle = useCallback(async () => {
    if (!enabled) return;
    const client = getSupabaseClient();
    await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  }, [enabled]);

  const signOut = useCallback(async () => {
    if (!enabled) return;
    const client = getSupabaseClient();
    await client.auth.signOut();
  }, [enabled]);

  if (!enabled) {
    return {
      status,
      user: null,
      signInWithGoogle: noopAsync,
      signOut: noopAsync,
    };
  }

  return { status, user, signInWithGoogle, signOut };
};
