-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('ACTIVE', 'DROPPED');

-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('PUBLISHED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('ASSIGNMENT', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "activity_status" AS ENUM ('PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('SUBMITTED', 'GRADED');

-- CreateEnum
CREATE TYPE "timeliness" AS ENUM ('ON_TIME', 'LATE');

-- CreateEnum
CREATE TYPE "attendance_value" AS ENUM ('PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "audit_object" AS ENUM ('GRADE', 'PASSING_GRADE', 'ENROLLMENT', 'USER', 'ATTENDANCE');

-- CreateTable
CREATE TABLE "enrollments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "term_id" INTEGER NOT NULL,
    "status" "enrollment_status" NOT NULL,
    "enrolled_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_status_changes" (
    "id" SERIAL NOT NULL,
    "enrollment_id" INTEGER NOT NULL,
    "status" "enrollment_status" NOT NULL,
    "changed_at" TIMESTAMPTZ NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" SERIAL NOT NULL,
    "classroom_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ NOT NULL,
    "status" "content_status" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "classroom_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ NOT NULL,
    "status" "content_status" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" SERIAL NOT NULL,
    "classroom_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "type" "activity_type" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "activity_status" NOT NULL DEFAULT 'PUBLISHED',
    "due_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" SERIAL NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL,
    "timeliness" "timeliness" NOT NULL,
    "status" "submission_status" NOT NULL DEFAULT 'SUBMITTED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "id" SERIAL NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "observation" TEXT,
    "teacher_id" INTEGER NOT NULL,
    "graded_at" TIMESTAMPTZ NOT NULL,
    "without_submission" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" SERIAL NOT NULL,
    "material_id" INTEGER,
    "activity_id" INTEGER,
    "submission_id" INTEGER,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "recorded_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" SERIAL NOT NULL,
    "class_session_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "enrollment_id" INTEGER NOT NULL,
    "value" "attendance_value" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "object_type" "audit_object" NOT NULL,
    "object_id" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_user_id_section_id_key" ON "enrollments"("user_id", "section_id");

-- CreateIndex
CREATE INDEX "enrollments_user_id_subject_id_term_id_idx" ON "enrollments"("user_id", "subject_id", "term_id");

-- CreateIndex
CREATE INDEX "enrollment_status_changes_enrollment_id_changed_at_idx" ON "enrollment_status_changes"("enrollment_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_activity_id_user_id_key" ON "submissions"("activity_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "grades_activity_id_user_id_key" ON "grades"("activity_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_submission_id_key" ON "attachments"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_section_id_date_key" ON "class_sessions"("section_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_class_session_id_user_id_key" ON "attendance_records"("class_session_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_object_type_object_id_idx" ON "audit_logs"("object_type", "object_id");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_status_changes" ADD CONSTRAINT "enrollment_status_changes_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_status_changes" ADD CONSTRAINT "enrollment_status_changes_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- SQL escrito a mano. NO SE BORRA (regla 6 de CLAUDE.md).
-- Prisma no puede declarar el índice parcial, el dueño único del archivo
-- ni la fecha límite según el tipo de actividad.
-- ============================================================================

-- Una sola inscripción activa por alumno, materia y período.
CREATE UNIQUE INDEX "enrollments_one_active_per_subject_term"
  ON "enrollments" ("user_id", "subject_id", "term_id")
  WHERE "status" = 'ACTIVE';

-- Un archivo pertenece a exactamente un dueño.
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_one_owner" CHECK (
  (CASE WHEN "material_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "activity_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "submission_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
);

-- El trabajo práctico tiene fecha límite. La evaluación no.
ALTER TABLE "activities" ADD CONSTRAINT "activities_due_matches_type" CHECK (
  ("type" = 'ASSIGNMENT' AND "due_at" IS NOT NULL)
  OR ("type" = 'ASSESSMENT' AND "due_at" IS NULL)
);

-- Una sola fila de configuración.
ALTER TABLE "settings" ADD CONSTRAINT "settings_single_row" CHECK ("id" = 1);
