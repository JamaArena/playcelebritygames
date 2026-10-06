-- Email accounts with one-time codes, and multi-device sessions.
CREATE TABLE celebrity.accounts(player_id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created BIGINT NOT NULL);
CREATE TABLE celebrity.codes(email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, purpose TEXT NOT NULL, payload TEXT NOT NULL, expires BIGINT NOT NULL, attempts INTEGER NOT NULL, sent BIGINT NOT NULL);
CREATE TABLE celebrity.sessions(token_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL, created BIGINT NOT NULL);
