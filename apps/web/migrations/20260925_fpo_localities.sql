BEGIN;
CREATE TABLE IF NOT EXISTS fpo_localities (
  district_id BIGINT NOT NULL REFERENCES fpo_districts(id),
  kind TEXT NOT NULL CHECK(kind IN ('subdistrict','village','town')),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL CHECK(length(name_key)>0),
  source TEXT NOT NULL,
  PRIMARY KEY(source,kind,code,district_id,name_key)
);
CREATE INDEX IF NOT EXISTS fpo_locality_lookup ON fpo_localities(name_key,district_id);
COMMIT;
