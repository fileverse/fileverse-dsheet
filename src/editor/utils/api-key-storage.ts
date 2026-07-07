import { getApiKey, saveApiKey, removeApiKey } from './api-keys-local-storage';

export interface ApiKeyStorage {
  get: (name: string) => string | null;
  set: (name: string, key: string) => void;
  remove?: (name: string) => void;
}

export const defaultApiKeyStorage: ApiKeyStorage = {
  get: (name) => {
    const value = getApiKey(name);
    return value || null;
  },
  set: (name, key) => {
    saveApiKey(name, key);
  },
  remove: (name) => {
    removeApiKey(name);
  },
};
