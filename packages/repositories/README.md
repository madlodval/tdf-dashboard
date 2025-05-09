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
