import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, isEncryptedSecret } from '../tokenCrypto';

const key = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

describe('tokenCrypto', () => {
  it('encrypts and decrypts a secret with authenticated associated data', async () => {
    const encrypted = await encryptSecret(
      'google-refresh-token',
      key,
      'google_spreadsheet_connections.refresh_token',
    );

    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(encrypted).not.toContain('google-refresh-token');
    await expect(
      decryptSecret(encrypted, key, 'google_spreadsheet_connections.refresh_token'),
    ).resolves.toBe('google-refresh-token');
  });

  it('rejects ciphertext when associated data does not match', async () => {
    const encrypted = await encryptSecret(
      'google-refresh-token',
      key,
      'google_spreadsheet_connections.refresh_token',
    );

    await expect(
      decryptSecret(encrypted, key, 'google_spreadsheet_connections.access_token'),
    ).rejects.toThrow();
  });

  it('passes legacy plaintext through unchanged', async () => {
    await expect(decryptSecret('legacy-refresh-token', undefined, 'aad')).resolves.toBe(
      'legacy-refresh-token',
    );
  });

  it('requires configured key material for new encrypted writes', async () => {
    await expect(encryptSecret('secret', undefined, 'aad')).rejects.toThrow(
      'TOKEN_ENCRYPTION_KEY is required',
    );
  });
});
