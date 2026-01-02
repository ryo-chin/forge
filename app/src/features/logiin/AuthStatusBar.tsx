import React from 'react';
import { useAuth } from '@infra/auth';

const extractDisplayName = (
  name: string | undefined,
  email: string | null | undefined,
): { primary: string; secondary: string } => {
  if (name && name.trim().length > 0) {
    return { primary: name.trim(), secondary: email ?? '' };
  }
  if (email) {
    const [localPart] = email.split('@');
    return { primary: localPart || email, secondary: email };
  }
  return { primary: 'ログイン中', secondary: '' };
};

const buildAvatarLabel = (display: string): string => {
  const trimmed = display.trim();
  if (!trimmed) return 'U';
  const firstChar = trimmed[0];
  return firstChar.toUpperCase();
};

export const AuthStatusBar: React.FC = () => {
  const { provider, status, user, signOut } = useAuth();

  if (provider !== 'supabase' || status !== 'authenticated') {
    return null;
  }

  const supabaseUser = user ?? null;
  const name = (supabaseUser?.user_metadata as { name?: string } | null)?.name ?? undefined;
  const email = supabaseUser?.email;
  const { primary, secondary } = extractDisplayName(name, email);
  const avatarLabel = buildAvatarLabel(primary);

  return (
    <div className="app-sidebar__auth">
      <span aria-hidden="true" className="app-sidebar__avatar">
        {avatarLabel}
      </span>
      <div className="app-sidebar__info">
        <span className="app-sidebar__name" title={primary}>
          {primary}
        </span>
        {secondary ? (
          <span className="app-sidebar__meta" title={secondary}>
            {secondary}
          </span>
        ) : null}
      </div>
      <button type="button" className="app-sidebar__signout" onClick={signOut}>
        ログアウト
      </button>
    </div>
  );
};
