const EN = 'en';

function createMap(routes: Record<string, any>) {
  const entries: Record<string, any> = {};
  for (const [entryPoint, entry] of Object.entries(routes)) {
    if (!Object.hasOwn(entry, EN)) {
      entry[EN] = entryPoint;
    }
    for (let [lang, pathsRaw] of Object.entries(entry)) {
      if (pathsRaw === null) {
        continue;
      }
      let exists = false;
      let paths: any[];
      if (!Array.isArray(pathsRaw)) {
        paths = [pathsRaw];
        if (lang === EN && paths.includes(entryPoint)) {
          exists = true;
        }
      } else {
        paths = pathsRaw as any[];
        if (lang === EN && !paths.includes(entryPoint)) {
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

export const map = createMap({
  "dashboard/future-market-stats": {
    en: "dashboard/future-market-stats",
    es: "dashboard/es/future-market-stats",
    de: "dashboard/de/future-market-stats",
    kr: "dashboard/kr/future-market-stats"
  },
});

export function find(path: string) {
  return map[path];
} 