-- Fix org name: correct typo and shorten to Piccolo Panini Bar
UPDATE organizations
SET name = 'Piccolo Panini Bar',
    updated_at = now()
WHERE id = '7062ac24-a551-458c-8c94-9d2c396024f9'
  AND name ILIKE '%piccolo%';
