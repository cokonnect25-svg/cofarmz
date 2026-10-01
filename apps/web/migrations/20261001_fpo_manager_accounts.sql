BEGIN;
CREATE TABLE IF NOT EXISTS fpo_manager_accounts (
  digital_fpo_id UUID PRIMARY KEY REFERENCES digital_fpos(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  updated_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMIT;
