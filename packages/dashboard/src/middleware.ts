import * as Routes from './routes';
import { getEntry } from "astro:content";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async ({ locals, url }, next) => {
    const { pathname } = url;
    const path = pathname.substring(1).replace('.html', '');
    const route = Routes.find(path);

    if (route) {
        const { lang, content } = route;
        let res = await getEntry("layouts", lang);
        if (res && Object.hasOwn(res, 'data')) {
            let { header, main: base, footer } = res.data;
            let title, description, main = {};
    
            for (let page of content.pages) {
                let collection = content.collection;
                let pageId = page;
                console.log(collection, pageId);
                // Manejo específico para colecciones anidadas (e.g., dashboard/future-market-stats)
                if (collection.includes('/')) {
                    const [prefix, suffix] = collection.split("/");
                    collection = prefix; // Usamos solo 'dashboard'
                    pageId = `${suffix}/${lang}`;
                }
    
                try {
                    const entry = await getEntry(collection, pageId);
                    if (entry && entry.data) {
                        const { title: t, description: d, main: m } = entry.data;
                        title = t || title;
                        description = d || description;
                        // Merge preservando las propiedades existentes
                        if (m) {
                            main = { ...main, ...m };
                        }
                    }
                } catch (error) {
                    console.error(`Error loading translation for ${collection}/${pageId}:`, error);
                }
            }
    
            locals.lang = lang;
            locals.title = title;
            locals.description = description;
            locals.header = header;
            // Merge preservando las propiedades de base
            locals.main = { ...base, ...main };
            locals.footer = footer;
        }
    }
    return next();
}); 