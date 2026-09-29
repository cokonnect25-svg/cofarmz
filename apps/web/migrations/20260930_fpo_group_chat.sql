BEGIN;
CREATE TABLE IF NOT EXISTS fpo_group_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES farmer_groups(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fpo_group_chat_history ON fpo_group_chat(group_id,created_at DESC,id DESC);
COMMIT;
