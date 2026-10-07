-- Public player cards for cheap, capped lookups (no more reading every save on every request),
-- and change counters per place and per player so only the people affected refresh.
CREATE TABLE celebrity.profiles(id TEXT PRIMARY KEY, room TEXT, location TEXT, career TEXT, fame BIGINT, trend BIGINT, seen BIGINT, dating INTEGER, crew INTEGER, outside INTEGER, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS profiles_room ON celebrity.profiles(room, seen);
CREATE INDEX IF NOT EXISTS profiles_seen ON celebrity.profiles(seen);
CREATE INDEX IF NOT EXISTS profiles_fame ON celebrity.profiles(fame);
CREATE INDEX IF NOT EXISTS profiles_career ON celebrity.profiles(career, seen);
CREATE TABLE celebrity.pulses(key TEXT PRIMARY KEY, at BIGINT NOT NULL);
