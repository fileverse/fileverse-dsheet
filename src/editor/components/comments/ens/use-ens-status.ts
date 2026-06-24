import { useEffect, useState } from 'react';
import { EnsStatus, getCachedEns, resolveEns, subscribeEns } from './ens-cache';

/**
 * Resolve a comment username to a display name + ENS flag.
 * - Empty → "Anonymous".
 * - Cache hit → returned immediately.
 * - Miss → triggers a deduped resolve; re-renders when it lands.
 * - Plain names short-circuit inside getAddressName (no network).
 */
export const useEnsStatus = (username?: string): EnsStatus => {
  const fallback: EnsStatus = { name: username || 'Anonymous', isEns: false };

  const [status, setStatus] = useState<EnsStatus>(
    () => (username && getCachedEns(username)) || fallback,
  );

  useEffect(() => {
    if (!username) {
      setStatus({ name: 'Anonymous', isEns: false });
      return;
    }
    const apply = () =>
      setStatus(getCachedEns(username) || { name: username, isEns: false });
    apply();
    const unsub = subscribeEns(apply);
    void resolveEns(username);
    return () => {
      unsub();
    };
  }, [username]);

  return status;
};
