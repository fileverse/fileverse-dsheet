export const getHash = () =>
  typeof window !== 'undefined'
    ? decodeURIComponent(window.location.hash.replace('#', ''))
    : undefined;

export const getKeyFromURLParams = (searchParams: URLSearchParams) => {
  const urlHash = getHash();
  if (!urlHash) return searchParams.get('key');
  const params = new URLSearchParams(urlHash);
  return params.get('key');
};

export function getCollabIdFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('collaborationId');
}

export function setURLParams(params: Record<string, string | null>): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === null) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }
  window.history.replaceState({}, '', url.toString());
}
