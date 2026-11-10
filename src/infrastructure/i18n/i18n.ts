import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import type { BackendModule, ResourceKey } from "i18next";

/**
 * Locale bundles are separate chunks, fetched on demand: i18next asks the
 * backend for the active language and for the fallback (`pt-BR`), and again on
 * `changeLanguage`. Neither JSON ships inside the entry chunk.
 */
const LOCALE_LOADERS: Record<string, () => Promise<{ default: ResourceKey }>> = {
  en: () => import("./locales/en.json"),
  "pt-BR": () => import("./locales/pt-BR.json"),
};

const lazyLocaleBackend: BackendModule = {
  type: "backend",
  init() {},
  read(language, _namespace, callback) {
    const load = LOCALE_LOADERS[language];
    if (!load) {
      callback(null, {});
      return;
    }
    load().then(
      (module) => callback(null, module.default),
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), null),
    );
  },
};

export const I18N_STORAGE_KEY = "structura_language";

function convertDetectedLanguage(lng: string): string {
  const lower = lng.toLowerCase();
  if (lower.startsWith("pt")) return "pt-BR";
  if (lower.startsWith("en")) return "en";
  return "pt-BR";
}

/**
 * Top-level await: modules that import i18n evaluate only once the active and
 * fallback bundles are in, so `i18n.t()` at module scope still resolves.
 */
await i18n
  .use(lazyLocaleBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "pt-BR",
    supportedLngs: ["en", "pt-BR"],
    load: "currentOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: I18N_STORAGE_KEY,
      convertDetectedLanguage,
    },
    react: { useSuspense: false },
  });

// Cross-locale catalog search reads every shipped locale. Fetch the remaining
// bundle after boot, off the critical path, so the first paint ships one language.
const rest = Object.keys(LOCALE_LOADERS).filter(
  (lng) => !i18n.hasResourceBundle(lng, "translation"),
);
if (rest.length > 0 && typeof window !== "undefined") {
  const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
  idle(() => void i18n.loadLanguages(rest));
}

export default i18n;
