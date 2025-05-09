# Coinalyze Data Tools

Herramientas para la integración con Coinalyze, permitiendo la descarga e importación de datos de Open Interest, Volumen y Liquidaciones a una base de datos local.

## Características

- Descarga de datos de Open Interest, Volumen y Liquidaciones
- Procesamiento y transformación de datos
- Importación a base de datos MySQL
- Caché local de datos en formato JSON
- Soporte para múltiples intervalos de tiempo
- Sincronización automática de datos
- Manejo de rangos de fechas personalizados

## Instalación

```bash
pnpm install @tdf/coinalyze
```

## Uso

### Descarga de Datos

```bash
pnpm tdf-download-clz \
  --resource oi vl lq \
  --interval 1day \
  --asset BTC \
  --from 2023-01-01 \
  --to 2023-12-31
```

#### Opciones del Descargador

| Opción | Descripción | Valores por defecto |
|--------|-------------|-------------------|
| `-r, --resource` | Recursos a descargar (oi, vl, lq) | `[oi, vl, lq]` |
| `-i, --interval` | Intervalo de tiempo | Todos los intervalos activos |
| `-a, --asset` | Símbolo del activo | Requerido |
| `-f, --from` | Fecha inicial (YYYY-MM-DD) | Último punto sincronizado |
| `-t, --to` | Fecha final (YYYY-MM-DD) | Ahora |

### Importación de Datos

```bash
# Importar datos con sincronización (solo para intervalo base)
pnpm tdf-import-clz -r oi vl lq -a BTC -i 5m --sync

# Importar datos sin sincronización
pnpm tdf-import-clz -r oi vl lq -a BTC -i 5m
```

#### Opciones del Importador

| Opción | Descripción | Valores por defecto |
|--------|-------------|-------------------|
| `-r, --resource` | Recursos a importar (oi, vl, lq) | `[oi, vl, lq]` |
| `-a, --asset` | Símbolo del activo | Requerido |
| `-i, --interval` | Intervalo específico | Todos los intervalos |
| `--sync` | Sincronizar intervalos (solo para intervalo base) | `false` |

> **Nota**: El parámetro `--sync` solo debe usarse cuando se importa el intervalo base (5m). Este proceso:
> 1. Importa los datos del intervalo base (5m)
> 2. Genera automáticamente los datos para todos los intervalos activos diferentes al base
> 3. Los intervalos generados se calculan a partir de los datos del intervalo base
> 4. Este proceso asegura la consistencia de los datos entre diferentes intervalos

## Estructura del Proyecto

```
coinalyze/
├── bin/
│   ├── downloader.js    # Script de descarga
│   └── importer.js      # Script de importación
├── src/
│   ├── client.js        # Cliente API Coinalyze
│   ├── processors.js    # Procesadores de datos
│   ├── dataLoader.js    # Cargador de datos
│   ├── helpers.js       # Utilidades
│   └── jsonCache.js     # Gestión de caché
└── package.json

# Directorio de almacenamiento (creado en el directorio de instalación)
storage/
├── oi/          # Open Interest
│   └── btc/     # Datos por activo
│       └── 1day/ # Datos por intervalo
├── vl/          # Volumen
│   └── btc/
│       └── 1day/
└── lq/          # Liquidaciones
    └── btc/
        └── 1day/
```

## Configuración

### Variables de Entorno

Crea un archivo `.env` en el directorio donde instalaste el proyecto con las siguientes variables:

```env
# API Key de Coinalyze
COINALYZE_API_KEY=tu_api_key

# Configuración de la base de datos
DB_HOST=localhost
DB_USER=usuario
DB_PASSWORD=contraseña
DB_NAME=base_datos
```

Ejemplo de estructura de directorios:
```
tu-proyecto/
├── .env                # Archivo de configuración
├── storage/           # Directorio de almacenamiento
│   ├── oi/
│   ├── vl/
│   └── lq/
└── node_modules/
    └── @tdf/
        └── coinalyze/
```

## Dependencias

- `@tdf/repositories`: Acceso a la base de datos
- `dotenv`: Gestión de variables de entorno
- `yargs`: Parsing de argumentos CLI


## Notas de Desarrollo

- Los datos se almacenan en el directorio `storage/` en el directorio donde se ejecuta el comando
- La estructura de almacenamiento se organiza por recurso/activo/intervalo
- Se utiliza caché JSON para optimizar las descargas
- Los procesadores transforman los datos al formato requerido por la base de datos
- El cliente maneja la autenticación y las peticiones a la API
- Los archivos JSON se eliminan automáticamente después de ser importados
- Soporte para sincronización incremental de datos
