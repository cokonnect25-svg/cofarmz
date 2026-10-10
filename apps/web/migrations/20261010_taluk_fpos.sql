BEGIN;
CREATE TABLE IF NOT EXISTS fpo_taluks (
 id BIGSERIAL PRIMARY KEY,
 district_id BIGINT NOT NULL REFERENCES fpo_districts(id),
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 UNIQUE(district_id,code), UNIQUE(id,district_id)
);
-- Codes keep local-language aliases in the same taluk organization.
CREATE OR REPLACE FUNCTION refresh_fpo_taluks() RETURNS void LANGUAGE SQL AS $$
 INSERT INTO fpo_taluks(district_id,code,name)
 SELECT district_id,code,COALESCE(min(name) FILTER (WHERE name ~ '^[A-Za-z]'),min(name))
 FROM fpo_localities WHERE kind='subdistrict' GROUP BY district_id,code
 ON CONFLICT(district_id,code) DO NOTHING;
$$;
SELECT refresh_fpo_taluks();
ALTER TABLE digital_fpos ADD COLUMN IF NOT EXISTS taluk_id BIGINT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS taluk_id BIGINT;
ALTER TABLE farmer_fpo_assignments ADD COLUMN IF NOT EXISTS taluk_id BIGINT;
ALTER TABLE digital_fpos DROP CONSTRAINT IF EXISTS digital_fpos_district_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS digital_fpos_district_unique ON digital_fpos(district_id) WHERE taluk_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS digital_fpos_taluk_unique ON digital_fpos(taluk_id) WHERE taluk_id IS NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='digital_fpos_taluk_parent' AND conrelid='digital_fpos'::regclass) THEN
  ALTER TABLE digital_fpos ADD CONSTRAINT digital_fpos_taluk_parent FOREIGN KEY(taluk_id,district_id) REFERENCES fpo_taluks(id,district_id);
  ALTER TABLE "user" ADD CONSTRAINT user_taluk_parent FOREIGN KEY(taluk_id,district_id) REFERENCES fpo_taluks(id,district_id);
  ALTER TABLE farmer_fpo_assignments ADD CONSTRAINT assignment_taluk_parent FOREIGN KEY(taluk_id,district_id) REFERENCES fpo_taluks(id,district_id);
 END IF;
END $$;
CREATE OR REPLACE FUNCTION can_receive_fpo_message(viewer TEXT, target_group UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
 SELECT EXISTS (
  SELECT 1 FROM farmer_fpo_assignments a JOIN "user" u ON u.id=a.farmer_id
  JOIN farmer_groups g ON g.id=a.group_id JOIN digital_fpos f ON f.id=g.digital_fpo_id
  WHERE a.farmer_id=viewer AND a.group_id=target_group AND a.assignment_status='assigned'
   AND f.status='active' AND u.role='farmer' AND a.district_id=f.district_id AND u.district_id=f.district_id
   AND a.taluk_id IS NOT DISTINCT FROM u.taluk_id
   AND (f.taluk_id IS NULL OR f.taluk_id=u.taluk_id)
 );
$$;
CREATE OR REPLACE FUNCTION check_fpo_membership() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.group_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM farmer_groups g JOIN digital_fpos f ON f.id=g.digital_fpo_id JOIN "user" u ON u.id=NEW.farmer_id
  WHERE g.id=NEW.group_id AND f.district_id=NEW.district_id AND f.status='active'
   AND u.role='farmer' AND u.district_id=NEW.district_id AND u.taluk_id IS NOT DISTINCT FROM NEW.taluk_id
   AND (f.taluk_id IS NULL OR f.taluk_id=u.taluk_id)
 ) THEN RAISE EXCEPTION 'Invalid farmer district/taluk membership'; END IF;
 RETURN NEW;
END $$;
COMMIT;
