import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
});

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  classId: integer("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  studentNumber: text("student_number").notNull(),
  studentName: text("student_name").notNull(),
  passwordHash: text("password_hash").notNull().default(""),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const teachers = pgTable("teachers", {
  id: serial("id").primaryKey(),

  loginId: text("login_id").notNull(),
  teacherName: text("teacher_name").notNull(),
  passwordHash: text("password_hash").notNull().default(""),

  role: text("role").notNull().default("teacher"),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
});

export const books = pgTable("books", {
  id: serial("id").primaryKey(),

  bookId: text("book_id").notNull().unique(),
  title: text("title").notNull(),

  ownerTeacherId: integer("owner_teacher_id")
    .notNull()
    .references(() => teachers.id, { onDelete: "restrict" }),

  mode: text("mode", { enum: ["practice", "test"] })
    .notNull()
    .default("practice"),

  isPublished: boolean("is_published").notNull().default(true),

  pageCount: integer("page_count").notNull().default(0),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),

  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const testSubmissions = pgTable("test_submissions", {
  id: serial("id").primaryKey(),
  bookId: text("book_id").notNull(),
  classId: integer("class_id").references(() => classes.id, {
    onDelete: "set null",
  }),
  testId: text("test_id"),
  testTitle: text("test_title"),
  studentNumber: text("student_number").notNull(),
  studentName: text("student_name").notNull(),
  submittedAt: timestamp("submitted_at", { mode: "date" }).notNull(),
  submitReason: text("submit_reason"),
  submittedPage: integer("submitted_page"),
  timeLimitMinutes: integer("time_limit_minutes"),
  answerCount: integer("answer_count"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const testSubmissionAnswers = pgTable("test_submission_answers", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id")
    .notNull()
    .references(() => testSubmissions.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull(),
  page: integer("page"),
  prompt: text("prompt"),
  correctAnswer: text("correct_answer"),
  judgeMode: text("judge_mode"),
  mark: text("mark"),
  answer: text("answer"),
  answeredAt: timestamp("answered_at", { mode: "date" }),

  points: integer("points").notNull().default(0),

  manualMark: text("manual_mark"),
  manualScore: integer("manual_score"),
  teacherComment: text("teacher_comment"),
  isManuallyGraded: boolean("is_manually_graded").notNull().default(false),
  gradedAt: timestamp("graded_at", { mode: "date" }),
});

export const testAssignments = pgTable("test_assignments", {
  id: serial("id").primaryKey(),
  classId: integer("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  testId: text("test_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  assignedAt: timestamp("assigned_at", { mode: "date" }).defaultNow(),
});

export const testResults = pgTable("test_results", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id")
    .notNull()
    .references(() => testSubmissions.id, { onDelete: "cascade" }),
  studentId: integer("student_id").references(() => students.id, {
    onDelete: "set null",
  }),
  classId: integer("class_id").references(() => classes.id, {
    onDelete: "set null",
  }),
  testId: text("test_id"),
  score: integer("score"),
  total: integer("total"),
  submittedAt: timestamp("submitted_at", { mode: "date" }),
});

export const studentScoreHistories = pgTable("student_score_histories", {
  id: serial("id").primaryKey(),

  studentId: integer("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),

  classIdAtRecord: integer("class_id_at_record").references(() => classes.id, {
    onDelete: "set null",
  }),

  testResultId: integer("test_result_id").references(() => testResults.id, {
    onDelete: "set null",
  }),

  submissionId: integer("submission_id").references(() => testSubmissions.id, {
    onDelete: "set null",
  }),

  testId: text("test_id"),
  testTitle: text("test_title"),

  score: integer("score"),
  total: integer("total"),

  submittedAt: timestamp("submitted_at", { mode: "date" }),
  recordedAt: timestamp("recorded_at", { mode: "date" })
    .defaultNow()
    .notNull(),

  attemptNumber: integer("attempt_number"),
  note: text("note"),
});