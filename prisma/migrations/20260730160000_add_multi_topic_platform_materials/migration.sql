CREATE TABLE "platform_material_topics" (
  "material_id" UUID NOT NULL,
  "topic_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_material_topics_pkey" PRIMARY KEY ("material_id", "topic_id"),
  CONSTRAINT "platform_material_topics_material_id_fkey"
    FOREIGN KEY ("material_id") REFERENCES "platform_course_materials"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "platform_material_topics_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "platform_course_topics"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "platform_material_topics_topic_id_idx"
ON "platform_material_topics"("topic_id");

INSERT INTO "platform_material_topics" ("material_id", "topic_id")
SELECT "id", "topic_id"
FROM "platform_course_materials"
WHERE "topic_id" IS NOT NULL
ON CONFLICT DO NOTHING;
