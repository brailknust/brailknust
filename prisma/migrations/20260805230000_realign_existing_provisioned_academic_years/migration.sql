-- Correct the academic-year alignment for provisioned semesters where the
-- previous migration's escaped regular expression did not match any rows.
-- Custom and legacy semesters remain untouched.
WITH active_semesters AS (
  SELECT
    users.id AS owner_id,
    active_semester.academic_year AS academic_year,
    CASE active_semester.level
      WHEN 'LEVEL_100' THEN 0
      WHEN 'LEVEL_200' THEN 1
      WHEN 'LEVEL_300' THEN 2
      WHEN 'LEVEL_400' THEN 3
      WHEN 'LEVEL_500' THEN 4
      WHEN 'LEVEL_600' THEN 5
    END AS level_index
  FROM users
  JOIN semesters AS active_semester ON active_semester.id = users.active_semester_id
  WHERE active_semester.academic_year ~ '^[0-9]{4}/[0-9]{4}$'
), provisioned_semesters AS (
  SELECT
    semesters.id,
    semesters.owner_id,
    CASE semesters.level
      WHEN 'LEVEL_100' THEN 0
      WHEN 'LEVEL_200' THEN 1
      WHEN 'LEVEL_300' THEN 2
      WHEN 'LEVEL_400' THEN 3
      WHEN 'LEVEL_500' THEN 4
      WHEN 'LEVEL_600' THEN 5
    END AS level_index
  FROM semesters
  WHERE semesters.curriculum_id IS NOT NULL
    AND semesters.provision_key IS NOT NULL
    AND semesters.is_custom = false
)
UPDATE semesters
SET academic_year =
  ((split_part(active_semesters.academic_year, '/', 1)::integer + provisioned_semesters.level_index - active_semesters.level_index)::text)
  || '/'
  || ((split_part(active_semesters.academic_year, '/', 2)::integer + provisioned_semesters.level_index - active_semesters.level_index)::text)
FROM provisioned_semesters
JOIN active_semesters ON active_semesters.owner_id = provisioned_semesters.owner_id
WHERE semesters.id = provisioned_semesters.id;
