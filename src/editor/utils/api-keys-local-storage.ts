export const INVALID_KEY_MARKER = '_invalid';
export const RATE_LIMITED_KEYS = 'RATE_LIMITED_KEYS';

// Inlined from @fileverse-dev/dsheet SERVICES_API_KEY to avoid pulling the
// entire crypto-constants chunk (~1100 lines incl. jwt-decode & formula
// metadata) into the shared client bundle via db/db.ts → this file.
export const DATABLOCK_API_KEYS = [
  'Basescan',
  'Coingecko',
  'Defillama',
  'Etherscan',
  'Firefly',
  'Safe',
  'Neynar',
  'Gnosisscan',
  'DuneSim',
];
export class ApiKeyStorageHelper {
  static getApiKey(keyName: string) {
    // Always check localStorage first
    const key = localStorage.getItem(keyName) || '';
    const cleanKey = key.endsWith(INVALID_KEY_MARKER)
      ? key.slice(0, -INVALID_KEY_MARKER.length)
      : key;

    // If user has a real key, return it (even in proxy mode)
    if (cleanKey) {
      return cleanKey;
    }

    // Only fall back to proxy mode if no real key exists
    const isProxyEnabled = process.env.NEXT_PUBLIC_PROXY_MODE === 'true';
    const isApiSupportedByProxy = DATABLOCK_API_KEYS.includes(keyName);

    if (isProxyEnabled && isApiSupportedByProxy) {
      return 'DEFAULT_PROXY_MODE';
    }

    // No key and no proxy support
    return '';
  }

  static clearApiKeys() {
    DATABLOCK_API_KEYS.forEach((keyName) => {
      localStorage.removeItem(keyName);
    });
  }
  static saveApiKey(keyName: string, key: string) {
    if (!key) return;
    localStorage.setItem(keyName, key);
  }
  static removeApiKey(keyName: string) {
    localStorage.removeItem(keyName);
  }
  static getAllSupportedApiKeys() {
    const result: Record<string, string> = {};

    DATABLOCK_API_KEYS.forEach((keyName) => {
      const value = getApiKey(keyName);
      if (value && value !== 'DEFAULT_PROXY_MODE') {
        result[keyName] = value;
      }
    });

    return result;
  }
  static getListOfRateLimitedKeys() {
    const list = localStorage.getItem(RATE_LIMITED_KEYS);
    return list ? JSON.parse(list) : [];
  }
  static markKeyAsRateLimited(key: string) {
    const list = this.getListOfRateLimitedKeys();
    const newList = [...list, key];
    localStorage.setItem(RATE_LIMITED_KEYS, JSON.stringify(newList));
  }
}
export const getApiKey = (keyName: string) => {
  return ApiKeyStorageHelper.getApiKey(keyName);
};
export const clearApiKeys = () => {
  ApiKeyStorageHelper.clearApiKeys();
};
export const saveApiKey = (keyName: string, key: string) => {
  ApiKeyStorageHelper.saveApiKey(keyName, key);
};
export const removeApiKey = (keyName: string) => {
  ApiKeyStorageHelper.removeApiKey(keyName);
};
export const getListOfRateLimitedKeys = () => {
  return ApiKeyStorageHelper.getListOfRateLimitedKeys();
};

export const getAllSupportedApiKeysInLs = () =>
  ApiKeyStorageHelper.getAllSupportedApiKeys();

export const markKeyAsRateLimited = (key: string) => {
  ApiKeyStorageHelper.markKeyAsRateLimited(key);
};
