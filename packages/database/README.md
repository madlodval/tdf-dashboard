# Database

Paquete de manejo de bases de datos para el proyecto TradingDifferent. Proporciona una capa de abstracción para la conexión y operaciones con bases de datos, soportando MySQL y PostgreSQL.

## Características

- Soporte para múltiples bases de datos:
  - MySQL
  - PostgreSQL
- Conexión y desconexión automática
- Manejo de transacciones
- Operaciones CRUD básicas
- Manejo de errores personalizado
- Configuración mediante variables de entorno
- Factory pattern para creación de conexiones

## Instalación

```bash
pnpm install @tdf/database
```

## Uso

### Conexión Básica

```javascript
import { connection } from '@tdf/database'

const db = connection()
await db.connect()

// Realizar consultas
const result = await db.query('SELECT * FROM table WHERE id = ?', [1])

// Cerrar conexión
await db.disconnect()
```

### Transacciones

```javascript
const db = connection()
await db.connect()

try {
  await db.transaction(async () => {
    await db.query('INSERT INTO table1 VALUES (?)', [value1])
    await db.query('INSERT INTO table2 VALUES (?)', [value2])
  })
} catch (error) {
  console.error('Error en la transacción:', error)
}
```

### Reemplazo de Datos

```javascript
const db = connection()
await db.connect()

const data = {
  id: 1,
  name: 'example',
  value: 100
}

// Reemplazar o insertar datos
await db.replaceInto('table', data, ['id'])
```

### Llamadas a Procedimientos

```javascript
const db = connection()
await db.connect()

// Llamar a un procedimiento almacenado
const result = await db.call('procedure_name', arg1, arg2)
```

## Estructura del Proyecto

```
database/
├── src/
│   ├── base.js          # Clase base y errores
│   ├── config.js        # Configuración
│   ├── factory.js       # Factory de conexiones
│   ├── index.js         # Punto de entrada
│   ├── mysql.js         # Implementación MySQL
│   ├── postgresql.js    # Implementación PostgreSQL
│   └── repository.js    # Patrón Repository
└── package.json
```

## Configuración

### Variables de Entorno

```env
# Configuración de la base de datos
DB_HOST=localhost
DB_USER=usuario
DB_PASSWORD=contraseña
DB_NAME=base_datos
DB_PORT=3306
```

## Dependencias

- `mysql2`: Cliente MySQL para Node.js
- `dotenv`: Gestión de variables de entorno

## Scripts Disponibles

```bash
pnpm run lint    # Linting del código
pnpm run format  # Formateo del código
pnpm run build   # Build del proyecto
```

## Notas de Desarrollo

- Implementa el patrón Factory para crear conexiones
- Maneja automáticamente la reconexión cuando es necesario
- Proporciona una interfaz unificada para diferentes bases de datos
- Incluye manejo de errores personalizado
- Soporta transacciones y operaciones atómicas
- Implementa el patrón Repository para acceso a datos

## Contribución

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request 