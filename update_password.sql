-- Update password for solomonidrissu@gmail.com to 'sharable2025'
-- Run this in Supabase Dashboard -> SQL Editor

UPDATE auth.users
SET encrypted_password = crypt('sharable2025', gen_salt('bf')),
    updated_at = NOW()
WHERE email = 'solomonidrissu@gmail.com';

-- Verify the update
SELECT id, email, created_at, updated_at
FROM auth.users
WHERE email = 'solomonidrissu@gmail.com';
