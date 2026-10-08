-- Username and password sign-in replaces email codes. Older accounts set a password while signed in.
ALTER TABLE celebrity.accounts ADD COLUMN IF NOT EXISTS password_hash TEXT;
