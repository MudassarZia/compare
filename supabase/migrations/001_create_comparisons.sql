-- Comparisons cache table
CREATE TABLE IF NOT EXISTS comparisons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_identifier TEXT UNIQUE NOT NULL,
  comparison_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups by product identifier
CREATE INDEX IF NOT EXISTS idx_comparisons_product_identifier ON comparisons (product_identifier);

-- Index for TTL cleanup
CREATE INDEX IF NOT EXISTS idx_comparisons_expires_at ON comparisons (expires_at);

-- Enable RLS
ALTER TABLE comparisons ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read
CREATE POLICY "Allow anonymous read" ON comparisons
  FOR SELECT USING (true);

-- Allow anonymous insert
CREATE POLICY "Allow anonymous insert" ON comparisons
  FOR INSERT WITH CHECK (true);

-- Allow anonymous update (for upsert)
CREATE POLICY "Allow anonymous update" ON comparisons
  FOR UPDATE USING (true);
