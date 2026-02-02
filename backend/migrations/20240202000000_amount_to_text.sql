-- Change amounts to TEXT to support BigInt/u64 precision
ALTER TABLE campaigns ALTER COLUMN total_amount TYPE TEXT USING total_amount::text;
ALTER TABLE recipients ALTER COLUMN amount TYPE TEXT USING amount::text;
