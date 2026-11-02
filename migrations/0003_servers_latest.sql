-- The registry lists every published version of a server. We want one row
-- per server: the latest version.
ALTER TABLE servers ADD COLUMN is_latest INTEGER NOT NULL DEFAULT 0;
