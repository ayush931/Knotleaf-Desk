CREATE TABLE IF NOT EXISTS knotleaf_rooms (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (char_length(title) <= 200),
  share_path text NOT NULL UNIQUE,
  share_url text,
  state_base64 text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knotleaf_rooms_updated_at_idx ON knotleaf_rooms (updated_at DESC);
ALTER TABLE knotleaf_rooms ADD COLUMN IF NOT EXISTS share_url text;
