import { defaultLocale, locales, routing } from './i18n';

const SUPPORTED_LANGS = locales;

function createMap(...entryPoints: string[]) {
  const entries: Record<string, any> = {};
  const routes: Record<string, any> = {};

  // Inicializar rutas para cada entry point
  entryPoints.forEach(entryPoint => {
    routes[entryPoint] = {};
  });

  // Generar rutas para cada idioma y entry point
  entryPoints.forEach(entryPoint => {
    SUPPORTED_LANGS.forEach(lang => {
      if (!routing.prefixDefaultLocale && lang === defaultLocale) {
        routes[entryPoint][lang] = `dashboard/${entryPoint}`;
      } else {
        routes[entryPoint][lang] = `${lang}/dashboard/${entryPoint}`;
      }
    });
  });
  // Procesar las rutas generadas
  for (const [entryPoint, entry] of Object.entries(routes)) {
    if (!Object.hasOwn(entry, defaultLocale)) {
      entry[defaultLocale] = entryPoint;
    }
    for (let [lang, pathsRaw] of Object.entries(entry)) {
      if (pathsRaw === null) {
        continue;
      }
      let exists = false;
      let paths: any[];
      if (!Array.isArray(pathsRaw)) {
        paths = [pathsRaw];
        if (lang === defaultLocale && paths.includes(entryPoint)) {
          exists = true;
        }
      } else {
        paths = pathsRaw as any[];
        if (lang === defaultLocale && !paths.includes(entryPoint)) {
          paths.push(entryPoint);
          exists = true;
        }
      }
      for (let path of paths) {
        let content = { collection: entryPoint, pages: [lang] };
        if (typeof path !== 'string') {
          const { path: p, content: c } = path;
          path = p;
          content.pages.push(c ? c : p);
        }
        entries[path] = {
          lang,
          exists,
          entryPoint,
          content,
        };
      }
    }
  }
  return entries;
}

export const map = createMap('future-market-stats');

export function find(path: string) {
  return map[path];
} 