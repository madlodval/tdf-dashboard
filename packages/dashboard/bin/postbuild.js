import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// crypto y YAML no son necesarios para solo procesar HTML, los elimino
// import crypto from 'node:crypto';
// import YAML from 'js-yaml';
import validator from 'html-validator'; // Mantengo el validador si lo quieres usar
import { minify } from 'html-minifier-terser';
// slugify, render, routes, etc. son específicos de Vue SSR, los elimino
// import slugify from './src/plugins/slugify.js';
// import { render, routes } from './dist/server/entry-server.js';

// Helper para resolver rutas relativas al directorio del script
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolve = (filename) => path.resolve(__dirname, filename);

// Directorio de salida de Astro
const distDir = resolve('../dist');

// Función principal asíncrona
;(async () => {
  console.log('Iniciando procesamiento de archivos HTML en dist...');

  // 1. Encontrar todos los archivos HTML en el directorio dist
  const htmlFiles = await findHtmlFiles(distDir);

  for (const filePath of htmlFiles) {
    console.log(`Procesando: ${filePath}`);
    try {
      // 2. Leer el contenido del archivo
      let html = fs.readFileSync(filePath, { encoding: 'utf-8' });

      // 3. Validar el HTML (Opcional - descomenta si quieres validar)
      // await validate(html);
      // console.log(`Validación exitosa para: ${filePath}`);

      // 4. Minificar el HTML
      html = await minifyHTML(html);
      console.log(`Minificación exitosa para: ${filePath}`);

      // 5. Sobrescribir el archivo original con el HTML minificado
      fs.writeFileSync(filePath, html);
      console.log(`Archivo guardado: ${filePath}`);

    } catch (error) {
      console.error(`Error procesando ${filePath}:`, error);
      // Decide si quieres detener el proceso o continuar con el siguiente archivo
      // throw error; // Descomenta para detener si hay un error
    }
  }

  // 6. Limpiar archivos específicos (Opcional - basado en tu script original)
  // Puedes ajustar o eliminar esta función según lo necesites
  clean();
  // console.log('Archivos específicos limpiados.');

  console.log('Procesamiento de archivos HTML completado.');

})().catch(err => {
  console.error('Error fatal durante el procesamiento:', err);
  process.exit(1); // Salir con código de error
});


// --- Funciones Helper ---

// Función para encontrar recursivamente archivos .html
async function findHtmlFiles(dir) {
  let files = [];
  const items = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const item of items) {
    const res = path.resolve(dir, item.name);
    if (item.isDirectory()) {
      // Si es un directorio, buscar recursivamente
      files = files.concat(await findHtmlFiles(res));
    } else if (item.isFile() && item.name.endsWith('.html')) {
      // Si es un archivo .html, añadirlo a la lista
      files.push(res);
    }
  }
  return files;
}


// Función para minificar HTML usando html-minifier-terser
async function minifyHTML(html) {
  return minify(html, {
    removeAttributeQuotes: true,
    collapseWhitespace: true, // Esta opción es clave para eliminar espacios
    collapseBooleanAttributes: true,
    removeComments: true, // Generalmente quieres eliminar comentarios en producción
    removeRedundantAttributes: true,
    html5: true,
    minifyURLs: true,
    removeEmptyAttributes: true,
    minifyJS: true, // Minifica JS inline dentro de <script>
    minifyCSS: true // Minifica CSS inline dentro de <style>
  });
}

// Función para validar HTML (basado en tu script original)
async function validate(html) {
  // Asegúrate de que la opción 'data' recibe el string HTML
  const options = {
    validator: 'WHATWG', // O 'nu'
    data: html,
    // Otras opciones si son necesarias, como headers, etc.
  };

  try {
    const result = await validator(options);
    if (!result.isValid) {
      console.error('HTML inválido:');
      console.error(result.messages); // Muestra los mensajes de error/advertencia
      throw new Error('Validación HTML fallida');
    }
  } catch (error) {
    console.error('Error durante la validación:', error);
    // Dependiendo de la librería, el error puede ser diferente
    if (error.messages) {
         console.error(error.messages);
    }
    throw new Error(`Error de validación: ${error.message || error}`);
  }
}

// Función para limpiar archivos específicos (basado en tu script original)
// Ajusta esta función según los archivos que realmente quieras eliminar después de la build de Astro
function clean() {
  const filesToClean = [
    '../dist/index.html',
  ];

  for (const file of filesToClean) {
    const filePath = resolve(file);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Eliminado: ${file}`);
      } catch (e) {
        console.error(`Error al eliminar ${file}:`, e);
      }
    }
  }
}
