-- Add inferred state column to insights table
ALTER TABLE insights ADD COLUMN inferred_state TEXT NOT NULL DEFAULT '';
