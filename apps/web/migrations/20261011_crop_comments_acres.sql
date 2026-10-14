BEGIN;
ALTER TABLE crops ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE crops ADD COLUMN IF NOT EXISTS cultivated_acres NUMERIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='crops'::regclass AND conname='crops_cultivated_acres_positive') THEN
    ALTER TABLE crops ADD CONSTRAINT crops_cultivated_acres_positive
      CHECK (cultivated_acres IS NULL OR (cultivated_acres > 0 AND cultivated_acres < 'Infinity'::numeric));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='crops'::regclass AND conname='crops_comment_length') THEN
    ALTER TABLE crops ADD CONSTRAINT crops_comment_length CHECK (comment IS NULL OR char_length(comment) <= 2000);
  END IF;
END $$;
COMMIT;
