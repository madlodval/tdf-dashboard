DROP TABLE IF EXISTS volume;
DROP TABLE IF EXISTS open_interest;
DROP TABLE IF EXISTS liquidations;
DROP TABLE IF EXISTS price_assets;
DROP TABLE IF EXISTS intervals;
DROP TABLE IF EXISTS exchanges;
DROP TABLE IF EXISTS assets;

CREATE TABLE exchanges (
  id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(3) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL UNIQUE,
  UNIQUE INDEX idx_exchange_code (code)
);

INSERT INTO exchanges (code, name) VALUES
('0', 'BitMEX'),
('2', 'Deribit'),
('3', 'OKX'),
('4', 'Huobi'),
('6', 'Bybit'),
('7', 'Phemex'),
('8', 'dYdX'),
('P', 'Poloniex'),
('V', 'Vertex'),
('D', 'Bitforex'),
('K', 'Kraken'),
('U', 'Bithumb'),
('B', 'Bitstamp'),
('H', 'Hyperliquid'),
('L', 'BitFlyer'),
('M', 'BtcMarkets'),
('I', 'Bit2c'),
('E', 'MercadoBitcoin'),
('N', 'Independent Reserve'),
('G', 'Gemini'),
('Y', 'Gate.io'),
('C', 'Coinbase'),
('F', 'Bitfinex'),
('J', 'Luno'),
('W', 'WOO X'),
('A', 'Binance');

CREATE TABLE intervals (
    id TINYINT UNSIGNED PRIMARY KEY,
    name VARCHAR(16) NOT NULL UNIQUE,
    UNIQUE INDEX idx_interval_name (name)
);

INSERT INTO intervals (id, name) VALUES
    (1, '1min'),
    (2, '5min'),
    (3, '15min'),
    (4, '30min'),
    (5, '1hour'),
    (6, '2hour'),
    (7, '4hour'),
    (8, '6hour'),
    (9, '12hour'),
    (10, 'daily');

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
    ('XRP', 'XRP');

CREATE TABLE open_interest (
    exchange_id TINYINT UNSIGNED NOT NULL,
    asset_id SMALLINT UNSIGNED NOT NULL,
    interval_id TINYINT UNSIGNED NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    open_value DECIMAL(20, 8) NOT NULL,
    high_value DECIMAL(20, 8) NOT NULL,
    low_value DECIMAL(20, 8) NOT NULL,
    close_value DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (exchange_id, asset_id, interval_id, timestamp),
    INDEX idx_asset_interval_timestamp (asset_id, interval_id, timestamp),
    CONSTRAINT fk_open_interest_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_open_interest_asset FOREIGN KEY (asset_id) REFERENCES assets(id),
    CONSTRAINT fk_open_interest_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
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
    INDEX idx_volume_asset_interval_timestamp (asset_id, interval_id, timestamp),
    CONSTRAINT fk_volume_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
    CONSTRAINT fk_volume_asset FOREIGN KEY (asset_id) REFERENCES assets(id),
    CONSTRAINT fk_volume_interval FOREIGN KEY (interval_id) REFERENCES intervals(id)
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

CREATE TABLE price_assets (
    asset_id SMALLINT UNSIGNED NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    PRIMARY KEY (asset_id, timestamp),
    CONSTRAINT fk_price_asset FOREIGN KEY (asset_id) REFERENCES assets(id)
);

TRUNCATE TABLE open_interest;
TRUNCATE TABLE volume;
TRUNCATE TABLE liquidations;
