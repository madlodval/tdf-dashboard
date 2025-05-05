-- Eliminar tablas existentes si existen para una ejecución limpia (útil en desarrollo)
DROP TABLE IF EXISTS base_volume;
DROP TABLE IF EXISTS base_liquidations;
DROP TABLE IF EXISTS volume;
DROP TABLE IF EXISTS liquidations;
DROP TABLE IF EXISTS open_interest;
DROP TABLE IF EXISTS exchanges;
DROP TABLE IF EXISTS sync_liquidations;
DROP TABLE IF EXISTS sync_volume;
DROP TABLE IF EXISTS intervals;
DROP TABLE IF EXISTS assets;

-- Eliminar vistas existentes si existen
DROP VIEW IF EXISTS aggregated_interval_volume;
DROP VIEW IF EXISTS aggregated_interval_liquidations;

DROP VIEW IF EXISTS aggregated_volume;
DROP VIEW IF EXISTS aggregated_liquidations;
DROP VIEW IF EXISTS aggregated_open_interest;

-- Creación de la tabla de exchanges
CREATE TABLE exchanges (
  id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(3) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL UNIQUE,
  UNIQUE INDEX idx_exchange_code (code)
);

-- Inserción de datos iniciales en la tabla de exchanges
INSERT INTO exchanges (code, name) VALUES
('0', 'BitMEX'), ('2', 'Deribit'), ('3', 'OKX'), ('4', 'Huobi'), ('6', 'Bybit'),
('7', 'Phemex'), ('8', 'dYdX'), ('P', 'Poloniex'), ('V', 'Vertex'), ('D', 'Bitforex'),
('K', 'Kraken'), ('U', 'Bithumb'), ('B', 'Bitstamp'), ('H', 'Hyperliquid'), ('L', 'BitFlyer'),
('M', 'BtcMarkets'), ('I', 'Bit2c'), ('E', 'MercadoBitcoin'), ('N', 'Independent Reserve'),
('G', 'Gemini'), ('Y', 'Gate.io'), ('C', 'Coinbase'), ('F', 'Bitfinex'), ('J', 'Luno'),
('W', 'WOO X'), ('A', 'Binance');

-- Creación de la tabla de intervalos
CREATE TABLE intervals (
    id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(16) NOT NULL UNIQUE,
    seconds INT UNSIGNED NOT NULL,
    UNIQUE INDEX idx_interval_name (name)
);

-- Inserción de datos iniciales en la tabla de intervalos
INSERT INTO intervals (name, seconds) VALUES
    ('5m', 300), ('15m', 900), ('30m', 1800), ('1h', 3600),
    ('2h', 7200), ('4h', 14400), ('6h', 21600), ('12h', 43200), ('1d', 86400);

-- Creación de la tabla de activos
CREATE TABLE assets (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    UNIQUE INDEX idx_asset_symbol (symbol)
);

-- Inserción de datos iniciales en la tabla de activos
INSERT INTO assets (symbol, name) VALUES
    ('BTC', 'Bitcoin'), ('ETH', 'Ethereum'), ('SOL', 'Solana'), ('XRP', 'XRP');

-- Creación de la tabla de open_interest
CREATE TABLE open_interest (
    exchange_id TINYINT UNSIGNED NOT NULL,
    asset_id SMALLINT UNSIGNED NOT NULL,
    timestamp BIGINT UNSIGNED NOT NULL,
    seconds INT UNSIGNED GENERATED ALWAYS AS (timestamp % 86400) STORED,
    open_value DECIMAL(20, 8) NOT NULL,
    high_value DECIMAL(20, 8) NOT NULL,
    low_value DECIMAL(20, 8) NOT NULL,
    close_value DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (exchange_id, asset_id, timestamp),
    INDEX idx_asset_timestamp (asset_id, timestamp, seconds),
    INDEX idx_asset_seconds (asset_id, seconds),
    CONSTRAINT fk_oi_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_oi_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
);

-- Nuevas tablas para datos crudos (ej. 5 minutos)
CREATE TABLE base_volume (
    exchange_id TINYINT UNSIGNED NOT NULL,
    asset_id SMALLINT UNSIGNED NOT NULL,
    timestamp BIGINT UNSIGNED NOT NULL,
    open_value DECIMAL(20, 8) NOT NULL,
    high_value DECIMAL(20, 8) NOT NULL,
    low_value DECIMAL(20, 8) NOT NULL,
    close_value DECIMAL(20, 8) NOT NULL,
    volume_value DECIMAL(20, 8),
    PRIMARY KEY (exchange_id, asset_id, timestamp),
    INDEX idx_vol_base_asset_timestamp (asset_id, timestamp),
    CONSTRAINT fk_vol_base_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_vol_base_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
);

CREATE TABLE base_liquidations (
    exchange_id TINYINT UNSIGNED NOT NULL,
    asset_id SMALLINT UNSIGNED NOT NULL,
    timestamp BIGINT UNSIGNED NOT NULL,
    longs DECIMAL(20, 8) NOT NULL,
    shorts DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (exchange_id, asset_id, timestamp),
    INDEX idx_liq_base_asset_timestamp (asset_id, timestamp),
    CONSTRAINT fk_liq_base_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_liq_base_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
);

-- Tabla para datos agregados de volumen por exchange, activo, intervalo y timestamp
CREATE TABLE volume (
    exchange_id TINYINT UNSIGNED NOT NULL,
    asset_id SMALLINT UNSIGNED NOT NULL,
    interval_id TINYINT UNSIGNED NOT NULL,
    timestamp BIGINT UNSIGNED NOT NULL,
    open_value DECIMAL(20, 8) NOT NULL,
    high_value DECIMAL(20, 8) NOT NULL,
    low_value DECIMAL(20, 8) NOT NULL,
    close_value DECIMAL(20, 8) NOT NULL,
    volume_value DECIMAL(20, 8),
    PRIMARY KEY (exchange_id, asset_id, interval_id, timestamp),
    INDEX idx_vol_asset_interval_timestamp (asset_id, interval_id, timestamp),
    CONSTRAINT fk_vol_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_vol_asset FOREIGN KEY (asset_id) REFERENCES assets(id),
    CONSTRAINT fk_vol_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
);

-- Tabla para datos agregados de liquidaciones por exchange, activo, intervalo y timestamp
CREATE TABLE liquidations (
    exchange_id TINYINT UNSIGNED NOT NULL,
    asset_id SMALLINT UNSIGNED NOT NULL,
    interval_id TINYINT UNSIGNED NOT NULL,
    timestamp BIGINT UNSIGNED NOT NULL,
    longs DECIMAL(20, 8) NOT NULL,
    shorts DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (exchange_id, asset_id, interval_id, timestamp),
    INDEX idx_liq_asset_interval_timestamp (asset_id, interval_id, timestamp),
    CONSTRAINT fk_liq_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_liq_asset FOREIGN KEY (asset_id) REFERENCES assets(id),
    CONSTRAINT fk_liq_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
);

-- Tabla para el seguimiento de la sincronización de liquidaciones por activo e intervalo
CREATE TABLE sync_liquidations (
  asset_id SMALLINT UNSIGNED NOT NULL,
  interval_id TINYINT UNSIGNED NOT NULL,
  timestamp BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (asset_id, interval_id),
  CONSTRAINT fk_sync_liq_interval FOREIGN KEY (interval_id) REFERENCES intervals(id),
  CONSTRAINT fk_sync_liq_asset FOREIGN KEY (asset_id) REFERENCES assets(id) -- Aseguramos la FK al asset
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para el seguimiento de la sincronización de volumen por activo e intervalo
CREATE TABLE sync_volume (
  asset_id SMALLINT UNSIGNED NOT NULL,
  interval_id TINYINT UNSIGNED NOT NULL,
  timestamp BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (asset_id, interval_id),
  CONSTRAINT fk_sync_vol_interval FOREIGN KEY (interval_id) REFERENCES intervals(id),
  CONSTRAINT fk_sync_vol_asset FOREIGN KEY (asset_id) REFERENCES assets(id) -- Aseguramos la FK al asset
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vistas agregadas (estas vistas pueden necesitar ajustes adicionales dependiendo de su uso exacto
-- y cómo se relaciona con la nueva estructura de sincronización, pero se mantienen como estaban
-- en el archivo proporcionado para empezar).

-- Vista agregada de volumen por intervalo
CREATE VIEW aggregated_interval_volume AS
SELECT
    bv.exchange_id,
    bv.asset_id,
    i.id AS interval_id,
    i.seconds AS interval_duration_seconds,
    FLOOR(bv.timestamp / i.seconds) * i.seconds AS interval_timestamp,
    SUBSTRING_INDEX(GROUP_CONCAT(bv.open_value ORDER BY bv.timestamp ASC), ',', 1) AS open_value,
    MAX(bv.high_value) AS high_value,
    MIN(bv.low_value) AS low_value,
    SUBSTRING_INDEX(GROUP_CONCAT(bv.close_value ORDER BY bv.timestamp DESC), ',', 1) AS close_value,
    SUM(bv.volume_value) AS volume_value
FROM base_volume bv
JOIN intervals i ON 1=1 -- Join with intervals to allow grouping by any interval duration
GROUP BY bv.exchange_id, bv.asset_id, i.id, interval_timestamp
HAVING COUNT(*) = (i.seconds / 300); -- Assuming base frequency is 300 seconds (5 minutes)

-- Vista agregada de liquidaciones por intervalo
CREATE VIEW aggregated_interval_liquidations AS
SELECT
    bl.exchange_id,
    bl.asset_id,
    i.id AS interval_id,
    i.seconds AS interval_duration_seconds,
    FLOOR(bl.timestamp / i.seconds) * i.seconds AS interval_timestamp,
    SUM(bl.longs) AS longs,
    SUM(bl.shorts) AS shorts
FROM base_liquidations bl
JOIN intervals i ON 1=1 -- Join with intervals to allow grouping by any interval duration
GROUP BY bl.exchange_id, bl.asset_id, i.id, interval_timestamp
HAVING COUNT(*) = (i.seconds / 300); -- Assuming base frequency is 300 seconds (5 minutes)

-- Vista agregada de liquidaciones (sumando por asset, interval, timestamp)
CREATE VIEW aggregated_liquidations AS
SELECT
      asset_id,
      interval_id,
      timestamp,
      SUM(longs) AS longs,
      SUM(shorts) AS shorts
    FROM liquidations
    GROUP BY asset_id, interval_id, timestamp
    ORDER BY timestamp ASC;

-- Vista agregada de open interest (sumando por asset, timestamp, seconds)
CREATE VIEW aggregated_open_interest AS
SELECT
      asset_id,
      timestamp,
      seconds,
      SUM(open_value) AS open,
      SUM(high_value) AS high,
      SUM(low_value) AS low,
      SUM(close_value) AS close
    FROM open_interest
    GROUP BY asset_id, timestamp, seconds
    ORDER BY timestamp ASC;

-- Vista agregada de volumen (promediando/sumando por asset, timestamp) - Nota: esta vista parece agregar diferentes intervalos juntos, lo cual puede no ser lo deseado. Revisa su propósito.
CREATE VIEW aggregated_volume AS
 SELECT
       asset_id,
       timestamp,
       AVG(open_value) AS open,
       AVG(high_value) AS high,
       AVG(low_value) AS low,
       AVG(close_value) AS close,
       SUM(volume_value) AS volume
     FROM volume
     GROUP BY asset_id, timestamp
     ORDER BY timestamp ASC;

-- Delimitador para procedimientos almacenados
DELIMITER //

-- Procedimiento para sincronizar datos de volumen por activo e intervalo
DROP PROCEDURE IF EXISTS sync_volume_intervals //

CREATE PROCEDURE sync_volume_intervals(
    IN p_asset_id SMALLINT UNSIGNED, -- Añadimos el parámetro para el ID del activo
    IN p_interval_id TINYINT UNSIGNED,
    IN p_interval_duration_seconds BIGINT,
    IN p_original_frequency_seconds BIGINT
)
BEGIN
    -- Variable para almacenar el último timestamp sincronizado registrado en sync_volume para este activo e intervalo
    DECLARE v_last_sync_timestamp BIGINT;
    -- Calcular el timestamp de inicio real para la sincronización
    DECLARE v_sync_start_timestamp BIGINT;

    -- Obtener el último timestamp sincronizado registrado para el activo e intervalo dados
    SELECT timestamp INTO v_last_sync_timestamp
    FROM sync_volume
    WHERE asset_id = p_asset_id AND interval_id = p_interval_id;

    -- Si no hay registro de sincronización para este activo e intervalo, comenzar desde 0
    IF v_last_sync_timestamp IS NULL THEN
        SET v_last_sync_timestamp = 0;
    END IF;

    -- Calcular el timestamp de inicio real (último timestamp sincronizado + 1)
    SET v_sync_start_timestamp = v_last_sync_timestamp + p_interval_duration_seconds;

    INSERT INTO volume (
        exchange_id,
        asset_id,
        interval_id,
        timestamp,
        open_value,
        high_value,
        low_value,
        close_value,
        volume_value
    )
    SELECT
        exchange_id,
        asset_id,
        p_interval_id AS interval_id,
        FLOOR(timestamp / p_interval_duration_seconds) * p_interval_duration_seconds AS interval_timestamp,
        SUBSTRING_INDEX(GROUP_CONCAT(open_value ORDER BY timestamp ASC), ',', 1) AS open_value,
        MAX(high_value) AS high_value,
        MIN(low_value) AS low_value,
        SUBSTRING_INDEX(GROUP_CONCAT(close_value ORDER BY timestamp DESC), ',', 1) AS close_value,
        SUM(volume_value) AS volume_value
    FROM base_volume
    -- Filtrar por el activo específico y usar el rango de timestamp calculado
    WHERE asset_id = p_asset_id AND timestamp >= v_sync_start_timestamp
    GROUP BY exchange_id, asset_id, interval_timestamp
    -- Asegurarse de tener suficientes puntos de datos base para la duración del intervalo
    HAVING COUNT(*) = (p_interval_duration_seconds / p_original_frequency_seconds)
    ON DUPLICATE KEY UPDATE
        open_value = VALUES(open_value),
        high_value = VALUES(high_value),
        low_value = VALUES(low_value),
        close_value = VALUES(close_value),
        volume_value = VALUES(volume_value);

    -- Actualizar el timestamp de la última sincronización para este intervalo
    -- al timestamp máximo que se acaba de procesar desde la tabla base.
    REPLACE INTO sync_volume (asset_id, interval_id, timestamp) SELECT p_asset_id, p_interval_id, IFNULL(MAX(timestamp), 0) FROM volume
    WHERE asset_id = p_asset_id AND interval_id = p_interval_id;

END //

-- Procedimiento para sincronizar datos de liquidaciones por activo e intervalo
DROP PROCEDURE IF EXISTS sync_liquidations_intervals //

CREATE PROCEDURE sync_liquidations_intervals(
    IN p_asset_id SMALLINT UNSIGNED, -- Añadimos el parámetro para el ID del activo
    IN p_interval_id TINYINT UNSIGNED,
    IN p_interval_duration_seconds BIGINT,
    IN p_original_frequency_seconds BIGINT
)
BEGIN
    -- Variable para almacenar el último timestamp sincronizado registrado en sync_liquidations para este activo e intervalo
    DECLARE v_last_sync_timestamp BIGINT;
    -- Calcular el timestamp de inicio real para la sincronización
    DECLARE v_sync_start_timestamp BIGINT;

    -- Obtener el último timestamp sincronizado registrado para el activo e intervalo dados
    SELECT timestamp INTO v_last_sync_timestamp
    FROM sync_liquidations
    WHERE asset_id = p_asset_id AND interval_id = p_interval_id;

    -- Si no hay registro de sincronización para este activo e intervalo, comenzar desde 0
    IF v_last_sync_timestamp IS NULL THEN
        SET v_last_sync_timestamp = 0;
    END IF;

    -- Calcular el timestamp de inicio real (último timestamp sincronizado + 1)
    SET v_sync_start_timestamp = v_last_sync_timestamp + p_interval_duration_seconds;

    -- Insertar/Actualizar datos de liquidaciones agregados para el activo e intervalo específicos
    INSERT INTO liquidations (
        exchange_id,
        asset_id,
        interval_id,
        timestamp,
        longs,
        shorts
    )
    SELECT
        exchange_id,
        asset_id,
        p_interval_id AS interval_id,
        FLOOR(timestamp / p_interval_duration_seconds) * p_interval_duration_seconds AS timestamp_interval,
        SUM(longs) AS longs,
        SUM(shorts) AS shorts
    FROM base_liquidations
    -- Filtrar por el activo específico y usar el rango de timestamp calculado
    WHERE asset_id = p_asset_id AND timestamp >= v_sync_start_timestamp
    GROUP BY exchange_id, asset_id, timestamp_interval
    -- Asegurarse de tener suficientes puntos de datos base para la duración del intervalo
    HAVING COUNT(*) = (p_interval_duration_seconds / p_original_frequency_seconds)
    ON DUPLICATE KEY UPDATE
        longs = VALUES(longs),
        shorts = VALUES(shorts);

    -- Actualizar el timestamp de la última sincronización para este intervalo
    -- al timestamp máximo que se acaba de procesar desde la tabla base.
    REPLACE INTO sync_liquidations (asset_id, interval_id, timestamp) SELECT p_asset_id, p_interval_id, IFNULL(MAX(timestamp), 0) FROM volume
    WHERE asset_id = p_asset_id AND interval_id = p_interval_id;

END //

-- Restablecer el delimitador
DELIMITER ;

-- Truncar tablas de datos (útil para reiniciar datos en desarrollo)
TRUNCATE TABLE open_interest;
TRUNCATE TABLE base_volume;
TRUNCATE TABLE base_liquidations;
TRUNCATE TABLE volume;
TRUNCATE TABLE liquidations;
TRUNCATE TABLE sync_liquidations;
TRUNCATE TABLE sync_volume;
