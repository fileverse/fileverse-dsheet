import { Context } from "..";

const localeCache: Record<string, any> = {};

const loaders: Record<string, () => Promise<{ default: any }>> = {
  en: () => import("./en"),
  zh: () => import("./zh"),
  es: () => import("./es"),
  hi: () => import("./hi"),
  "zh-TW": () => import("./zh_tw"),
};

/**
 * Pre-load a locale's data into the cache.
 * Must be called (and awaited) before the first render
 * so that synchronous locale() calls return data.
 */
export async function loadLocale(lang: string): Promise<void> {
  // Try exact match first, then base language, then fallback to English
  const key = lang in loaders ? lang : lang.split("-")[0];
  const resolvedKey = key in loaders ? key : "en";
  if (localeCache[resolvedKey]) return;
  const mod = await loaders[resolvedKey]();
  localeCache[resolvedKey] = mod.default;
}

function locale(ctx: Context) {
  const langsToTry = [ctx?.lang || "", ctx?.lang?.split("-")[0] || ""];
  for (const lang of langsToTry) {
    if (localeCache[lang]) return localeCache[lang];
  }
  return localeCache.en;
}

export { locale };
