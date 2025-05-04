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

DROP VIEW IF EXISTS aggregated_interval_volume;
DROP VIEW IF EXISTS aggregated_interval_liquidations;

DROP VIEW IF EXISTS aggregated_volume;
DROP VIEW IF EXISTS aggregated_liquidations;
DROP VIEW IF EXISTS aggregated_open_interest;


CREATE TABLE exchanges (
  id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(3) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL UNIQUE,
  UNIQUE INDEX idx_exchange_code (code)
);

INSERT INTO exchanges (code, name) VALUES
('0', 'BitMEX'), ('2', 'Deribit'), ('3', 'OKX'), ('4', 'Huobi'), ('6', 'Bybit'),
('7', 'Phemex'), ('8', 'dYdX'), ('P', 'Poloniex'), ('V', 'Vertex'), ('D', 'Bitforex'),
('K', 'Kraken'), ('U', 'Bithumb'), ('B', 'Bitstamp'), ('H', 'Hyperliquid'), ('L', 'BitFlyer'),
('M', 'BtcMarkets'), ('I', 'Bit2c'), ('E', 'MercadoBitcoin'), ('N', 'Independent Reserve'),
('G', 'Gemini'), ('Y', 'Gate.io'), ('C', 'Coinbase'), ('F', 'Bitfinex'), ('J', 'Luno'),
('W', 'WOO X'), ('A', 'Binance');

CREATE TABLE intervals (
    id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(16) NOT NULL UNIQUE,
    seconds INT UNSIGNED NOT NULL,
    UNIQUE INDEX idx_interval_name (name)
);

INSERT INTO intervals (name, seconds) VALUES
    ('5m', 300), ('15m', 900), ('30m', 1800), ('1h', 3600),
    ('2h', 7200), ('4h', 14400), ('6h', 21600), ('12h', 43200), ('1d', 86400);

CREATE TABLE assets (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    UNIQUE INDEX idx_asset_symbol (symbol)
);

INSERT INTO assets (symbol, name) VALUES
    ('BTC', 'Bitcoin'), ('ETH', 'Ethereum'), ('SOL', 'Solana'), ('XRP', 'XRP');

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


CREATE TABLE IF NOT EXISTS sync_liquidations (
  interval_id TINYINT UNSIGNED PRIMARY KEY,
  timestamp BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sync_liq_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_volume (
  interval_id TINYINT UNSIGNED PRIMARY KEY,
  timestamp BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sync_vol_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO sync_liquidations (interval_id, timestamp)
SELECT id, 0
FROM intervals;

INSERT IGNORE INTO sync_volume (interval_id, timestamp)
SELECT id, 0
FROM intervals;


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

DELIMITER //

DROP PROCEDURE IF EXISTS sync_volume_intervals //

CREATE PROCEDURE sync_volume_intervals(
    IN p_interval_id INT,
    IN p_interval_duration_seconds BIGINT,
    IN p_max_base_timestamp BIGINT, -- Este es el maxBaseTimestamp de JS
    IN p_original_frequency_seconds BIGINT
)
BEGIN
    -- Variable para almacenar el último timestamp sincronizado registrado en sync_volume para este intervalo
    DECLARE v_last_sync_timestamp BIGINT;
    -- Calcular el timestamp de inicio real para la sincronización
    DECLARE v_sync_start_timestamp BIGINT;

    -- Obtener el último timestamp sincronizado registrado en sync_volume para el intervalo dado
    SELECT timestamp INTO v_last_sync_timestamp
    FROM sync_volume
    WHERE interval_id = p_interval_id;

    -- Si no hay registro de sincronización para este intervalo, comenzar desde 0
    IF v_last_sync_timestamp IS NULL THEN
        SET v_last_sync_timestamp = 0;
    END IF;

    -- Calcular el timestamp de inicio real (último timestamp sincronizado + 1)
    SET v_sync_start_timestamp = v_last_sync_timestamp + 1;

    -- Si el timestamp máximo en la base es menor que el inicio de sincronización, no hay nada que sincronizar
    IF p_max_base_timestamp < v_sync_start_timestamp THEN
        -- No hay datos nuevos para sincronizar para este intervalo
        SELECT 0 AS affectedRows; -- Devolver 0 filas afectadas para indicar que no se hizo nada
    ELSE
        -- Insertar/Actualizar datos de volumen agregados
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
        -- Usar el timestamp de inicio calculado y el timestamp final pasado
        WHERE timestamp >= v_sync_start_timestamp AND timestamp <= p_max_base_timestamp
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
        UPDATE sync_volume
        SET timestamp = p_max_base_timestamp
        WHERE interval_id = p_interval_id;
    END IF;

END //

DELIMITER ;


DELIMITER //

DROP PROCEDURE IF EXISTS sync_liquidations_intervals //

CREATE PROCEDURE sync_liquidations_intervals(
    IN p_interval_id INT,
    IN p_interval_duration_seconds BIGINT,
    IN p_max_base_timestamp BIGINT, -- Este es el maxBaseTimestamp de JS
    IN p_original_frequency_seconds BIGINT
)
BEGIN
    -- Variable para almacenar el último timestamp sincronizado registrado en sync_liquidations para este intervalo
    DECLARE v_last_sync_timestamp BIGINT;
    -- Calcular el timestamp de inicio real para la sincronización
    DECLARE v_sync_start_timestamp BIGINT;

    -- Obtener el último timestamp sincronizado registrado en sync_liquidations para el intervalo dado
    SELECT timestamp INTO v_last_sync_timestamp
    FROM sync_liquidations
    WHERE interval_id = p_interval_id;

    -- Si no hay registro de sincronización para este intervalo, comenzar desde 0
    IF v_last_sync_timestamp IS NULL THEN
        SET v_last_sync_timestamp = 0;
    END IF;

    -- Calcular el timestamp de inicio real (último timestamp sincronizado + 1)
    SET v_sync_start_timestamp = v_last_sync_timestamp + 1;

    -- Si el timestamp máximo en la base es menor que el inicio de sincronización, no hay nada que sincronizar
    IF p_max_base_timestamp < v_sync_start_timestamp THEN
        -- No hay datos nuevos para sincronizar para este intervalo
        SELECT 0 AS affectedRows; -- Devolver 0 filas afectadas para indicar que no se hizo nada
    ELSE
        -- Insertar/Actualizar datos de liquidaciones agregados
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
        -- Usar el timestamp de inicio calculado y el timestamp final pasado
        WHERE timestamp >= v_sync_start_timestamp AND timestamp <= p_max_base_timestamp
        GROUP BY exchange_id, asset_id, timestamp_interval
        -- Asegurarse de tener suficientes puntos de datos base para la duración del intervalo
        HAVING COUNT(*) = (p_interval_duration_seconds / p_original_frequency_seconds)
        ON DUPLICATE KEY UPDATE
            longs = VALUES(longs),
            shorts = VALUES(shorts);

        -- Actualizar el timestamp de la última sincronización para este intervalo
        -- al timestamp máximo que se acaba de procesar desde la tabla base.
        UPDATE sync_liquidations
        SET timestamp = p_max_base_timestamp
        WHERE interval_id = p_interval_id;
    END IF;

END //

DELIMITER ;

TRUNCATE TABLE open_interest;
TRUNCATE TABLE base_volume;
TRUNCATE TABLE base_liquidations;
TRUNCATE TABLE volume;
TRUNCATE TABLE liquidations;
