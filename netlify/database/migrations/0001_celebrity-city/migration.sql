CREATE SCHEMA IF NOT EXISTS celebrity;
CREATE TABLE celebrity.players(id TEXT PRIMARY KEY, state TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, created BIGINT NOT NULL);
CREATE TABLE celebrity.requests(player_id TEXT, request_id TEXT, PRIMARY KEY(player_id,request_id));
CREATE TABLE celebrity.messages(id TEXT PRIMARY KEY, sender TEXT, location TEXT, recipient TEXT, body TEXT, at BIGINT);
CREATE TABLE celebrity.reports(id TEXT PRIMARY KEY, reporter TEXT, message_id TEXT, at BIGINT);
CREATE TABLE celebrity.seasons(id INTEGER PRIMARY KEY, starts BIGINT, ends BIGINT, settled INTEGER DEFAULT 0);
CREATE TABLE celebrity.agreements(id TEXT PRIMARY KEY, state TEXT NOT NULL);
