INSERT INTO "courses" ("code", "name", "credit_hours", "department", "level")
VALUES ('COE 181', 'Applied Electricity', 3, 'Department of Computer Engineering', 'LEVEL_100')
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "credit_hours" = EXCLUDED."credit_hours",
  "department" = EXCLUDED."department",
  "level" = EXCLUDED."level";

DO $$
DECLARE
  old_course_id UUID;
  new_course_id UUID;
BEGIN
  SELECT "id" INTO old_course_id FROM "courses" WHERE "code" = 'EE 151';
  SELECT "id" INTO new_course_id FROM "courses" WHERE "code" = 'COE 181';

  IF old_course_id IS NULL OR new_course_id IS NULL OR old_course_id = new_course_id THEN
    RETURN;
  END IF;

  DELETE FROM "enrollments" old_enrollment
  USING "users" app_user
  WHERE old_enrollment."user_id" = app_user."id"
    AND app_user."programme" = 'Computer Engineering'
    AND old_enrollment."course_id" = old_course_id
    AND EXISTS (
      SELECT 1
      FROM "enrollments" new_enrollment
      WHERE new_enrollment."user_id" = old_enrollment."user_id"
        AND new_enrollment."semester_id" = old_enrollment."semester_id"
        AND new_enrollment."course_id" = new_course_id
    );

  UPDATE "enrollments" record
  SET "course_id" = new_course_id
  FROM "users" app_user
  WHERE record."user_id" = app_user."id"
    AND app_user."programme" = 'Computer Engineering'
    AND record."course_id" = old_course_id;

  UPDATE "assessments" record SET "course_id" = new_course_id
  FROM "users" app_user
  WHERE record."user_id" = app_user."id" AND app_user."programme" = 'Computer Engineering' AND record."course_id" = old_course_id;

  UPDATE "goals" record SET "course_id" = new_course_id
  FROM "users" app_user
  WHERE record."user_id" = app_user."id" AND app_user."programme" = 'Computer Engineering' AND record."course_id" = old_course_id;

  UPDATE "tasks" record SET "course_id" = new_course_id
  FROM "users" app_user
  WHERE record."user_id" = app_user."id" AND app_user."programme" = 'Computer Engineering' AND record."course_id" = old_course_id;

  UPDATE "timetable_blocks" record SET "course_id" = new_course_id
  FROM "users" app_user
  WHERE record."user_id" = app_user."id" AND app_user."programme" = 'Computer Engineering' AND record."course_id" = old_course_id;

  UPDATE "weak_areas" record SET "course_id" = new_course_id
  FROM "users" app_user
  WHERE record."user_id" = app_user."id" AND app_user."programme" = 'Computer Engineering' AND record."course_id" = old_course_id;

  UPDATE "peer_questions" record SET "course_id" = new_course_id
  FROM "users" app_user
  WHERE record."user_id" = app_user."id" AND app_user."programme" = 'Computer Engineering' AND record."course_id" = old_course_id;

  UPDATE "study_plan_items" record SET "course_id" = new_course_id
  FROM "study_plans" plan, "users" app_user
  WHERE record."study_plan_id" = plan."id"
    AND plan."user_id" = app_user."id"
    AND app_user."programme" = 'Computer Engineering'
    AND record."course_id" = old_course_id;

  UPDATE "study_groups" record SET "course_id" = new_course_id
  FROM "users" app_user
  WHERE record."owner_id" = app_user."id" AND app_user."programme" = 'Computer Engineering' AND record."course_id" = old_course_id;
END $$;