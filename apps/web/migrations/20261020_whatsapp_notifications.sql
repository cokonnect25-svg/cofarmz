BEGIN;
CREATE TABLE IF NOT EXISTS whatsapp_preferences (
 user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 phone TEXT NOT NULL, opted_in BOOLEAN NOT NULL DEFAULT false,
 consent_at TIMESTAMPTZ, consent_source TEXT, opted_out_at TIMESTAMPTZ,
 profile_completion BOOLEAN NOT NULL DEFAULT true, crop_addition BOOLEAN NOT NULL DEFAULT true,
 nearby_matches BOOLEAN NOT NULL DEFAULT true, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS whatsapp_outbox (
 id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 category TEXT NOT NULL CHECK(category IN ('profile_completion','crop_addition','nearby_matches')),
 event_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 sent_at TIMESTAMPTZ, message_id TEXT UNIQUE, error_code TEXT, status_at TIMESTAMPTZ,
 UNIQUE(user_id,category,event_key)
);
CREATE INDEX IF NOT EXISTS whatsapp_outbox_due ON whatsapp_outbox(next_attempt_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS whatsapp_outbox_user ON whatsapp_outbox(user_id,sent_at);
CREATE TABLE IF NOT EXISTS whatsapp_status_events (
 message_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('sent','delivered','read','failed')),
 occurred_at TIMESTAMPTZ NOT NULL, error_code TEXT,
 PRIMARY KEY(message_id,status,occurred_at)
);
COMMIT;
