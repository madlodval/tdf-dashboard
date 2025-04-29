# Coinalyze Data Tools

Este proyecto permite descargar e importar datos de Open Interest y Liquidaciones desde la API de Coinalyze a una base de datos local.

---

## Descarga de Open Interest

Script para descargar datos de open interest y guardarlos como JSON para su posterior procesamiento.

### Uso

```bash
node bin/downloader.js \
  --resource oi \
  --interval 1day \
  --symbol BTC
```

#### Opciones principales
- `--resource` (`oi`): Tipo de recurso a descargar. Usa `oi` para open interest o `lq` para liquidaciones.
- `--interval` (`1day`, `4hour`, etc.): Intervalo de tiempo.
- `--symbol`: Símbolo del activo (ej. `BTC`).
- `--exchange` (opcional): Filtra por exchange.
- `--currency` (opcional): Filtra por moneda.

Ver todas las opciones:
```bash
node bin/downloader.js --help
```

---

## Importador de Datos

Script para importar archivos JSON descargados a la base de datos.

### Uso

```bash
node bin/importer.js -r oi -s BTC -i 1day
node bin/importer.js -r lq -s BTC -i 1min
```

#### Opciones principales
- `-r`, `--resource`: Tipo de recurso (`oi` para open interest, `lq` para liquidaciones).
- `-s`, `--symbol`: Símbolo del activo.
- `-i`, `--interval`: Intervalo de tiempo del archivo JSON.

El script buscará el archivo correspondiente en `bin/storage/` y lo importará a la base de datos según el tipo de recurso.

### Ejemplo
```bash
node bin/importer.js -r oi -s BTC -i 1day
```

---

## Estructura de Archivos

- `bin/downloader.js`: Descarga datos desde la API de Coinalyzes.
- `bin/importer.js`: Importa datos JSON a la base de datos.
- `bin/storage/`: Carpeta donde se guardan los archivos descargados.

---

## Notas
- Asegúrate de tener configuradas las variables de entorno para la conexión a la base de datos.
- Consulta el código fuente para detalles sobre el esquema SQL y procesamiento de datos.
