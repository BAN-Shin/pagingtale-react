import { NextRequest, NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
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

function parseSubmissionId(value: string): number | null {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

export async function GET(_req: NextRequest, context: RouteContext) {
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

    const [submission] = await db
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

    const answersRows = await db
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

    let matchedStudentId: number | null = null;

    const [matchedStudent] = await db
      .select({
        id: students.id,
      })
      .from(students)
      .where(eq(students.studentNumber, submission.studentNumber))
      .limit(1);

    if (matchedStudent?.id) {
      matchedStudentId = matchedStudent.id;
    }

    const historiesRows =
      matchedStudentId != null
        ? await db
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
            .where(eq(studentScoreHistories.studentId, matchedStudentId))
            .orderBy(
              desc(studentScoreHistories.submittedAt),
              desc(studentScoreHistories.id)
            )
        : [];

    return NextResponse.json({
      ok: true,
      submission: {
        id: submission.id,
        bookId: submission.bookId,
        classId: submission.classId ?? null,
        className: submission.className ?? null,
        testId: submission.testId ?? null,
        testTitle: submission.testTitle ?? null,
        studentNumber: submission.studentNumber,
        studentName: submission.studentName,
        submittedAt: toIsoOrNull(submission.submittedAt),
        submitReason: submission.submitReason ?? null,
        submittedPage: submission.submittedPage ?? null,
        timeLimitMinutes: submission.timeLimitMinutes ?? null,
        answerCount: submission.answerCount ?? null,
        createdAt: toIsoOrNull(submission.createdAt),
      },
      answers: answersRows.map((row) => ({
        id: row.id,
        questionId: row.questionId,
        page: row.page ?? null,
        prompt: row.prompt ?? "",
        correctAnswer: row.correctAnswer ?? "",
        judgeMode: row.judgeMode ?? "",
        mark: row.mark ?? "",
        answer: row.answer ?? "",
        answeredAt: toIsoOrNull(row.answeredAt),
        points: row.points ?? 0,
        manualMark: row.manualMark ?? null,
        manualScore: row.manualScore ?? null,
        teacherComment: row.teacherComment ?? null,
        isManuallyGraded: Boolean(row.isManuallyGraded),
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
      histories: historiesRows.map((row) => ({
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
    console.error("admin submission detail route error:", error);

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