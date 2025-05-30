DROP TABLE IF EXISTS volume;
DROP TABLE IF EXISTS liquidations;
DROP TABLE IF EXISTS open_interest;
DROP TABLE IF EXISTS exchanges;
DROP TABLE IF EXISTS sync_liquidations;
DROP TABLE IF EXISTS sync_volume;
DROP TABLE IF EXISTS sync_open_interest;
DROP TABLE IF EXISTS intervals;
DROP TABLE IF EXISTS assets;

DROP VIEW IF EXISTS aggregated_volume;
DROP VIEW IF EXISTS aggregated_liquidations;
DROP VIEW IF EXISTS aggregated_open_interest;

DROP PROCEDURE IF EXISTS generate_aggregated_ohlc;


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
    name VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL UNIQUE,
    seconds INT UNSIGNED NOT NULL,
    is_native BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    UNIQUE INDEX idx_interval_name (name)
);


INSERT INTO intervals (name, seconds, enabled,is_native) VALUES
    ('1m', 60, FALSE, TRUE),
    ('5m', 300, TRUE, TRUE),
    ('15m', 900, FALSE, TRUE),
    ('30m', 1800, FALSE, TRUE),
    ('1h', 3600, TRUE, TRUE),
    ('2h', 7200, FALSE, TRUE),
    ('4h', 14400, TRUE, TRUE),
    ('6h', 21600, FALSE, TRUE),
    ('12h', 43200, FALSE, TRUE),
    ('1D', 86400, TRUE, TRUE),
    ('1W', 604800, TRUE, FALSE),
    ('1M', 2419200, TRUE, FALSE);


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

CREATE TABLE open_interest (
    exchange_id TINYINT UNSIGNED NOT NULL,
    asset_id SMALLINT UNSIGNED NOT NULL,
    interval_id TINYINT UNSIGNED NOT NULL,
    timestamp BIGINT UNSIGNED NOT NULL,
    open_value DECIMAL(40, 18) NOT NULL,
    high_value DECIMAL(40, 18) NOT NULL,
    low_value DECIMAL(40, 18) NOT NULL,
    close_value DECIMAL(40, 18) NOT NULL,
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
    open_value DECIMAL(40, 18) NOT NULL,
    high_value DECIMAL(40, 18) NOT NULL,
    low_value DECIMAL(40, 18) NOT NULL,
    close_value DECIMAL(40, 18) NOT NULL,
    volume_value DECIMAL(40, 18),
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
    longs DECIMAL(40, 18) NOT NULL,
    shorts DECIMAL(40, 18) NOT NULL,
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


CREATE OR REPLACE VIEW aggregated_interval_open_interest AS
SELECT
    oi.exchange_id,
    oi.asset_id,
    i.id as interval_id,
    i.seconds,
    oi.timestamp,
    SUM(oi.open_value) AS open_value,
    SUM(oi.high_value) AS high_value,
    SUM(oi.low_value) AS low_value,
    SUM(oi.close_value) AS close_value
FROM open_interest oi
JOIN intervals i ON 1=1
WHERE i.enabled
AND oi.timestamp = FLOOR(oi.timestamp / i.seconds) * i.seconds
GROUP BY oi.exchange_id, oi.asset_id, i.id, oi.timestamp;


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

CREATE OR REPLACE PROCEDURE generate_aggregated_ohlc(
    IN p_output_table_name VARCHAR(64),
    IN p_asset_id SMALLINT UNSIGNED,
    IN p_target_interval_id TINYINT UNSIGNED
)
BEGIN
    main_procedure_block: BEGIN
        DECLARE v_last_sync_timestamp BIGINT UNSIGNED;
        DECLARE v_sync_start_timestamp BIGINT UNSIGNED;
        DECLARE v_target_interval_seconds INT UNSIGNED;
        DECLARE v_effective_source_interval_id TINYINT UNSIGNED DEFAULT NULL;
        DECLARE v_effective_source_seconds INT UNSIGNED DEFAULT NULL;
        DECLARE v_effective_max_periods INT UNSIGNED;
        DECLARE v_is_liquidations BOOLEAN DEFAULT FALSE;
        DECLARE v_has_volume BOOLEAN DEFAULT FALSE;
        SET @select_columns = '';
        SET @update_columns = '';
        SET @having_condition = '';
        SET @v_effective_source_interval_id_temp = NULL;
        SET @v_effective_source_seconds_temp = NULL;
        SET @v_last_sync_timestamp_temp = NULL;
        SET @sync_table_name = NULL;
        SET @select_sync_sql = NULL;
        SET @interval_sql = NULL;
        SET @sql = NULL;
        SET @sync_sql = NULL;

        IF p_output_table_name = 'liquidations' THEN
            SET v_is_liquidations = TRUE;
        END IF;

        IF p_output_table_name = 'volume' THEN
            SET v_has_volume = TRUE;
        END IF;

        IF v_is_liquidations THEN
            SET @select_columns = 'SUM(longs) AS longs, SUM(shorts) AS shorts';
            SET @update_columns = 'longs = VALUES(longs), shorts = VALUES(shorts)';
        ELSE
            SET @select_columns = CONCAT(
                'SUBSTRING_INDEX(GROUP_CONCAT(open_value ORDER BY timestamp ASC), ",", 1) AS open_value, ',
                'MAX(high_value) AS high_value, ',
                'MIN(low_value) AS low_value, ',
                'SUBSTRING_INDEX(GROUP_CONCAT(close_value ORDER BY timestamp DESC), ",", 1) AS close_value'
            );
            IF v_has_volume THEN
                SET @select_columns = CONCAT(@select_columns, ', SUM(volume_value) AS volume_value');
                SET @update_columns = CONCAT(@update_columns, ', volume_value = VALUES(volume_value)');
            END IF;
            SET @update_columns = CONCAT(
                'open_value = VALUES(open_value), ',
                'high_value = VALUES(high_value), ',
                'low_value = VALUES(low_value), ',
                'close_value = VALUES(close_value)',
                @update_columns
            );
        END IF;

        SET @sync_table_name = CONCAT('sync_', p_output_table_name);

        SET @select_sync_sql = CONCAT('
            SELECT timestamp INTO @v_last_sync_timestamp_temp
            FROM ', @sync_table_name, '
            WHERE asset_id = ', p_asset_id, ' AND interval_id = ', p_target_interval_id, ';');
        PREPARE select_sync_stmt FROM @select_sync_sql;
        EXECUTE select_sync_stmt;
        DEALLOCATE PREPARE select_sync_stmt;

        SET v_last_sync_timestamp = IFNULL(@v_last_sync_timestamp_temp, 0);

        SELECT seconds INTO v_target_interval_seconds
        FROM intervals
        WHERE id = p_target_interval_id;

        SET v_sync_start_timestamp = v_last_sync_timestamp;

        IF v_last_sync_timestamp > 0 THEN
            SET v_sync_start_timestamp = v_last_sync_timestamp + v_target_interval_seconds;
        END IF;

        -- REINICIAR las variables temporales antes de la consulta crítica
        SET @v_effective_source_interval_id_temp = NULL;
        SET @v_effective_source_seconds_temp = NULL;

        SET @interval_sql = CONCAT(
            'SELECT id, seconds INTO @v_effective_source_interval_id_temp, @v_effective_source_seconds_temp FROM intervals i WHERE enabled = TRUE ',
            'AND seconds < ', v_target_interval_seconds,
            ' AND (', v_target_interval_seconds, ' % seconds) = 0 ',
            'AND EXISTS (SELECT 1 FROM ', p_output_table_name, ' t ',
            'WHERE t.asset_id = ', p_asset_id,
            ' AND t.timestamp >= ', v_sync_start_timestamp,
            ' AND t.interval_id = i.id LIMIT 1) ',
            'ORDER BY seconds DESC LIMIT 1'
        );

        PREPARE interval_stmt FROM @interval_sql;
        EXECUTE interval_stmt;
        DEALLOCATE PREPARE interval_stmt;

        SET v_effective_source_interval_id = @v_effective_source_interval_id_temp;
        SET v_effective_source_seconds = @v_effective_source_seconds_temp;

        IF v_effective_source_interval_id IS NULL THEN
            LEAVE main_procedure_block;
        END IF;

        SET v_effective_max_periods = v_target_interval_seconds / v_effective_source_seconds;

        IF v_is_liquidations THEN
            SET @having_condition = CONCAT('HAVING COUNT(*) <= ', v_effective_max_periods);
        ELSE
            SET @having_condition = CONCAT('HAVING COUNT(*) = ', v_effective_max_periods);
        END IF;

        SET @sql = CONCAT('
            INSERT INTO ', p_output_table_name, ' (
                exchange_id,
                asset_id,
                interval_id,
                timestamp,
                ', IF(v_is_liquidations, 'longs, shorts', 'open_value, high_value, low_value, close_value'),
                IF(v_has_volume, ', volume_value', ''), '
            )
            SELECT
                exchange_id,
                asset_id,
                ', p_target_interval_id, ' AS interval_id,
                FLOOR(timestamp / ', v_target_interval_seconds, ') * ', v_target_interval_seconds, ' AS aggregated_timestamp,
                ', @select_columns, '
            FROM ', p_output_table_name, '
            WHERE
                asset_id = ', p_asset_id, '
                AND timestamp >= ', v_sync_start_timestamp, '
                AND interval_id = ', v_effective_source_interval_id, '
            GROUP BY exchange_id, asset_id, aggregated_timestamp
           ', @having_condition, '
            ON DUPLICATE KEY UPDATE
                ', @update_columns, '
        ');

        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;

        SET @sync_sql = CONCAT(
            'REPLACE INTO ', @sync_table_name, ' (asset_id, interval_id, timestamp) ',
            'SELECT ', p_asset_id, ', ', p_target_interval_id, ', IFNULL(MAX(timestamp), 0) ',
            'FROM ', p_output_table_name, ' ',
            'WHERE asset_id = ', p_asset_id, ' AND interval_id = ', p_target_interval_id
        );
        PREPARE sync_stmt FROM @sync_sql;
        EXECUTE sync_stmt;
        DEALLOCATE PREPARE sync_stmt;
    END main_procedure_block;
END //

DELIMITER ;

TRUNCATE TABLE open_interest;
TRUNCATE TABLE volume;
TRUNCATE TABLE liquidations;

TRUNCATE TABLE sync_liquidations;
TRUNCATE TABLE sync_volume;
TRUNCATE TABLE sync_open_interest;
