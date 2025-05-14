export const defaultLocale = 'en';
export const locales = ['en', 'es', 'de', 'kr'];
export type Locale = typeof locales[number];
export const routing = {
  prefixDefaultLocale: false,
}

export const i18n = {
  defaultLocale,
  locales: [...locales],
  routing
}; 