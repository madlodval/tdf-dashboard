DROP TABLE IF EXISTS volume_master;
DROP TABLE IF EXISTS liquidations_master;
DROP TABLE IF EXISTS volume;
DROP TABLE IF EXISTS liquidations;
DROP TABLE IF EXISTS open_interest;
DROP TABLE IF EXISTS exchanges;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS sync_liquidations;
DROP TABLE IF EXISTS sync_volume;
DROP TABLE IF EXISTS intervals;

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
    timestamp TIMESTAMP NOT NULL,
    seconds INT UNSIGNED GENERATED ALWAYS AS (TIME_TO_SEC(TIME(timestamp))) STORED,
    open_value DECIMAL(20, 8) NOT NULL,
    high_value DECIMAL(20, 8) NOT NULL,
    low_value DECIMAL(20, 8) NOT NULL,
    close_value DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (exchange_id, asset_id, timestamp),
    INDEX idx_asset_timestamp (asset_id, timestamp),
    INDEX idx_asset_seconds (asset_id, seconds),
    CONSTRAINT fk_oi_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_oi_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
);

-- Nuevas tablas para datos crudos (ej. 5 minutos)
CREATE TABLE volume_master (
    exchange_id TINYINT UNSIGNED NOT NULL,
    asset_id SMALLINT UNSIGNED NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    open_value DECIMAL(20, 8) NOT NULL,
    high_value DECIMAL(20, 8) NOT NULL,
    low_value DECIMAL(20, 8) NOT NULL,
    close_value DECIMAL(20, 8) NOT NULL,
    volume_value DECIMAL(20, 8),
    PRIMARY KEY (exchange_id, asset_id, timestamp),
    INDEX idx_vol5_asset_timestamp (asset_id, timestamp),
    CONSTRAINT fk_vol5_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_vol5_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
);

CREATE TABLE liquidations_master (
    exchange_id TINYINT UNSIGNED NOT NULL,
    asset_id SMALLINT UNSIGNED NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    longs DECIMAL(20, 8) NOT NULL,
    shorts DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (exchange_id, asset_id, timestamp),
    INDEX idx_liq5_asset_timestamp (asset_id, timestamp),
    CONSTRAINT fk_liq5_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_liq5_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
);

CREATE TABLE volume (
    exchange_id TINYINT UNSIGNED NOT NULL,
    asset_id SMALLINT UNSIGNED NOT NULL,
    interval_id TINYINT UNSIGNED NOT NULL,
    timestamp TIMESTAMP NOT NULL,
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
    timestamp TIMESTAMP NOT NULL,
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
  last_sync_timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sync_liq_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_volume (
  interval_id TINYINT UNSIGNED PRIMARY KEY,
  last_sync_timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sync_vol_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial sync records for each interval
INSERT IGNORE INTO sync_liquidations (interval_id, last_sync_timestamp)
SELECT id, '1970-01-01 00:00:00'
FROM intervals;

INSERT IGNORE INTO sync_volume (interval_id, last_sync_timestamp)
SELECT id, '1970-01-01 00:00:00'
FROM intervals;

-- Truncar tablas si ya existen y quieres empezar limpio

TRUNCATE TABLE open_interest;
TRUNCATE TABLE volume_master;
TRUNCATE TABLE liquidations_master;
TRUNCATE TABLE volume;
TRUNCATE TABLE liquidations;

