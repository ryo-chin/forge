import { describe, expect, it } from 'vitest';
import { buildOAuthRedirectPath } from './oauthRedirectPath.ts';

describe('buildOAuthRedirectPath', () => {
  it('keeps only the app-relative path, query, and hash', () => {
    expect(
      buildOAuthRedirectPath({
        pathname: '/settings',
        search: '?tab=google',
        hash: '#connect',
      }),
    ).toBe('/settings?tab=google#connect');
  });

  it('falls back to settings when pathname is malformed', () => {
    expect(
      buildOAuthRedirectPath({
        pathname: 'https://evil.example/settings',
        search: '',
        hash: '',
      }),
    ).toBe('/settings');
  });
});
