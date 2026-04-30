const ENCRYPTED_SECRET_PREFIX = 'enc:v1';
const AES_GCM_IV_BYTES = 12;
const AES_256_KEY_BYTES = 32;

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenCryptoError';
  }
}

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
};

const base64UrlToBytes = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const hexToBytes = (value: string): Uint8Array => {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
};

const decodeKeyMaterial = (keyMaterial: string | undefined): Uint8Array => {
  if (!keyMaterial || keyMaterial.trim().length === 0) {
    throw new TokenCryptoError('TOKEN_ENCRYPTION_KEY is required');
  }

  const trimmed = keyMaterial.trim();
  const bytes = /^[0-9a-f]{64}$/iu.test(trimmed) ? hexToBytes(trimmed) : base64UrlToBytes(trimmed);
  if (bytes.byteLength !== AES_256_KEY_BYTES) {
    throw new TokenCryptoError('TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
  }
  return bytes;
};

const importAesKey = async (keyMaterial: string | undefined): Promise<CryptoKey> => {
  const keyBytes = decodeKeyMaterial(keyMaterial);
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

const aadBytes = (associatedData: string): Uint8Array => new TextEncoder().encode(associatedData);

export const isEncryptedSecret = (value: string): boolean =>
  value.startsWith(`${ENCRYPTED_SECRET_PREFIX}:`);

export const encryptSecret = async (
  plaintext: string,
  keyMaterial: string | undefined,
  associatedData: string,
): Promise<string> => {
  if (plaintext.length === 0) {
    return plaintext;
  }

  const key = await importAesKey(keyMaterial);
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  crypto.getRandomValues(iv);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aadBytes(associatedData),
    },
    key,
    new TextEncoder().encode(plaintext),
  );

  return [
    ENCRYPTED_SECRET_PREFIX,
    bytesToBase64Url(iv),
    bytesToBase64Url(new Uint8Array(ciphertext)),
  ].join(':');
};

export const decryptSecret = async (
  value: string,
  keyMaterial: string | undefined,
  associatedData: string,
): Promise<string> => {
  if (value.length === 0 || !isEncryptedSecret(value)) {
    return value;
  }

  const [, version, ivValue, ciphertextValue] = value.split(':');
  if (version !== 'v1' || !ivValue || !ciphertextValue) {
    throw new TokenCryptoError('Encrypted token payload is malformed');
  }

  const key = await importAesKey(keyMaterial);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64UrlToBytes(ivValue),
      additionalData: aadBytes(associatedData),
    },
    key,
    base64UrlToBytes(ciphertextValue),
  );

  return new TextDecoder().decode(plaintext);
};
