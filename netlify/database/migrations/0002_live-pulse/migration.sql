-- One-row change counter. Players poll it cheaply and fetch full state only when it moves.
CREATE TABLE celebrity.pulse(id INTEGER PRIMARY KEY, at BIGINT NOT NULL);
INSERT INTO celebrity.pulse VALUES(1,0);
