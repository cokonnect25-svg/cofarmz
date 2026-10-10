BEGIN;
CREATE OR REPLACE FUNCTION can_receive_fpo_message(viewer TEXT, target_group UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
 SELECT EXISTS (
  SELECT 1 FROM farmer_fpo_assignments a JOIN "user" u ON u.id=a.farmer_id
  JOIN farmer_groups g ON g.id=a.group_id JOIN digital_fpos f ON f.id=g.digital_fpo_id
  WHERE a.farmer_id=viewer AND a.group_id=target_group AND a.assignment_status='assigned'
   AND f.status='active' AND u.role='farmer' AND a.district_id=f.district_id AND u.district_id=f.district_id
   AND a.taluk_id IS NOT DISTINCT FROM u.taluk_id
   AND (f.taluk_id IS NOT NULL AND f.taluk_id=u.taluk_id)
 );
$$;
CREATE OR REPLACE FUNCTION check_fpo_membership() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.group_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM farmer_groups g JOIN digital_fpos f ON f.id=g.digital_fpo_id JOIN "user" u ON u.id=NEW.farmer_id
  WHERE g.id=NEW.group_id AND f.district_id=NEW.district_id AND f.status='active'
   AND u.role='farmer' AND u.district_id=NEW.district_id AND u.taluk_id IS NOT DISTINCT FROM NEW.taluk_id
   AND (f.taluk_id IS NOT NULL AND f.taluk_id=u.taluk_id)
 ) THEN RAISE EXCEPTION 'Invalid farmer district/taluk membership'; END IF;
 RETURN NEW;
END $$;
UPDATE farmer_fpo_assignments a
SET group_id=NULL, assignment_status='pending_fpo',assigned_at=NULL,
 reason=CASE WHEN a.taluk_id IS NULL THEN 'Select Mandal / Taluk in your profile to join your FPO' ELSE 'Awaiting Mandal / Taluk FPO assignment' END,updated_at=now()
FROM farmer_groups g JOIN digital_fpos f ON f.id=g.digital_fpo_id
WHERE a.group_id=g.id AND f.taluk_id IS NULL;
COMMIT;
