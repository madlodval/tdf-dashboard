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

CREATE TABLE exchanges (
  id SMALLSERIAL PRIMARY KEY,
  code VARCHAR(3) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL UNIQUE
);

INSERT INTO exchanges (code, name) VALUES
('0', 'BitMEX'), ('2', 'Deribit'), ('3', 'OKX'), ('4', 'Huobi'), ('6', 'Bybit'),
('7', 'Phemex'), ('8', 'dYdX'), ('P', 'Poloniex'), ('V', 'Vertex'), ('D', 'Bitforex'),
('K', 'Kraken'), ('U', 'Bithumb'), ('B', 'Bitstamp'), ('H', 'Hyperliquid'), ('L', 'BitFlyer'),
('M', 'BtcMarkets'), ('I', 'Bit2c'), ('E', 'MercadoBitcoin'), ('N', 'Independent Reserve'),
('G', 'Gemini'), ('Y', 'Gate.io'), ('C', 'Coinbase'), ('F', 'Bitfinex'), ('J', 'Luno'),
('W', 'WOO X'), ('A', 'Binance');

CREATE TABLE intervals (
    id SMALLSERIAL PRIMARY KEY,
    name VARCHAR(16) NOT NULL UNIQUE,
    seconds INTEGER NOT NULL
);

INSERT INTO intervals (name, seconds) VALUES
    ('5m', 300), ('15m', 900), ('30m', 1800), ('1h', 3600),
    ('2h', 7200), ('4h', 14400), ('6h', 21600), ('12h', 43200), ('1d', 86400);

CREATE TABLE assets (
    id SMALLSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL
);

INSERT INTO assets (symbol, name) VALUES
    ('BTC', 'Bitcoin'), ('ETH', 'Ethereum'), ('SOL', 'Solana'), ('XRP', 'XRP');

CREATE TABLE open_interest (
    exchange_id SMALLINT NOT NULL,
    asset_id SMALLINT NOT NULL,
    timestamp BIGINT NOT NULL,
    seconds INTEGER GENERATED ALWAYS AS (timestamp % 86400) STORED,
    open_value DECIMAL(20, 8) NOT NULL,
    high_value DECIMAL(20, 8) NOT NULL,
    low_value DECIMAL(20, 8) NOT NULL,
    close_value DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (exchange_id, asset_id, timestamp),
    CONSTRAINT fk_oi_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_oi_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
);

CREATE INDEX idx_oi_asset_timestamp ON open_interest (asset_id, timestamp);
CREATE INDEX idx_oi_asset_seconds ON open_interest (asset_id, seconds);


-- Nuevas tablas para datos crudos (ej. 5 minutos)
CREATE TABLE base_volume (
    exchange_id SMALLINT NOT NULL,
    asset_id SMALLINT NOT NULL,
    timestamp BIGINT NOT NULL,
    open_value DECIMAL(20, 8) NOT NULL,
    high_value DECIMAL(20, 8) NOT NULL,
    low_value DECIMAL(20, 8) NOT NULL,
    close_value DECIMAL(20, 8) NOT NULL,
    volume_value DECIMAL(20, 8),
    PRIMARY KEY (exchange_id, asset_id, timestamp),
    CONSTRAINT fk_vol_base_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_vol_base_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
);

CREATE INDEX idx_vol_base_asset_timestamp ON base_volume (asset_id, timestamp);

CREATE TABLE base_liquidations (
    exchange_id SMALLINT NOT NULL,
    asset_id SMALLINT NOT NULL,
    timestamp BIGINT NOT NULL,
    longs DECIMAL(20, 8) NOT NULL,
    shorts DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (exchange_id, asset_id, timestamp),
    CONSTRAINT fk_liq_base_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_liq_base_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
);

CREATE INDEX idx_liq_base_asset_timestamp ON base_liquidations (asset_id, timestamp);

CREATE TABLE volume (
    exchange_id SMALLINT NOT NULL,
    asset_id SMALLINT NOT NULL,
    interval_id SMALLINT NOT NULL,
    timestamp BIGINT NOT NULL,
    open_value DECIMAL(20, 8) NOT NULL,
    high_value DECIMAL(20, 8) NOT NULL,
    low_value DECIMAL(20, 8) NOT NULL,
    close_value DECIMAL(20, 8) NOT NULL,
    volume_value DECIMAL(20, 8),
    PRIMARY KEY (exchange_id, asset_id, interval_id, timestamp),
    CONSTRAINT fk_vol_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_vol_asset FOREIGN KEY (asset_id) REFERENCES assets(id),
    CONSTRAINT fk_vol_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
);

CREATE INDEX idx_vol_asset_interval_timestamp ON volume (asset_id, interval_id, timestamp);

CREATE TABLE liquidations (
    exchange_id SMALLINT NOT NULL,
    asset_id SMALLINT NOT NULL,
    interval_id SMALLINT NOT NULL,
    timestamp BIGINT NOT NULL,
    longs DECIMAL(20, 8) NOT NULL,
    shorts DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (exchange_id, asset_id, interval_id, timestamp),
    CONSTRAINT fk_liq_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_liq_asset FOREIGN KEY (asset_id) REFERENCES assets(id),
    CONSTRAINT fk_liq_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
);

CREATE INDEX idx_liq_asset_interval_timestamp ON liquidations (asset_id, interval_id, timestamp);

CREATE TABLE IF NOT EXISTS sync_liquidations (
  interval_id SMALLINT PRIMARY KEY,
  last_sync_timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sync_liq_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
);

CREATE TABLE IF NOT EXISTS sync_volume (
  interval_id SMALLINT PRIMARY KEY,
  last_sync_timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sync_vol_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
);

-- Insert initial sync records for each interval
INSERT INTO sync_liquidations (interval_id, last_sync_timestamp)
SELECT id, '1970-01-01 00:00:00'
FROM intervals
ON CONFLICT (interval_id) DO NOTHING;

INSERT INTO sync_volume (interval_id, last_sync_timestamp)
SELECT id, '1970-01-01 00:00:00'
FROM intervals
ON CONFLICT (interval_id) DO NOTHING;


TRUNCATE TABLE open_interest;
TRUNCATE TABLE base_volume;
TRUNCATE TABLE base_liquidations;
TRUNCATE TABLE volume;
TRUNCATE TABLE liquidations;


-- create_volume_intervals Procedure for PostgreSQL

-- Usamos CREATE OR REPLACE PROCEDURE (disponible desde PostgreSQL 11)
-- Si usas una versión anterior de PostgreSQL (< 11), necesitarías adaptar esto a una función
-- que devuelve un conjunto de filas (RETURNS TABLE) usando PL/pgSQL.
CREATE OR REPLACE PROCEDURE create_volume_intervals(
    p_interval_id INT,
    p_interval_duration_seconds BIGINT,
    p_start_timestamp BIGINT,
    p_end_timestamp BIGINT,
    p_original_frequency_seconds BIGINT
)
LANGUAGE sql -- Usamos LANGUAGE sql ya que es una simple ejecución de INSERT ... SELECT
AS $$
    -- Inserta los resultados de la consulta agregada por intervalos en la tabla 'volume'
    INSERT INTO volume ( -- Tabla de destino
        exchange_id,
        asset_id,
        interval_id,
        timestamp, -- Columna en la tabla de destino para el timestamp del intervalo
        open_value,
        high_value,
        low_value,
        close_value,
        volume_value
    )
    -- Definimos CTEs para calcular el timestamp del intervalo y rankear los registros dentro de cada intervalo
    WITH IntervalData AS (
        -- Selecciona los datos originales de 'base_volume' dentro del rango de tiempo especificado
        -- y calcula el timestamp de inicio del intervalo para cada registro.
        -- Asumiendo que 'timestamp' es un valor numérico (ej: segundos desde epoch).
        SELECT
            exchange_id,
            asset_id,
            timestamp, -- Columna de timestamp original de la tabla de origen
            open_value,
            high_value,
            low_value,
            close_value,
            volume_value,
            -- Calcula el inicio del intervalo de tiempo usando FLOOR
            FLOOR(timestamp / p_interval_duration_seconds) * p_interval_duration_seconds AS interval_timestamp -- Alias para el timestamp del intervalo calculado
        FROM base_volume -- Tabla de origen
        WHERE timestamp >= p_start_timestamp AND timestamp <= p_end_timestamp
    ),
    RankedData AS (
        -- Para cada grupo de (exchange_id, asset_id, interval_timestamp),
        -- asigna un número de fila basado en el orden ascendente y descendente del timestamp original.
        SELECT
            exchange_id,
            asset_id,
            timestamp, -- Columna de timestamp original
            open_value,
            high_value,
            low_value,
            close_value,
            volume_value,
            interval_timestamp, -- Timestamp del intervalo calculado
            -- Asigna rango 1 al registro con el timestamp más bajo dentro de cada intervalo
            ROW_NUMBER() OVER (PARTITION BY exchange_id, asset_id, interval_timestamp ORDER BY timestamp ASC) AS rn_asc,
            -- Asigna rango 1 al registro con el timestamp más alto dentro de cada intervalo
            ROW_NUMBER() OVER (PARTITION BY exchange_id, asset_id, interval_timestamp ORDER BY timestamp DESC) AS rn_desc
        FROM IntervalData
    )
    -- Selecciona los datos agregados por 'exchange_id', 'asset_id' y el timestamp del intervalo.
    -- Utiliza los rangos calculados para seleccionar el primer ('rn_asc' = 1) y último ('rn_desc' = 1) valor de open_value y close_value.
    SELECT
        exchange_id,
        asset_id,
        p_interval_id AS interval_id, -- Utiliza el parámetro 'p_interval_id' pasado al procedimiento
        interval_timestamp, -- Selecciona el timestamp del intervalo calculado
        -- Selecciona 'open_value' solo para la fila con el ranking ascendente 1 (el primer registro del intervalo)
        MAX(CASE WHEN rn_asc = 1 THEN open_value END) AS open_value,
        MAX(high_value) AS high_value, -- El máximo de 'high_value' en el intervalo
        MIN(low_value) AS low_value,   -- El mínimo de 'low_value' en el intervalo
        -- Selecciona 'close_value' solo para la fila con el ranking descendente 1 (el último registro del intervalo)
        MAX(CASE WHEN rn_desc = 1 THEN close_value END) AS close_value,
        SUM(volume_value) AS volume_value -- La suma de 'volume_value' en el intervalo
    FROM RankedData
    -- Agrupa los resultados por 'exchange_id', 'asset_id' y el timestamp del intervalo
    GROUP BY exchange_id, asset_id, interval_timestamp
    -- Filtra los grupos, incluyendo solo aquellos que tienen el número esperado de registros originales.
    HAVING COUNT(*) = (p_interval_duration_seconds / p_original_frequency_seconds);
$$;