import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  studentScoreHistories,
  students,
  testResults,
  testSubmissionAnswers,
  testSubmissions,
} from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";

type RouteContext = {
  params: Promise<{
    submissionId: string;
  }>;
};

type GradeAnswerInput = {
  answerId: number;
  manualMark?: string | null;
  manualScore?: number | null;
  teacherComment?: string | null;
};

type GradePayload = {
  answers: GradeAnswerInput[];
};

function parseSubmissionId(value: string): number | null {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isValidGradeAnswerInput(value: unknown): value is GradeAnswerInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.answerId === "number" &&
    Number.isInteger(row.answerId) &&
    row.answerId > 0 &&
    (row.manualMark === undefined || isNullableString(row.manualMark)) &&
    (row.manualScore === undefined || isNullableFiniteNumber(row.manualScore)) &&
    (row.teacherComment === undefined || isNullableString(row.teacherComment))
  );
}

function isValidGradePayload(value: unknown): value is GradePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const body = value as Record<string, unknown>;

  return Array.isArray(body.answers) && body.answers.every(isValidGradeAnswerInput);
}

function normalizeMark(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text ? text : null;
}

function normalizeComment(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text ? text : null;
}

function normalizeManualScore(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;

  const score = Math.floor(value);
  return score >= 0 ? score : null;
}

function calcAwardedScore(args: {
  points: number;
  mark: string | null;
  manualScore: number | null;
  isManuallyGraded: boolean;
}): number {
  if (args.isManuallyGraded) {
    return args.manualScore ?? 0;
  }

  return args.mark === "○" ? args.points : 0;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const adminSession = await getAdminSession();

    if (!adminSession) {
      return NextResponse.json(
        {
          ok: false,
          error: "unauthorized",
          message: "管理者ログインが必要です。",
        },
        { status: 401 }
      );
    }

    const params = await context.params;
    const submissionId = parseSubmissionId(params.submissionId);

    if (!submissionId) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_submission_id",
          message: "submissionId が不正です。",
        },
        { status: 400 }
      );
    }

    const body = (await req.json()) as unknown;

    if (!isValidGradePayload(body)) {
      return NextResponse.json(
        {
          ok: false,
          error: "payload_invalid",
          message: "採点データの形式が不正です。",
        },
        { status: 400 }
      );
    }

    if (body.answers.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "answers_required",
          message: "採点対象の回答がありません。",
        },
        { status: 400 }
      );
    }

    const [submission] = await db
      .select({
        id: testSubmissions.id,
        classId: testSubmissions.classId,
        testId: testSubmissions.testId,
        testTitle: testSubmissions.testTitle,
        studentNumber: testSubmissions.studentNumber,
        studentName: testSubmissions.studentName,
        submittedAt: testSubmissions.submittedAt,
      })
      .from(testSubmissions)
      .where(eq(testSubmissions.id, submissionId))
      .limit(1);

    if (!submission) {
      return NextResponse.json(
        {
          ok: false,
          error: "submission_not_found",
          message: "指定された提出データが見つかりません。",
        },
        { status: 404 }
      );
    }

    const existingAnswers = await db
      .select({
        id: testSubmissionAnswers.id,
        submissionId: testSubmissionAnswers.submissionId,
        points: testSubmissionAnswers.points,
        mark: testSubmissionAnswers.mark,
        manualMark: testSubmissionAnswers.manualMark,
        manualScore: testSubmissionAnswers.manualScore,
        teacherComment: testSubmissionAnswers.teacherComment,
        isManuallyGraded: testSubmissionAnswers.isManuallyGraded,
      })
      .from(testSubmissionAnswers)
      .where(eq(testSubmissionAnswers.submissionId, submissionId));

    const answerMap = new Map(existingAnswers.map((row) => [row.id, row]));
    const requestedIds = new Set<number>();

    for (const item of body.answers) {
      requestedIds.add(item.answerId);

      const target = answerMap.get(item.answerId);

      if (!target) {
        return NextResponse.json(
          {
            ok: false,
            error: "answer_not_found",
            message: `answerId=${item.answerId} の回答が見つかりません。`,
          },
          { status: 404 }
        );
      }

      if (target.submissionId !== submissionId) {
        return NextResponse.json(
          {
            ok: false,
            error: "answer_submission_mismatch",
            message: `answerId=${item.answerId} は指定提出に属していません。`,
          },
          { status: 400 }
        );
      }
    }

    const gradedAt = new Date();

    for (const item of body.answers) {
      const manualMark = normalizeMark(item.manualMark);
      const manualScore = normalizeManualScore(item.manualScore);
      const teacherComment = normalizeComment(item.teacherComment);

      await db
        .update(testSubmissionAnswers)
        .set({
          manualMark,
          manualScore,
          teacherComment,
          isManuallyGraded: true,
          gradedAt,
        })
        .where(
          and(
            eq(testSubmissionAnswers.id, item.answerId),
            eq(testSubmissionAnswers.submissionId, submissionId)
          )
        );
    }

    const refreshedAnswers = await db
      .select({
        id: testSubmissionAnswers.id,
        points: testSubmissionAnswers.points,
        mark: testSubmissionAnswers.mark,
        manualMark: testSubmissionAnswers.manualMark,
        manualScore: testSubmissionAnswers.manualScore,
        teacherComment: testSubmissionAnswers.teacherComment,
        isManuallyGraded: testSubmissionAnswers.isManuallyGraded,
      })
      .from(testSubmissionAnswers)
      .where(eq(testSubmissionAnswers.submissionId, submissionId));

    const total = refreshedAnswers.reduce((sum, row) => {
      return sum + (typeof row.points === "number" && Number.isFinite(row.points) ? row.points : 0);
    }, 0);

    const score = refreshedAnswers.reduce((sum, row) => {
      const points =
        typeof row.points === "number" && Number.isFinite(row.points) ? row.points : 0;

      const mark = normalizeMark(row.manualMark) ?? normalizeMark(row.mark);

      return (
        sum +
        calcAwardedScore({
          points,
          mark,
          manualScore: row.manualScore ?? null,
          isManuallyGraded: row.isManuallyGraded,
        })
      );
    }, 0);

    const [matchedStudent] = await db
      .select({
        id: students.id,
      })
      .from(students)
      .where(
        and(
          eq(students.classId, submission.classId ?? 0),
          eq(students.studentNumber, submission.studentNumber),
          eq(students.studentName, submission.studentName)
        )
      )
      .limit(1);

    const [existingResult] = await db
      .select({
        id: testResults.id,
      })
      .from(testResults)
      .where(eq(testResults.submissionId, submissionId))
      .limit(1);

    let testResultId: number | null = null;

    if (existingResult) {
      await db
        .update(testResults)
        .set({
          studentId: matchedStudent?.id ?? null,
          classId: submission.classId ?? null,
          testId: submission.testId,
          score,
          total,
          submittedAt: submission.submittedAt,
        })
        .where(eq(testResults.id, existingResult.id));

      testResultId = existingResult.id;
    } else {
      const [createdResult] = await db
        .insert(testResults)
        .values({
          submissionId,
          studentId: matchedStudent?.id ?? null,
          classId: submission.classId ?? null,
          testId: submission.testId,
          score,
          total,
          submittedAt: submission.submittedAt,
        })
        .returning({
          id: testResults.id,
        });

      testResultId = createdResult?.id ?? null;
    }

    const historyRows = await db
      .select({
        id: studentScoreHistories.id,
      })
      .from(studentScoreHistories)
      .where(eq(studentScoreHistories.submissionId, submissionId));

    if (historyRows.length > 0) {
      for (const history of historyRows) {
        await db
          .update(studentScoreHistories)
          .set({
            studentId: matchedStudent?.id ?? undefined,
            classIdAtRecord: submission.classId ?? null,
            testResultId,
            testId: submission.testId,
            testTitle: submission.testTitle,
            score,
            total,
            submittedAt: submission.submittedAt,
            note: total === 0 ? "採点対象問題なし" : null,
          })
          .where(eq(studentScoreHistories.id, history.id));
      }
    } else if (matchedStudent?.id) {
      await db.insert(studentScoreHistories).values({
        studentId: matchedStudent.id,
        classIdAtRecord: submission.classId ?? null,
        testResultId,
        submissionId,
        testId: submission.testId,
        testTitle: submission.testTitle,
        score,
        total,
        submittedAt: submission.submittedAt,
        attemptNumber: 1,
        note: total === 0 ? "採点対象問題なし" : null,
      });
    }

    return NextResponse.json({
      ok: true,
      submissionId,
      gradedCount: body.answers.length,
      score,
      total,
      testResultId,
      message: "手動採点を保存しました。",
    });
  } catch (error) {
    console.error("admin submission grade route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "手動採点の保存中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}