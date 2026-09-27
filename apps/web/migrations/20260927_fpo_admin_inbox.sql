BEGIN;
CREATE TABLE IF NOT EXISTS fpo_admin_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_fpo_id UUID NOT NULL REFERENCES digital_fpos(id) ON DELETE RESTRICT,
  sender_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fpo_admin_inbox_group ON fpo_admin_inbox(digital_fpo_id, created_at DESC, id DESC);
COMMIT;
