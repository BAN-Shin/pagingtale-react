import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  studentScoreHistories,
  students,
  testResults,
  testSubmissionAnswers,
  testSubmissions,
} from "@/db/schema";
import { getStudentSession } from "@/lib/student-auth";

type SubmissionListItem = {
  id: number;
  bookId: string;
  classId: number | null;
  className: string | null;
  testId: string | null;
  testTitle: string | null;
  studentNumber: string;
  studentName: string;
  submittedAt: string | null;
  submitReason: string | null;
  submittedPage: number | null;
  timeLimitMinutes: number | null;
  answerCount: number | null;
  score: number | null;
  total: number | null;
  createdAt: string | null;
};

type SubmitAnswerRow = {
  questionId?: string;
  page?: number;
  prompt?: string;
  correctAnswer?: string;
  judgeMode?: string;
  mark?: "○" | "×" | "□";
  value?: string;
  answeredAt?: string | null;
  points?: number;
};

type SubmitPayload = {
  bookId?: string;
  testId?: string | null;
  testTitle?: string | null;
  submittedAt?: string;
  submittedPage?: number;
  submitReason?: string;
  timeLimitMinutes?: number | null;
  student?: {
    classId?: number;
    studentNumber?: string;
    studentName?: string;
  };
  answers?: SubmitAnswerRow[];
};

function parsePositiveInt(value: string | null, fallback: number): number {
  const num = Number(value ?? "");
  if (!Number.isFinite(num)) return fallback;
  const safe = Math.floor(num);
  if (safe <= 0) return fallback;
  return safe;
}

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

function parseOptionalDate(value?: string | null): Date | null {
  if (!value || !value.trim()) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function normalizeMark(value: string | null | undefined): "○" | "×" | "□" {
  return value === "○" || value === "×" || value === "□" ? value : "□";
}

export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession();

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: "unauthorized",
          message: "ログインが必要です。",
        },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;

    const classIdParam = searchParams.get("classId");
    const testIdParam = (searchParams.get("testId") ?? "").trim();
    const bookIdParam = (searchParams.get("bookId") ?? "").trim();
    const studentNumberParam = (searchParams.get("studentNumber") ?? "").trim();
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 100), 200);

    const filters = [eq(testSubmissions.classId, session.classId)];

    if (classIdParam) {
      const classId = Number(classIdParam);
      if (!Number.isInteger(classId) || classId <= 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "invalid_class_id",
            message: "classId が不正です。",
          },
          { status: 400 }
        );
      }

      if (classId !== session.classId) {
        return NextResponse.json(
          {
            ok: false,
            error: "forbidden_class_scope",
            message: "ログイン中の受験者と異なるクラスの提出一覧は取得できません。",
          },
          { status: 403 }
        );
      }
    }

    if (testIdParam) {
      filters.push(eq(testSubmissions.testId, testIdParam));
    }

    if (bookIdParam) {
      filters.push(eq(testSubmissions.bookId, bookIdParam));
    }

    if (studentNumberParam) {
      filters.push(eq(testSubmissions.studentNumber, studentNumberParam));
    }

    const rows = await db
      .select({
        id: testSubmissions.id,
        bookId: testSubmissions.bookId,
        classId: testSubmissions.classId,
        className: classes.name,
        testId: testSubmissions.testId,
        testTitle: testSubmissions.testTitle,
        studentNumber: testSubmissions.studentNumber,
        studentName: testSubmissions.studentName,
        submittedAt: testSubmissions.submittedAt,
        submitReason: testSubmissions.submitReason,
        submittedPage: testSubmissions.submittedPage,
        timeLimitMinutes: testSubmissions.timeLimitMinutes,
        answerCount: testSubmissions.answerCount,
        score: testResults.score,
        total: testResults.total,
        createdAt: testSubmissions.createdAt,
      })
      .from(testSubmissions)
      .leftJoin(classes, eq(testSubmissions.classId, classes.id))
      .leftJoin(testResults, eq(testResults.submissionId, testSubmissions.id))
      .where(and(...filters))
      .orderBy(
        desc(sql`coalesce(${testSubmissions.submittedAt}, ${testSubmissions.createdAt})`),
        desc(testSubmissions.id)
      )
      .limit(limit);

    const submissions: SubmissionListItem[] = rows.map((row) => ({
      id: row.id,
      bookId: row.bookId,
      classId: row.classId ?? null,
      className: row.className ?? null,
      testId: row.testId ?? null,
      testTitle: row.testTitle ?? null,
      studentNumber: row.studentNumber,
      studentName: row.studentName,
      submittedAt: toIsoOrNull(row.submittedAt),
      submitReason: row.submitReason ?? null,
      submittedPage: row.submittedPage ?? null,
      timeLimitMinutes: row.timeLimitMinutes ?? null,
      answerCount: row.answerCount ?? null,
      score: row.score ?? null,
      total: row.total ?? null,
      createdAt: toIsoOrNull(row.createdAt),
    }));

    return NextResponse.json({
      ok: true,
      submissions,
      count: submissions.length,
    });
  } catch (error) {
    console.error("submissions route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "提出一覧の取得中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSession();

    if (!session) {
      return NextResponse.json(
        {
          ok: false,
          error: "unauthorized",
          message: "ログインが必要です。",
        },
        { status: 401 }
      );
    }

    const body = (await req.json()) as SubmitPayload;

    const bookId = String(body.bookId ?? "").trim();
    const testId = String(body.testId ?? "").trim() || null;
    const testTitle = String(body.testTitle ?? "").trim() || null;
    const submittedAt = parseOptionalDate(body.submittedAt);
    const submittedPage = Number(body.submittedPage ?? 0);
    const submitReason = String(body.submitReason ?? "").trim() || "manual";
    const timeLimitMinutesRaw = body.timeLimitMinutes;
    const answers = Array.isArray(body.answers) ? body.answers : [];

    const payloadClassId = Number(body.student?.classId ?? 0);
    const payloadStudentNumber = String(body.student?.studentNumber ?? "").trim();
    const payloadStudentName = String(body.student?.studentName ?? "").trim();

    if (!bookId) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_book_id",
          message: "bookId が不足しています。",
        },
        { status: 400 }
      );
    }

    if (!submittedAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_submitted_at",
          message: "submittedAt が不正です。",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(submittedPage) || submittedPage <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_submitted_page",
          message: "submittedPage が不正です。",
        },
        { status: 400 }
      );
    }

    if (payloadClassId !== session.classId) {
      return NextResponse.json(
        {
          ok: false,
          error: "class_mismatch",
          message: "ログイン中のクラス情報と提出内容が一致しません。",
        },
        { status: 403 }
      );
    }

    if (
      payloadStudentNumber !== session.studentNumber ||
      payloadStudentName !== session.studentName
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "student_mismatch",
          message: "ログイン中の受験者情報と提出内容が一致しません。",
        },
        { status: 403 }
      );
    }

    const timeLimitMinutes =
      typeof timeLimitMinutesRaw === "number" &&
      Number.isFinite(timeLimitMinutesRaw) &&
      timeLimitMinutesRaw > 0
        ? Math.floor(timeLimitMinutesRaw)
        : null;

    const [createdSubmission] = await db
      .insert(testSubmissions)
      .values({
        bookId,
        classId: session.classId,
        testId,
        testTitle,
        studentNumber: session.studentNumber,
        studentName: session.studentName,
        submittedAt,
        submitReason,
        submittedPage,
        timeLimitMinutes,
        answerCount: answers.length,
      })
      .returning({
        id: testSubmissions.id,
      });

    if (!createdSubmission) {
      return NextResponse.json(
        {
          ok: false,
          error: "submission_insert_failed",
          message: "提出ヘッダの保存に失敗しました。",
        },
        { status: 500 }
      );
    }

    let total = 0;
    let score = 0;

    if (answers.length > 0) {
      const answerRows = answers
        .map((answer) => {
          const questionId = String(answer.questionId ?? "").trim();
          if (!questionId) return null;

          const page =
            typeof answer.page === "number" && Number.isFinite(answer.page)
              ? Math.floor(answer.page)
              : null;

          const points =
            typeof answer.points === "number" && Number.isFinite(answer.points)
              ? Math.floor(answer.points)
              : 0;

          const mark = normalizeMark(answer.mark);

          total += points;
          if (mark === "○") {
            score += points;
          }

          return {
            submissionId: createdSubmission.id,
            questionId,
            page,
            prompt: String(answer.prompt ?? ""),
            correctAnswer: String(answer.correctAnswer ?? ""),
            judgeMode: String(answer.judgeMode ?? "") || null,
            mark,
            answer: String(answer.value ?? ""),
            answeredAt: parseOptionalDate(answer.answeredAt ?? null),
            points,
            isManuallyGraded: false,
          };
        })
        .filter(
          (
            row
          ): row is {
            submissionId: number;
            questionId: string;
            page: number | null;
            prompt: string;
            correctAnswer: string;
            judgeMode: string | null;
            mark: "○" | "×" | "□";
            answer: string;
            answeredAt: Date | null;
            points: number;
            isManuallyGraded: boolean;
          } => row !== null
        );

      if (answerRows.length > 0) {
        await db.insert(testSubmissionAnswers).values(answerRows);
      }
    }

    const [matchedStudent] = await db
      .select({
        id: students.id,
      })
      .from(students)
      .where(
        and(
          eq(students.classId, session.classId),
          eq(students.studentNumber, session.studentNumber),
          eq(students.studentName, session.studentName)
        )
      )
      .limit(1);

    let testResultId: number | null = null;

    if (matchedStudent?.id) {
      const [createdResult] = await db
        .insert(testResults)
        .values({
          submissionId: createdSubmission.id,
          studentId: matchedStudent.id,
          classId: session.classId,
          testId,
          score,
          total,
          submittedAt,
        })
        .returning({
          id: testResults.id,
        });

      testResultId = createdResult?.id ?? null;

      const historyFilters = [eq(studentScoreHistories.studentId, matchedStudent.id)];

      if (testId) {
        historyFilters.push(eq(studentScoreHistories.testId, testId));
      } else if (testTitle) {
        historyFilters.push(eq(studentScoreHistories.testTitle, testTitle));
      }

      const [latestHistory] = await db
        .select({
          attemptNumber: studentScoreHistories.attemptNumber,
        })
        .from(studentScoreHistories)
        .where(and(...historyFilters))
        .orderBy(
          desc(studentScoreHistories.attemptNumber),
          desc(studentScoreHistories.id)
        )
        .limit(1);

      const nextAttemptNumber =
        typeof latestHistory?.attemptNumber === "number" &&
        Number.isFinite(latestHistory.attemptNumber) &&
        latestHistory.attemptNumber > 0
          ? latestHistory.attemptNumber + 1
          : 1;

      await db.insert(studentScoreHistories).values({
        studentId: matchedStudent.id,
        classIdAtRecord: session.classId,
        testResultId,
        submissionId: createdSubmission.id,
        testId,
        testTitle,
        score,
        total,
        submittedAt,
        attemptNumber: nextAttemptNumber,
        note: total === 0 ? "採点対象問題なし" : "提出時自動集計",
      });
    }

    return NextResponse.json({
      ok: true,
      submissionId: createdSubmission.id,
      testResultId,
      score,
      total,
      message: "提出を保存しました。",
    });
  } catch (error) {
    console.error("submission POST route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "提出保存中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}