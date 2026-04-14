import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  studentScoreHistories,
  testResults,
  testSubmissionAnswers,
  testSubmissions,
} from "@/db/schema";

type UpdateManualGradeBody = {
  manualMark?: string | null;
  manualScore?: number | null;
  teacherComment?: string | null;
};

function normalizeManualMark(value: unknown): "○" | "△" | "×" | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "○" || trimmed === "△" || trimmed === "×") {
    return trimmed;
  }

  return null;
}

function normalizeManualScore(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value < 0) {
    return null;
  }

  return Math.floor(value);
}

function normalizeTeacherComment(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getAutoEarnedScore(mark: string | null, points: number | null): number {
  if (mark === "○" && typeof points === "number" && Number.isFinite(points)) {
    return points;
  }
  return 0;
}

function getManualEarnedScore(params: {
  manualScore: number | null;
  manualMark: string | null;
  points: number | null;
}): number {
  if (typeof params.manualScore === "number" && Number.isFinite(params.manualScore)) {
    return params.manualScore;
  }

  if (
    params.manualMark === "○" &&
    typeof params.points === "number" &&
    Number.isFinite(params.points)
  ) {
    return params.points;
  }

  if (
    params.manualMark === "△" &&
    typeof params.points === "number" &&
    Number.isFinite(params.points)
  ) {
    return Math.floor(params.points / 2);
  }

  return 0;
}

async function recalculateSubmissionScore(submissionId: number) {
  const [submission] = await db
    .select({
      id: testSubmissions.id,
      classId: testSubmissions.classId,
      testId: testSubmissions.testId,
      submittedAt: testSubmissions.submittedAt,
    })
    .from(testSubmissions)
    .where(eq(testSubmissions.id, submissionId))
    .limit(1);

  if (!submission) {
    throw new Error("提出データが見つかりません。");
  }

  const answers = await db
    .select({
      id: testSubmissionAnswers.id,
      judgeMode: testSubmissionAnswers.judgeMode,
      mark: testSubmissionAnswers.mark,
      points: testSubmissionAnswers.points,
      manualMark: testSubmissionAnswers.manualMark,
      manualScore: testSubmissionAnswers.manualScore,
      isManuallyGraded: testSubmissionAnswers.isManuallyGraded,
    })
    .from(testSubmissionAnswers)
    .where(eq(testSubmissionAnswers.submissionId, submissionId));

  let score = 0;
  let total = 0;

  for (const answer of answers) {
    const judgeMode = (answer.judgeMode ?? "").trim();
    const points =
      typeof answer.points === "number" && Number.isFinite(answer.points)
        ? answer.points
        : 0;

    if (points <= 0) continue;

    total += points;

    if (judgeMode === "none") {
      score += getManualEarnedScore({
        manualScore: answer.manualScore,
        manualMark: answer.manualMark,
        points,
      });
    } else {
      score += getAutoEarnedScore(answer.mark, points);
    }
  }

  const [updatedResult] = await db
    .update(testResults)
    .set({
      score,
      total,
      submittedAt: submission.submittedAt ?? null,
      classId: submission.classId ?? null,
      testId: submission.testId ?? null,
    })
    .where(eq(testResults.submissionId, submissionId))
    .returning({
      id: testResults.id,
      score: testResults.score,
      total: testResults.total,
    });

  await db
    .update(studentScoreHistories)
    .set({
      score,
      total,
      submittedAt: submission.submittedAt ?? null,
      testId: submission.testId ?? null,
      classIdAtRecord: submission.classId ?? null,
      note: total === 0 ? "採点対象問題なし" : null,
    })
    .where(eq(studentScoreHistories.submissionId, submissionId));

  return {
    score,
    total,
    testResultId: updatedResult?.id ?? null,
  };
}

export async function PATCH(
  req: NextRequest,
  context: {
    params: Promise<{ submissionId: string; answerId: string }>;
  }
) {
  try {
    const { submissionId, answerId } = await context.params;
    const submissionIdNumber = Number(submissionId);
    const answerIdNumber = Number(answerId);

    if (!Number.isInteger(submissionIdNumber) || submissionIdNumber <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_submission_id",
          message: "submissionId が不正です。",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(answerIdNumber) || answerIdNumber <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_answer_id",
          message: "answerId が不正です。",
        },
        { status: 400 }
      );
    }

    const body = (await req.json()) as UpdateManualGradeBody;

    const manualMark = normalizeManualMark(body.manualMark);
    const manualScore = normalizeManualScore(body.manualScore);
    const teacherComment = normalizeTeacherComment(body.teacherComment);

    const [target] = await db
      .select({
        id: testSubmissionAnswers.id,
        submissionId: testSubmissionAnswers.submissionId,
        judgeMode: testSubmissionAnswers.judgeMode,
        points: testSubmissionAnswers.points,
      })
      .from(testSubmissionAnswers)
      .where(
        and(
          eq(testSubmissionAnswers.id, answerIdNumber),
          eq(testSubmissionAnswers.submissionId, submissionIdNumber)
        )
      )
      .limit(1);

    if (!target) {
      return NextResponse.json(
        {
          ok: false,
          error: "answer_not_found",
          message: "対象の回答データが見つかりません。",
        },
        { status: 404 }
      );
    }

    if ((target.judgeMode ?? "").trim() !== "none") {
      return NextResponse.json(
        {
          ok: false,
          error: "manual_grading_not_allowed",
          message: "この問題は手動採点対象ではありません。",
        },
        { status: 400 }
      );
    }

    if (
      manualScore !== null &&
      typeof target.points === "number" &&
      manualScore > target.points
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "manual_score_too_large",
          message: `手動点は配点（${target.points}点）以下にしてください。`,
        },
        { status: 400 }
      );
    }

    const isManuallyGraded =
      manualMark !== null || manualScore !== null || teacherComment !== null;

    const [updatedAnswer] = await db
      .update(testSubmissionAnswers)
      .set({
        manualMark,
        manualScore,
        teacherComment,
        isManuallyGraded,
        gradedAt: isManuallyGraded ? new Date() : null,
      })
      .where(
        and(
          eq(testSubmissionAnswers.id, answerIdNumber),
          eq(testSubmissionAnswers.submissionId, submissionIdNumber)
        )
      )
      .returning({
        id: testSubmissionAnswers.id,
        manualMark: testSubmissionAnswers.manualMark,
        manualScore: testSubmissionAnswers.manualScore,
        teacherComment: testSubmissionAnswers.teacherComment,
        isManuallyGraded: testSubmissionAnswers.isManuallyGraded,
        gradedAt: testSubmissionAnswers.gradedAt,
      });

    const recalculated = await recalculateSubmissionScore(submissionIdNumber);

    return NextResponse.json({
      ok: true,
      answer: updatedAnswer ?? null,
      score: recalculated.score,
      total: recalculated.total,
      testResultId: recalculated.testResultId,
      message: isManuallyGraded
        ? "手動採点を保存し、成績を再計算しました。"
        : "手動採点をクリアし、成績を再計算しました。",
    });
  } catch (error) {
    console.error("manual grade update error:", error);

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