BEGIN;
-- Import reviewed state-wide directories, retaining duplicate names across districts.
CREATE TABLE IF NOT EXISTS fpo_subdistricts (
  district_id BIGINT NOT NULL REFERENCES fpo_districts(id),
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  source TEXT NOT NULL CHECK(length(trim(source)) > 0),
  PRIMARY KEY(district_id,name)
);
COMMIT;
