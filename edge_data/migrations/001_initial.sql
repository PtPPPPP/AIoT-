CREATE TABLE samples (
 id TEXT PRIMARY KEY, gateway_id TEXT NOT NULL, sensor_id TEXT NOT NULL,
 zone_id TEXT NOT NULL, metric TEXT NOT NULL, unit TEXT NOT NULL,
 captured_ms INTEGER NOT NULL, received_ms INTEGER NOT NULL,
 quality TEXT NOT NULL, value REAL, payload TEXT NOT NULL,
 UNIQUE(gateway_id, sensor_id, metric, captured_ms)
);
CREATE INDEX samples_range ON samples(zone_id, metric, sensor_id, captured_ms);
CREATE TABLE events (
 id TEXT PRIMARY KEY, zone_id TEXT NOT NULL, device TEXT,
 kind TEXT NOT NULL, command_id TEXT, observed_ms INTEGER NOT NULL,
 payload TEXT NOT NULL
);
CREATE INDEX events_range ON events(zone_id, observed_ms, id);
CREATE INDEX events_commands ON events(command_id, observed_ms);
CREATE TABLE contexts (
 version TEXT PRIMARY KEY, zone_id TEXT NOT NULL, effective_ms INTEGER NOT NULL,
 payload TEXT NOT NULL, UNIQUE(zone_id, effective_ms)
);
CREATE INDEX contexts_range ON contexts(zone_id, effective_ms);
CREATE TABLE conflicts (id INTEGER PRIMARY KEY, identity TEXT NOT NULL, received_ms INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
PRAGMA user_version = 1;
