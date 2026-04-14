import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  studentScoreHistories,
  testResults,
  testSubmissionAnswers,
  testSubmissions,
} from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";

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
  gradingStatus: "provisional" | "confirmed";
  gradingStatusLabel: "暫定" | "確定";
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

export async function GET(req: NextRequest) {
  try {
    const adminSession = await getAdminSession();

    if (
      !adminSession ||
      (adminSession.role !== "teacher" && adminSession.role !== "admin")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "unauthorized",
          message: "管理者ログインが必要です。",
        },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;

    const classIdParam = searchParams.get("classId");
    const testIdParam = (searchParams.get("testId") ?? "").trim();
    const bookIdParam = (searchParams.get("bookId") ?? "").trim();
    const studentNumberParam = (searchParams.get("studentNumber") ?? "").trim();
    const studentNameParam = (searchParams.get("studentName") ?? "").trim();
    const qParam = (searchParams.get("q") ?? "").trim();
    const ungradedParam = searchParams.get("ungraded") === "1";

    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 50), 200);

    const filters = [];

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

      filters.push(eq(testSubmissions.classId, classId));
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

    if (studentNameParam) {
      filters.push(ilike(testSubmissions.studentName, `%${studentNameParam}%`));
    }

    if (qParam) {
      filters.push(
        sql`(
          ${testSubmissions.studentNumber} ILIKE ${`%${qParam}%`}
          OR ${testSubmissions.studentName} ILIKE ${`%${qParam}%`}
          OR ${testSubmissions.testTitle} ILIKE ${`%${qParam}%`}
          OR ${testSubmissions.testId} ILIKE ${`%${qParam}%`}
          OR ${testSubmissions.bookId} ILIKE ${`%${qParam}%`}
        )`
      );
    }

    if (ungradedParam) {
      filters.push(
        or(
          isNull(testResults.id),
          eq(testSubmissionAnswers.isManuallyGraded, false)
        )
      );
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
      .leftJoin(
        testSubmissionAnswers,
        eq(testSubmissionAnswers.submissionId, testSubmissions.id)
      )
      .where(filters.length > 0 ? and(...filters) : undefined)
      .groupBy(
        testSubmissions.id,
        testSubmissions.bookId,
        testSubmissions.classId,
        classes.name,
        testSubmissions.testId,
        testSubmissions.testTitle,
        testSubmissions.studentNumber,
        testSubmissions.studentName,
        testSubmissions.submittedAt,
        testSubmissions.submitReason,
        testSubmissions.submittedPage,
        testSubmissions.timeLimitMinutes,
        testSubmissions.answerCount,
        testResults.id,
        testResults.score,
        testResults.total,
        testSubmissions.createdAt
      )
      .orderBy(
        desc(
          sql`coalesce(${testSubmissions.submittedAt}, ${testSubmissions.createdAt})`
        ),
        desc(testSubmissions.id)
      )
      .limit(limit);

    const histories = await db
      .select({
        submissionId: studentScoreHistories.submissionId,
        note: studentScoreHistories.note,
      })
      .from(studentScoreHistories)
      .where(
        rows.length > 0
          ? sql`${studentScoreHistories.submissionId} in (${sql.join(
              rows.map((row) => sql`${row.id}`),
              sql`, `
            )})`
          : sql`false`
      );

    const historyNoteMap = new Map<number, string | null>();
    for (const row of histories) {
      if (typeof row.submissionId === "number") {
        historyNoteMap.set(row.submissionId, row.note ?? null);
      }
    }

    const submissions: SubmissionListItem[] = rows.map((row) => {
      const note = historyNoteMap.get(row.id) ?? null;
      const isProvisional = (note ?? "").trim() === "提出時自動集計";

      return {
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
        gradingStatus: isProvisional ? "provisional" : "confirmed",
        gradingStatusLabel: isProvisional ? "暫定" : "確定",
      };
    });

    return NextResponse.json({
      ok: true,
      submissions,
      count: submissions.length,
    });
  } catch (error) {
    console.error("admin submissions route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "管理画面用の提出一覧取得中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}