
-- Add cpf to profiles
ALTER TABLE profiles ADD COLUMN cpf text UNIQUE;

-- Add workload_hours to packages, courses, combos
ALTER TABLE packages ADD COLUMN workload_hours integer DEFAULT 0;
ALTER TABLE courses ADD COLUMN workload_hours integer DEFAULT 0;
ALTER TABLE combos ADD COLUMN workload_hours integer DEFAULT 0;

-- Add student_cpf to certificates
ALTER TABLE certificates ADD COLUMN student_cpf text;

-- Add public SELECT policy on certificates for validation page
CREATE POLICY "Anyone can validate certificates by code"
ON certificates FOR SELECT
USING (true);
