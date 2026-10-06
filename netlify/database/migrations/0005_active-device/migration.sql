-- Which device is currently playing each character (one device at a time).
CREATE TABLE celebrity.active_devices(player_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, at BIGINT NOT NULL);
