import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  studentScoreHistories,
  testResults,
  testSubmissionAnswers,
  testSubmissions,
} from "@/db/schema";
import { getStudentSession } from "@/lib/student-auth";

type RouteContext = {
  params: Promise<{
    submissionId: string;
  }>;
};

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

function parseSubmissionId(value: string): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

export async function GET(_req: NextRequest, context: RouteContext) {
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

    const [submissionRow] = await db
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
        createdAt: testSubmissions.createdAt,
      })
      .from(testSubmissions)
      .leftJoin(classes, eq(testSubmissions.classId, classes.id))
      .where(
        and(
          eq(testSubmissions.id, submissionId),
          eq(testSubmissions.classId, session.classId)
        )
      )
      .limit(1);

    if (!submissionRow) {
      return NextResponse.json(
        {
          ok: false,
          error: "submission_not_found",
          message: "指定された提出データが見つかりません。",
        },
        { status: 404 }
      );
    }

    const answerRows = await db
      .select({
        id: testSubmissionAnswers.id,
        questionId: testSubmissionAnswers.questionId,
        page: testSubmissionAnswers.page,
        prompt: testSubmissionAnswers.prompt,
        correctAnswer: testSubmissionAnswers.correctAnswer,
        judgeMode: testSubmissionAnswers.judgeMode,
        mark: testSubmissionAnswers.mark,
        answer: testSubmissionAnswers.answer,
        answeredAt: testSubmissionAnswers.answeredAt,
        points: testSubmissionAnswers.points,
        manualMark: testSubmissionAnswers.manualMark,
        manualScore: testSubmissionAnswers.manualScore,
        teacherComment: testSubmissionAnswers.teacherComment,
        isManuallyGraded: testSubmissionAnswers.isManuallyGraded,
        gradedAt: testSubmissionAnswers.gradedAt,
      })
      .from(testSubmissionAnswers)
      .where(eq(testSubmissionAnswers.submissionId, submissionId))
      .orderBy(
        asc(testSubmissionAnswers.page),
        asc(testSubmissionAnswers.id)
      );

    const [resultRow] = await db
      .select({
        id: testResults.id,
        submissionId: testResults.submissionId,
        studentId: testResults.studentId,
        classId: testResults.classId,
        testId: testResults.testId,
        score: testResults.score,
        total: testResults.total,
        submittedAt: testResults.submittedAt,
      })
      .from(testResults)
      .where(eq(testResults.submissionId, submissionId))
      .limit(1);

    const historyRows = await db
      .select({
        id: studentScoreHistories.id,
        studentId: studentScoreHistories.studentId,
        classIdAtRecord: studentScoreHistories.classIdAtRecord,
        testResultId: studentScoreHistories.testResultId,
        submissionId: studentScoreHistories.submissionId,
        testId: studentScoreHistories.testId,
        testTitle: studentScoreHistories.testTitle,
        score: studentScoreHistories.score,
        total: studentScoreHistories.total,
        submittedAt: studentScoreHistories.submittedAt,
        recordedAt: studentScoreHistories.recordedAt,
        attemptNumber: studentScoreHistories.attemptNumber,
        note: studentScoreHistories.note,
      })
      .from(studentScoreHistories)
      .where(eq(studentScoreHistories.submissionId, submissionId))
      .orderBy(
        desc(studentScoreHistories.recordedAt),
        desc(studentScoreHistories.id)
      );

    return NextResponse.json({
      ok: true,
      submission: {
        id: submissionRow.id,
        bookId: submissionRow.bookId,
        classId: submissionRow.classId ?? null,
        className: submissionRow.className ?? null,
        testId: submissionRow.testId ?? null,
        testTitle: submissionRow.testTitle ?? null,
        studentNumber: submissionRow.studentNumber,
        studentName: submissionRow.studentName,
        submittedAt: toIsoOrNull(submissionRow.submittedAt),
        submitReason: submissionRow.submitReason ?? null,
        submittedPage: submissionRow.submittedPage ?? null,
        timeLimitMinutes: submissionRow.timeLimitMinutes ?? null,
        answerCount: submissionRow.answerCount ?? null,
        createdAt: toIsoOrNull(submissionRow.createdAt),
      },
      answers: answerRows.map((row) => ({
        id: row.id,
        questionId: row.questionId,
        page: row.page ?? null,
        prompt: row.prompt ?? "",
        correctAnswer: row.correctAnswer ?? "",
        judgeMode: row.judgeMode ?? "",
        mark: row.mark ?? "",
        answer: row.answer ?? "",
        answeredAt: toIsoOrNull(row.answeredAt),
        points: row.points,
        manualMark: row.manualMark ?? null,
        manualScore: row.manualScore ?? null,
        teacherComment: row.teacherComment ?? null,
        isManuallyGraded: row.isManuallyGraded,
        gradedAt: toIsoOrNull(row.gradedAt),
      })),
      result: resultRow
        ? {
            id: resultRow.id,
            submissionId: resultRow.submissionId,
            studentId: resultRow.studentId ?? null,
            classId: resultRow.classId ?? null,
            testId: resultRow.testId ?? null,
            score: resultRow.score ?? null,
            total: resultRow.total ?? null,
            submittedAt: toIsoOrNull(resultRow.submittedAt),
          }
        : null,
      histories: historyRows.map((row) => ({
        id: row.id,
        studentId: row.studentId,
        classIdAtRecord: row.classIdAtRecord ?? null,
        testResultId: row.testResultId ?? null,
        submissionId: row.submissionId ?? null,
        testId: row.testId ?? null,
        testTitle: row.testTitle ?? null,
        score: row.score ?? null,
        total: row.total ?? null,
        submittedAt: toIsoOrNull(row.submittedAt),
        recordedAt: toIsoOrNull(row.recordedAt),
        attemptNumber: row.attemptNumber ?? null,
        note: row.note ?? null,
      })),
    });
  } catch (error) {
    console.error("submission detail route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "提出詳細の取得中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}