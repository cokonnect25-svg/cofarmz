BEGIN;
CREATE TABLE IF NOT EXISTS fpo_districts (
  id BIGSERIAL PRIMARY KEY,
  state TEXT NOT NULL CHECK (length(trim(state)) > 0),
  district TEXT NOT NULL CHECK (length(trim(district)) > 0),
  source TEXT NOT NULL,
  UNIQUE(state, district)
);
CREATE UNIQUE INDEX IF NOT EXISTS fpo_districts_normalized ON fpo_districts(lower(regexp_replace(state,'[^a-zA-Z0-9]','','g')),lower(regexp_replace(district,'[^a-zA-Z0-9]','','g')));
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS district_id BIGINT REFERENCES fpo_districts(id);
CREATE INDEX IF NOT EXISTS user_fpo_district ON "user"(district_id) WHERE role='farmer';
CREATE TABLE IF NOT EXISTS digital_fpos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id BIGINT NOT NULL UNIQUE REFERENCES fpo_districts(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS farmer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digital_fpo_id UUID NOT NULL UNIQUE REFERENCES digital_fpos(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- This is also the group-membership table. One farmer can have only one membership.
CREATE TABLE IF NOT EXISTS farmer_fpo_assignments (
  farmer_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  district_id BIGINT REFERENCES fpo_districts(id),
  group_id UUID REFERENCES farmer_groups(id) ON DELETE RESTRICT,
  assignment_status TEXT NOT NULL CHECK(assignment_status IN ('assigned','pending_location','pending_fpo','inactive_fpo','not_farmer')),
  assignment_source TEXT NOT NULL CHECK(assignment_source IN ('registration','latitude_longitude','address','profile_update','admin_manual')),
  reason TEXT,
  assigned_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((assignment_status='assigned') = (group_id IS NOT NULL)),
  CHECK (group_id IS NULL OR district_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS fpo_assignment_group ON farmer_fpo_assignments(group_id) WHERE assignment_status='assigned';
CREATE INDEX IF NOT EXISTS fpo_assignment_pending ON farmer_fpo_assignments(assignment_status,farmer_id);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES farmer_groups(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS announcements_group ON announcements(group_id,created_at DESC);
CREATE TABLE IF NOT EXISTS fpo_message_reads (
  farmer_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(farmer_id,announcement_id)
);
-- Central DB access predicate: discovery never creates membership.
CREATE OR REPLACE FUNCTION can_receive_fpo_message(viewer TEXT, target_group UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
 SELECT EXISTS (
   SELECT 1 FROM farmer_fpo_assignments a
   JOIN "user" u ON u.id=a.farmer_id
   JOIN farmer_groups g ON g.id=a.group_id
   JOIN digital_fpos f ON f.id=g.digital_fpo_id
   WHERE a.farmer_id=viewer AND a.group_id=target_group
     AND a.assignment_status='assigned' AND f.status='active'
     AND a.district_id=f.district_id AND u.district_id=f.district_id
     AND u.role='farmer'
 );
$$;
CREATE OR REPLACE FUNCTION check_fpo_membership() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.group_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM farmer_groups g JOIN digital_fpos f ON f.id=g.digital_fpo_id
   JOIN "user" u ON u.id=NEW.farmer_id
   WHERE g.id=NEW.group_id AND f.district_id=NEW.district_id
     AND f.status='active' AND u.role='farmer' AND u.district_id=NEW.district_id
 ) THEN RAISE EXCEPTION 'Invalid farmer district membership'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS check_fpo_membership ON farmer_fpo_assignments;
CREATE TRIGGER check_fpo_membership BEFORE INSERT OR UPDATE ON farmer_fpo_assignments
FOR EACH ROW EXECUTE FUNCTION check_fpo_membership();
COMMIT;
