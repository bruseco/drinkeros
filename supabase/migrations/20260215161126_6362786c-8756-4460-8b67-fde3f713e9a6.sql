
-- Cancel duplicate active sequences (keep the first, cancel the second)
UPDATE upsell_sequences 
SET status = 'cancelled', updated_at = now()
WHERE id IN (
  '700a4928-aa37-4166-947b-fcf9cc72220a',
  'b1493316-437f-49f1-8cd9-dc7c6fb5fe13'
);

-- Now create unique partial index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_upsell_sequences_unique_active
ON upsell_sequences (user_id, product_type, product_id)
WHERE status = 'active';
