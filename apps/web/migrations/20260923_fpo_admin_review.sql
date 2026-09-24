BEGIN;
-- Permit a distinct read-only FPO reviewer role. No account is promoted here.
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_role_check;
ALTER TABLE "user" ADD CONSTRAINT user_role_check
  CHECK (role IN ('farmer','buyer','supplier','fpo','admin','superadmin','super_admin'));
LOCK TABLE roles IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO roles(id,name,display_name)
SELECT COALESCE(MAX(id),0)+1,'admin','Admin' FROM roles
HAVING NOT EXISTS (SELECT 1 FROM roles WHERE name='admin');
DO $$
DECLARE seq TEXT;
BEGIN
  seq := pg_get_serial_sequence('roles','id');
  IF seq IS NOT NULL THEN
    PERFORM setval(seq::regclass, (SELECT MAX(id) FROM roles), true);
  END IF;
END $$;
COMMIT;
