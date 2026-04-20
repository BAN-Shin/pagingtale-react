CREATE TABLE "books" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"title" text NOT NULL,
	"owner_teacher_id" integer NOT NULL,
	"mode" text DEFAULT 'practice' NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "books_book_id_unique" UNIQUE("book_id")
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "student_score_histories" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"class_id_at_record" integer,
	"test_result_id" integer,
	"submission_id" integer,
	"test_id" text,
	"test_title" text,
	"score" integer,
	"total" integer,
	"submitted_at" timestamp,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"attempt_number" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"student_number" text NOT NULL,
	"student_name" text NOT NULL,
	"password_hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" serial PRIMARY KEY NOT NULL,
	"login_id" text NOT NULL,
	"teacher_name" text NOT NULL,
	"password_hash" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'teacher' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "test_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"test_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "test_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"student_id" integer,
	"class_id" integer,
	"test_id" text,
	"score" integer,
	"total" integer,
	"submitted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "test_submission_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"question_id" text NOT NULL,
	"page" integer,
	"prompt" text,
	"correct_answer" text,
	"judge_mode" text,
	"mark" text,
	"answer" text,
	"answered_at" timestamp,
	"points" integer DEFAULT 0 NOT NULL,
	"manual_mark" text,
	"manual_score" integer,
	"teacher_comment" text,
	"is_manually_graded" boolean DEFAULT false NOT NULL,
	"graded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "test_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"class_id" integer,
	"test_id" text,
	"test_title" text,
	"student_number" text NOT NULL,
	"student_name" text NOT NULL,
	"submitted_at" timestamp NOT NULL,
	"submit_reason" text,
	"submitted_page" integer,
	"time_limit_minutes" integer,
	"answer_count" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_owner_teacher_id_teachers_id_fk" FOREIGN KEY ("owner_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_score_histories" ADD CONSTRAINT "student_score_histories_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_score_histories" ADD CONSTRAINT "student_score_histories_class_id_at_record_classes_id_fk" FOREIGN KEY ("class_id_at_record") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_score_histories" ADD CONSTRAINT "student_score_histories_test_result_id_test_results_id_fk" FOREIGN KEY ("test_result_id") REFERENCES "public"."test_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_score_histories" ADD CONSTRAINT "student_score_histories_submission_id_test_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."test_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_assignments" ADD CONSTRAINT "test_assignments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_submission_id_test_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."test_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_submission_answers" ADD CONSTRAINT "test_submission_answers_submission_id_test_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."test_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_submissions" ADD CONSTRAINT "test_submissions_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;