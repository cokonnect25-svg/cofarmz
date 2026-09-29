BEGIN;
ALTER TABLE fpo_admin_inbox ADD COLUMN IF NOT EXISTS recipient_id TEXT REFERENCES "user"(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS fpo_inbox_thread ON fpo_admin_inbox(digital_fpo_id, (COALESCE(recipient_id,sender_id)), created_at DESC, id DESC);
COMMIT;
