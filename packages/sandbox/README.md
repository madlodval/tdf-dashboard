# Trading Different Sandbox

Este paquete sirve como ejemplo y entorno de pruebas para demostrar el uso de los diferentes paquetes del proyecto Trading Different. No es un paquete funcional en sí mismo, sino una colección de scripts y ejemplos que muestran cómo integrar y utilizar los demás paquetes.

## Estructura

```
sandbox/
├── scripts/
│   ├── tdf-download.sh    # Descarga datos de Coinalyze
│   ├── tdf-import.sh      # Importa datos a la base de datos
│   ├── tdf-sync-interval-base.sh  # Sincroniza intervalos base
│   └── tdf-sync-intervals.sh      # Sincroniza todos los intervalos
├── storage/               # Directorio para almacenamiento temporal
└── package.json          # Dependencias de ejemplo
```

## Sistema de Intervalos

El sistema utiliza un intervalo base de 5 minutos (`5m`) como fuente de datos para todos los demás intervalos. Los intervalos disponibles son:

- `1m` (60 segundos) - Deshabilitado por defecto
- `5m` (300 segundos) - Intervalo base
- `15m` (900 segundos)
- `30m` (1800 segundos)
- `1h` (3600 segundos) - Habilitado por defecto
- `2h` (7200 segundos)
- `4h` (14400 segundos) - Habilitado por defecto
- `6h` (21600 segundos)
- `12h` (43200 segundos)
- `1d` (86400 segundos) - Habilitado por defecto

### Estructura de Datos

Los datos se almacenan en tres tipos de tablas:

1. **Tablas Base** (`base_*`):
   - Almacenan datos del intervalo base (5m)
   - Contienen datos crudos de cada exchange
   - Estructura: `exchange_id`, `asset_id`, `timestamp`, valores OHLCV

2. **Tablas de Intervalos** (`*`):
   - Almacenan datos agregados para cada intervalo
   - Se generan automáticamente desde las tablas base
   - Estructura: `exchange_id`, `asset_id`, `interval_id`, `timestamp`, valores OHLCV

3. **Tablas de Sincronización** (`sync_*`):
   - Controlan el estado de sincronización
   - Mantienen el último timestamp procesado
   - Estructura: `asset_id`, `interval_id`, `timestamp`

### Vistas Agregadas

El sistema utiliza vistas para generar automáticamente los datos de intervalos más grandes:

1. **Vistas de Intervalos** (`aggregated_interval_*`):
   - Agregan datos del intervalo base a intervalos más grandes
   - Calculan OHLCV correctamente para cada intervalo
   - Solo procesan intervalos habilitados
   - Verifican la integridad de los datos (COUNT = seconds/300)

2. **Vistas Agregadas** (`aggregated_*`):
   - Combinan datos de todos los exchanges
   - Proporcionan una vista unificada de los datos

## Recursos Disponibles

El sistema maneja tres tipos de datos:
1. `oi` (Open Interest): Interés abierto en los mercados
2. `vl` (Volume): Volumen de trading
3. `lq` (Liquidations): Liquidaciones de posiciones

## Scripts Disponibles

### tdf-download.sh
Script para descargar datos de Coinalyze. Este script:
1. Descarga datos históricos de Coinalyze
2. Almacena los datos en archivos JSON en el directorio `storage/`
3. Organiza los datos por recurso, activo e intervalo
4. Maneja la paginación y el rango de fechas automáticamente

```bash
./tdf-download.sh <asset> [interval] [resource]
```
Parámetros:
- `asset`: Símbolo del activo (ej: BTC) - **Requerido**
- `interval`: Intervalo temporal (opcional, ej: 5m, 1h, 1d)
- `resource`: Recurso específico a descargar (opcional, oi/vl/lq)

Opciones adicionales:
- `--from`: Fecha de inicio (YYYY-MM-DD o timestamp)
- `--to`: Fecha de fin (YYYY-MM-DD o timestamp)

Si no se especifica el intervalo, se descargarán todos los intervalos habilitados.
Si no se especifica el recurso, se descargarán todos los recursos (oi, vl, lq).

### tdf-import.sh
Script para importar datos a la base de datos. Este script:
1. Lee los archivos JSON del directorio `storage/`
2. Procesa los datos según el tipo de recurso
3. Importa los datos a las tablas correspondientes
4. Actualiza las tablas de sincronización
5. Elimina los archivos JSON procesados

```bash
./tdf-import.sh <asset> [interval] [resource]
```
Parámetros:
- `asset`: Símbolo del activo - **Requerido**
- `interval`: Intervalo temporal (opcional)
- `resource`: Recurso específico a importar (opcional, oi/vl/lq)

Opciones adicionales:
- `--sync`: Activa la sincronización de intervalos durante la importación

Si no se especifica el intervalo, se importarán todos los intervalos disponibles en el directorio `storage/`.
Si no se especifica el recurso, se importarán todos los recursos disponibles.

### tdf-sync-interval-base.sh
Script para descargar, importar y sincronizar el intervalo base (5m) de un activo. Este script:
1. Descarga los datos del intervalo base desde Coinalyze
2. Importa los datos a las tablas base
3. Actualiza las tablas de sincronización
4. Genera automáticamente los datos para todos los intervalos habilitados

```bash
./tdf-sync-interval-base.sh <asset>
```
- `asset`: Símbolo del activo a sincronizar - **Requerido**

### tdf-sync-intervals.sh
Script para sincronizar todos los intervalos habilitados a partir de los datos base existentes. Este script:
1. Utiliza los datos ya existentes en las tablas base
2. Regenera los datos para todos los intervalos habilitados
3. Actualiza las tablas de sincronización
4. Útil para regenerar datos históricos o corregir inconsistencias

```bash
./tdf-sync-intervals.sh
```

## Dependencias

El paquete utiliza las siguientes dependencias del workspace:
- `@tdf/coinalyze`: Para descarga y procesamiento de datos
- `@tdf/repositories`: Para acceso a la base de datos
- `@tdf/market-stats-api`: Para exponer los datos vía API

## Uso

### 1. Inicialización del Sistema

Para comenzar a usar el sistema con un nuevo activo, primero necesitas descargar e importar los datos históricos:

1. **Descarga de Datos Históricos**
   ```bash
   # Descargar todos los datos históricos de BTC
   ./tdf-download.sh BTC

   # O descargar intervalos específicos
   ./tdf-download.sh BTC 1h
   ./tdf-download.sh BTC 4h
   ./tdf-download.sh BTC 1d
   ```

2. **Importación de Datos Históricos**
   ```bash
   # Importar todos los datos descargados
   ./tdf-import.sh BTC

   # O importar intervalos específicos
   ./tdf-import.sh BTC 1h
   ./tdf-import.sh BTC 4h
   ./tdf-import.sh BTC 1d
   ```

3. **Verificación de Datos**
   ```bash
   # Verificar que los datos se hayan importado correctamente
   ./tdf-sync-intervals.sh
   ```

### 2. Mantenimiento del Sistema

Una vez que tienes la base de datos inicial, el mantenimiento se realiza mediante la actualización periódica de los datos base:

```bash
# Configuración del cron job para mantener actualizados los datos base
*/5 * * * * cd /ruta/a/sandbox && ./tdf-sync-interval-base.sh BTC
```

Este script se encargará de:
1. Descargar los nuevos datos del intervalo base
2. Importarlos a las tablas base
3. Actualizar automáticamente todos los intervalos habilitados

### 3. Casos de Uso Específicos

1. **Actualización de Datos Base**
   ```bash
   # Para descargar e importar nuevos datos del intervalo base
   ./tdf-sync-interval-base.sh BTC
   ```

2. **Regeneración de Intervalos**
   ```bash
   # Para regenerar todos los intervalos a partir de los datos base existentes
   # Útil solo en casos de inconsistencia o regeneración de datos históricos
   ./tdf-sync-intervals.sh
   ```

## Notas de Desarrollo

- Este paquete es solo para demostración y pruebas
- Los scripts asumen que están siendo ejecutados desde el directorio del paquete
- Todos los scripts manejan el cambio de directorio automáticamente
- Se recomienda revisar los scripts antes de ejecutarlos para entender su funcionamiento
- El intervalo base (5m) es fundamental para el funcionamiento del sistema
- Los datos de intervalos más grandes se generan automáticamente a partir del intervalo base
- Las vistas agregadas (`aggregated_*`) son las responsables de generar los datos para los intervalos más grandes
- Los archivos JSON se almacenan temporalmente en `storage/` y se eliminan después de ser procesados
- El sistema maneja automáticamente la paginación y el rango de fechas en las descargas
- Las tablas de sincronización (`sync_*`) mantienen el estado de la última actualización para cada activo e intervalo
- Las vistas agregadas verifican la integridad de los datos asegurando que haya suficientes puntos de datos base
- El sistema está diseñado para mantener la consistencia de los datos a través de todos los intervalos
- La sincronización del intervalo base es suficiente para mantener actualizados todos los intervalos
- El script `tdf-sync-interval-base.sh` descarga e importa nuevos datos del intervalo base
- El script `tdf-sync-intervals.sh` es útil solo para regenerar datos históricos o corregir inconsistencias
- Para un nuevo activo, primero se debe realizar la descarga e importación de datos históricos
- Una vez inicializado, solo se necesita mantener el script `tdf-sync-interval-base.sh` en el cron job
- El sistema está optimizado para mantener datos actualizados con el mínimo de recursos necesarios
