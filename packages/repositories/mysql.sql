DROP TABLE IF EXISTS base_open_interest;
DROP TABLE IF EXISTS base_volume;
DROP TABLE IF EXISTS base_liquidations;
DROP TABLE IF EXISTS volume;
DROP TABLE IF EXISTS liquidations;
DROP TABLE IF EXISTS open_interest;
DROP TABLE IF EXISTS exchanges;
DROP TABLE IF EXISTS sync_liquidations;
DROP TABLE IF EXISTS sync_volume;
DROP TABLE IF EXISTS sync_open_interest;
DROP TABLE IF EXISTS intervals;
DROP TABLE IF EXISTS assets;


DROP VIEW IF EXISTS aggregated_interval_volume;
DROP VIEW IF EXISTS aggregated_interval_liquidations;
DROP VIEW IF EXISTS aggregated_interval_open_interest;

DROP VIEW IF EXISTS aggregated_volume;
DROP VIEW IF EXISTS aggregated_liquidations;
DROP VIEW IF EXISTS aggregated_open_interest;


CREATE TABLE exchanges (
  id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
    id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(16) NOT NULL UNIQUE,
    seconds INT UNSIGNED NOT NULL,
    is_base BOOLEAN DEFAULT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    UNIQUE INDEX idx_interval_name (name),
    UNIQUE INDEX uk_one_base (is_base)
);


INSERT INTO intervals (name, seconds, is_base, enabled) VALUES
    ('1m', 60, NULL, FALSE),
    ('5m', 300, TRUE, TRUE),
    ('15m', 900, NULL, FALSE),
    ('30m', 1800, NULL, FALSE),
    ('1h', 3600, NULL, TRUE),
    ('2h', 7200, NULL, FALSE),
    ('4h', 14400, NULL, TRUE),
    ('6h', 21600, NULL, FALSE),
    ('12h', 43200, NULL, FALSE),
    ('1d', 86400, NULL, TRUE);


CREATE TABLE assets (
    id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    UNIQUE INDEX idx_asset_symbol (symbol)
);


INSERT INTO assets (symbol, name) VALUES
    ('BTC', 'Bitcoin'),
    ('ETH', 'Ethereum'),
    ('SOL', 'Solana'),
    ('XRP', 'XRP'),
    ('BNB', 'BNB');


CREATE TABLE base_open_interest (
    exchange_id TINYINT UNSIGNED NOT NULL,
    asset_id SMALLINT UNSIGNED NOT NULL,
    timestamp BIGINT UNSIGNED NOT NULL,
    open_value DECIMAL(20, 8) NOT NULL,
    high_value DECIMAL(20, 8) NOT NULL,
    low_value DECIMAL(20, 8) NOT NULL,
    close_value DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (exchange_id, asset_id, timestamp),
    INDEX idx_oi_base_asset_timestamp (asset_id, timestamp),
    CONSTRAINT fk_oi_base_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_oi_base_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
);

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

CREATE TABLE open_interest (
    exchange_id TINYINT UNSIGNED NOT NULL,
    asset_id SMALLINT UNSIGNED NOT NULL,
    interval_id TINYINT UNSIGNED NOT NULL,
    timestamp BIGINT UNSIGNED NOT NULL,
    open_value DECIMAL(20, 8) NOT NULL,
    high_value DECIMAL(20, 8) NOT NULL,
    low_value DECIMAL(20, 8) NOT NULL,
    close_value DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (exchange_id, asset_id, interval_id, timestamp),
    INDEX idx_oi_asset_interval_timestamp (asset_id, interval_id, timestamp),
    CONSTRAINT fk_oi_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_oi_asset FOREIGN KEY (asset_id) REFERENCES assets(id),
    CONSTRAINT fk_oi_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
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


CREATE TABLE sync_liquidations (
  asset_id SMALLINT UNSIGNED NOT NULL,
  interval_id TINYINT UNSIGNED NOT NULL,
  timestamp BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (asset_id, interval_id),
  CONSTRAINT fk_sync_liq_interval FOREIGN KEY (interval_id) REFERENCES intervals(id),
  CONSTRAINT fk_sync_liq_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE sync_volume (
  asset_id SMALLINT UNSIGNED NOT NULL,
  interval_id TINYINT UNSIGNED NOT NULL,
  timestamp BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (asset_id, interval_id),
  CONSTRAINT fk_sync_vol_interval FOREIGN KEY (interval_id) REFERENCES intervals(id),
  CONSTRAINT fk_sync_vol_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sync_open_interest (
  asset_id SMALLINT UNSIGNED NOT NULL,
  interval_id TINYINT UNSIGNED NOT NULL,
  timestamp BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (asset_id, interval_id),
  CONSTRAINT fk_sync_oi_interval FOREIGN KEY (interval_id) REFERENCES intervals(id),
  CONSTRAINT fk_sync_oi_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


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
JOIN intervals i ON 1=1
WHERE i.enabled
GROUP BY bv.exchange_id, bv.asset_id, i.id, interval_timestamp
HAVING COUNT(*) = (i.seconds / 300);

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
JOIN intervals i ON 1=1
WHERE i.enabled
GROUP BY bl.exchange_id, bl.asset_id, i.id, interval_timestamp
HAVING COUNT(*) = (i.seconds / 300);

CREATE VIEW aggregated_interval_open_interest AS
SELECT
    oi.exchange_id,
    oi.asset_id,
    i.id as interval_id,
    i.seconds AS interval_duration_seconds,
    FLOOR(oi.timestamp / i.seconds) * i.seconds AS interval_timestamp,
    SUBSTRING_INDEX(GROUP_CONCAT(oi.open_value ORDER BY oi.timestamp ASC), ',', 1) AS open_value,
    MAX(oi.high_value) AS high_value,
    MIN(oi.low_value) AS low_value,
    SUBSTRING_INDEX(GROUP_CONCAT(oi.close_value ORDER BY oi.timestamp DESC), ',', 1) AS close_value
FROM base_open_interest oi
JOIN intervals i ON 1=1
WHERE i.enabled
GROUP BY oi.exchange_id, oi.asset_id, i.id, interval_timestamp
HAVING COUNT(*) = (i.seconds / 300);


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

CREATE VIEW aggregated_volume AS
 SELECT
       asset_id,
       interval_id,
       timestamp,
       AVG(open_value) AS open,
       AVG(high_value) AS high,
       AVG(low_value) AS low,
       AVG(close_value) AS close,
       SUM(volume_value) AS volume
     FROM volume
     GROUP BY asset_id, interval_id, timestamp
     ORDER BY timestamp ASC;


CREATE VIEW aggregated_open_interest AS
SELECT
      asset_id,
      interval_id,
      timestamp,
      SUM(open_value) AS open,
      SUM(high_value) AS high,
      SUM(low_value) AS low,
      SUM(close_value) AS close
    FROM open_interest
    GROUP BY asset_id, interval_id, timestamp
    ORDER BY timestamp ASC;


DELIMITER //

DROP PROCEDURE IF EXISTS sync_volume_intervals //

CREATE PROCEDURE sync_volume_intervals(
    IN p_asset_id SMALLINT UNSIGNED,
    IN p_interval_id TINYINT UNSIGNED,
    IN p_interval_duration_seconds BIGINT,
    IN p_original_frequency_seconds BIGINT
)
BEGIN

    DECLARE v_last_sync_timestamp BIGINT;

    DECLARE v_sync_start_timestamp BIGINT;


    SELECT timestamp INTO v_last_sync_timestamp
    FROM sync_volume
    WHERE asset_id = p_asset_id AND interval_id = p_interval_id;


    IF v_last_sync_timestamp IS NULL THEN
        SET v_last_sync_timestamp = 0;
    END IF;


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

    WHERE asset_id = p_asset_id AND timestamp >= v_sync_start_timestamp
    GROUP BY exchange_id, asset_id, interval_timestamp

    HAVING COUNT(*) = (p_interval_duration_seconds / p_original_frequency_seconds)
    ON DUPLICATE KEY UPDATE
        open_value = VALUES(open_value),
        high_value = VALUES(high_value),
        low_value = VALUES(low_value),
        close_value = VALUES(close_value),
        volume_value = VALUES(volume_value);


    IF ROW_COUNT() > 0 THEN
        REPLACE INTO sync_volume (asset_id, interval_id, timestamp) 
        SELECT p_asset_id, p_interval_id, IFNULL(MAX(timestamp), 0) FROM volume
        WHERE asset_id = p_asset_id AND interval_id = p_interval_id;
    END IF;
END //


DROP PROCEDURE IF EXISTS sync_liquidations_intervals //

CREATE PROCEDURE sync_liquidations_intervals(
    IN p_asset_id SMALLINT UNSIGNED,
    IN p_interval_id TINYINT UNSIGNED,
    IN p_interval_duration_seconds BIGINT,
    IN p_original_frequency_seconds BIGINT
)
BEGIN

    DECLARE v_last_sync_timestamp BIGINT UNSIGNED;

    DECLARE v_sync_start_timestamp BIGINT UNSIGNED;


    SELECT timestamp INTO v_last_sync_timestamp
    FROM sync_liquidations
    WHERE asset_id = p_asset_id AND interval_id = p_interval_id;


    IF v_last_sync_timestamp IS NULL THEN
        SET v_last_sync_timestamp = 0;
    END IF;


    SET v_sync_start_timestamp = v_last_sync_timestamp + p_interval_duration_seconds;


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

    WHERE asset_id = p_asset_id AND timestamp >= v_sync_start_timestamp
    GROUP BY exchange_id, asset_id, timestamp_interval

    HAVING COUNT(*) = (p_interval_duration_seconds / p_original_frequency_seconds)
    ON DUPLICATE KEY UPDATE
        longs = VALUES(longs),
        shorts = VALUES(shorts);


    IF ROW_COUNT() > 0 THEN
        REPLACE INTO sync_liquidations (asset_id, interval_id, timestamp) 
        SELECT p_asset_id, p_interval_id, IFNULL(MAX(timestamp), 0) FROM volume
        WHERE asset_id = p_asset_id AND interval_id = p_interval_id;
    END IF;

END //

DROP PROCEDURE IF EXISTS sync_open_interest_intervals //

CREATE PROCEDURE sync_open_interest_intervals(
    IN p_asset_id SMALLINT UNSIGNED,
    IN p_interval_id TINYINT UNSIGNED,
    IN p_interval_duration_seconds BIGINT,
    IN p_original_frequency_seconds BIGINT
)
BEGIN

    DECLARE v_last_sync_timestamp BIGINT UNSIGNED;

    DECLARE v_sync_start_timestamp BIGINT UNSIGNED;


    SELECT timestamp INTO v_last_sync_timestamp
    FROM sync_open_interest
    WHERE asset_id = p_asset_id AND interval_id = p_interval_id;


    IF v_last_sync_timestamp IS NULL THEN
        SET v_last_sync_timestamp = 0;
    END IF;


    SET v_sync_start_timestamp = v_last_sync_timestamp + p_interval_duration_seconds;

    INSERT INTO open_interest (
        exchange_id,
        asset_id,
        interval_id,
        timestamp,
        open_value,
        high_value,
        low_value,
        close_value
    )
    SELECT
        exchange_id,
        asset_id,
        p_interval_id AS interval_id,
        FLOOR(timestamp / p_interval_duration_seconds) * p_interval_duration_seconds AS interval_timestamp,
        SUBSTRING_INDEX(GROUP_CONCAT(open_value ORDER BY timestamp ASC), ',', 1) AS open_value,
        MAX(high_value) AS high_value,
        MIN(low_value) AS low_value,
        SUBSTRING_INDEX(GROUP_CONCAT(close_value ORDER BY timestamp DESC), ',', 1) AS close_value
    FROM base_open_interest

    WHERE asset_id = p_asset_id AND timestamp >= v_sync_start_timestamp
    GROUP BY exchange_id, asset_id, interval_timestamp

    HAVING COUNT(*) = (p_interval_duration_seconds / p_original_frequency_seconds)
    ON DUPLICATE KEY UPDATE
        open_value = VALUES(open_value),
        high_value = VALUES(high_value),
        low_value = VALUES(low_value),
        close_value = VALUES(close_value);


    IF ROW_COUNT() > 0 THEN
        REPLACE INTO sync_open_interest (asset_id, interval_id, timestamp) 
        SELECT p_asset_id, p_interval_id, IFNULL(MAX(timestamp), 0) FROM open_interest
        WHERE asset_id = p_asset_id AND interval_id = p_interval_id;
    END IF;
END //


DELIMITER ;


TRUNCATE TABLE open_interest;
TRUNCATE TABLE base_volume;
TRUNCATE TABLE base_liquidations;
TRUNCATE TABLE volume;
TRUNCATE TABLE liquidations;
TRUNCATE TABLE sync_liquidations;
TRUNCATE TABLE sync_volume;
TRUNCATE TABLE sync_open_interest;
