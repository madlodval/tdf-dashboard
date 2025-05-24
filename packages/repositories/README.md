# Repositories

Paquete de repositorios para el proyecto TradingDifferent. Proporciona una capa de abstracción para el acceso a la base de datos, soportando MySQL y PostgreSQL.

## Características

- Repositorios para diferentes tipos de datos:
  - Open Interest
  - Volumen
  - Liquidaciones
  - Activos
  - Exchanges
  - Intervalos
- Sincronización automática de intervalos
- Soporte para múltiples bases de datos
- Transacciones y manejo de errores
- Sincronización de tablas maestras

## Instalación

```bash
pnpm install @tdf/repositories
```

## Uso

### Conexión a la Base de Datos

```javascript
import { connection } from '@tdf/repositories'

const db = connection()
await db.connect()
// ... usar la conexión
await db.disconnect()
```

### Repositorios Disponibles

```javascript
import {
  OpenInterestRepository,
  VolumeRepository,
  LiquidationRepository,
  AssetRepository,
  ExchangeRepository,
  IntervalRepository
} from '@tdf/repositories'

// Ejemplo de uso
const oiRepo = new OpenInterestRepository(db)
const data = await oiRepo.findByAssetAndInterval('BTC', '5m')
```

### Sincronización de Tablas Maestras

```bash
# Sincronizar todas las tablas maestras
pnpm tdf-sync-repo

# O usando el binario directamente
tdf-sync-repo
```

## Estructura del Proyecto

```
repositories/
├── bin/
│   └── sync.js          # Script de sincronización
├── src/
│   ├── asset.js         # Repositorio de activos
│   ├── base_sync.js     # Clase base para sincronización
│   ├── exchange.js      # Repositorio de exchanges
│   ├── index.js         # Punto de entrada
│   ├── interval.js      # Repositorio de intervalos
│   ├── liquidation.js   # Repositorio de liquidaciones
│   ├── open_interest.js # Repositorio de open interest
│   └── volume.js        # Repositorio de volumen
├── mysql.sql           # Esquema para MySQL
└── psql.sql           # Esquema para PostgreSQL
```

## Configuración

### Variables de Entorno

```env
# Configuración de la base de datos
DB_HOST=localhost
DB_USER=usuario
DB_PASSWORD=contraseña
DB_NAME=base_datos
```

## Dependencias

- `@tdf/database`: Conexión y manejo de base de datos


## Notas de Desarrollo

- Los repositorios implementan un patrón de diseño Repository para abstraer el acceso a datos
- La sincronización de intervalos se realiza desde el intervalo base (5m)
- Se utilizan transacciones para garantizar la integridad de los datos
- Los repositorios manejan automáticamente la conexión a la base de datos
- Se soporta tanto MySQL como PostgreSQL

## OHCL
Asi se sincronizan los intervalos del interes abierto y el volumen
```sql
SELECT
    t.exchange_id,
    t.asset_id,
    t.interval_id,
    FLOOR(t.timestamp / 900) * 900 AS interval_timestamp,
    SUBSTRING_INDEX(GROUP_CONCAT(t.open_value ORDER BY t.timestamp ASC), ',', 1) AS open_value,
    MAX(t.high_value) AS high_value,
    MIN(t.low_value) AS low_value,
    SUBSTRING_INDEX(GROUP_CONCAT(t.close_value ORDER BY t.timestamp DESC), ',', 1) AS close_value,
    SUM(t.volume_value) AS volume_value
FROM volume t
WHERE t.interval_id = 2 -- <- es el intervalo base
GROUP BY 
    t.exchange_id, 
    t.asset_id, 
    interval_timestamp
HAVING COUNT(*) = 900/300 -- <- es la cantidad de elementos del intervalo base, de  ser exacto
ORDER BY interval_timestamp;
```

Asi se sincronizan los intervalos de las liquidaciones
```sql
SELECT
    t.exchange_id,
    t.asset_id,
    t.interval_id,
    FLOOR(t.timestamp / 900) * 900 AS interval_timestamp,
    SUM(t.longs) AS longs,
    SUM(t.shorts) AS shorts
FROM liquidations t
WHERE
    t.interval_id = 2 -- <- es el intervalo base
GROUP BY 
    t.exchange_id, 
    t.asset_id, 
    t.interval_id, 
    interval_timestamp
HAVING COUNT(*) <= 900/300 -- <- es la cantidad de elementos del intervalo base, no es necesario que sea exacto
ORDER BY interval_timestamp;
```
