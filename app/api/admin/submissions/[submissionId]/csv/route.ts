import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { testSubmissionAnswers, testSubmissions } from "@/db/schema";

function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function sanitizeFileNamePart(value: string): string {
  return value.trim().replace(/[\\/:*?"<>| ]+/g, "_");
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await context.params;
    const submissionIdNumber = Number(submissionId);

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

    const [submission] = await db
      .select({
        id: testSubmissions.id,
        bookId: testSubmissions.bookId,
        testId: testSubmissions.testId,
        testTitle: testSubmissions.testTitle,
        studentNumber: testSubmissions.studentNumber,
        studentName: testSubmissions.studentName,
        submittedAt: testSubmissions.submittedAt,
        submitReason: testSubmissions.submitReason,
        timeLimitMinutes: testSubmissions.timeLimitMinutes,
      })
      .from(testSubmissions)
      .where(eq(testSubmissions.id, submissionIdNumber))
      .limit(1);

    if (!submission) {
      return NextResponse.json(
        {
          ok: false,
          error: "submission_not_found",
          message: "提出データが見つかりません。",
        },
        { status: 404 }
      );
    }

    const answers = await db
      .select({
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
      .where(eq(testSubmissionAnswers.submissionId, submission.id))
      .orderBy(
        asc(testSubmissionAnswers.page),
        asc(testSubmissionAnswers.id)
      );

    const header = [
      "submittedAt",
      "submitReason",
      "bookId",
      "testId",
      "testTitle",
      "timeLimitMinutes",
      "studentNumber",
      "studentName",
      "questionId",
      "page",
      "points",
      "prompt",
      "correctAnswer",
      "judgeMode",
      "autoMark",
      "answer",
      "answeredAt",
      "manualMark",
      "manualScore",
      "teacherComment",
      "isManuallyGraded",
      "gradedAt",
    ];

    const rows = answers.map((row) =>
      [
        submission.submittedAt?.toISOString?.() ?? submission.submittedAt ?? "",
        submission.submitReason,
        submission.bookId,
        submission.testId,
        submission.testTitle,
        submission.timeLimitMinutes,
        submission.studentNumber,
        submission.studentName,
        row.questionId,
        row.page,
        row.points,
        row.prompt,
        row.correctAnswer,
        row.judgeMode,
        row.mark,
        row.answer,
        row.answeredAt?.toISOString?.() ?? row.answeredAt ?? "",
        row.manualMark,
        row.manualScore,
        row.teacherComment,
        row.isManuallyGraded,
        row.gradedAt?.toISOString?.() ?? row.gradedAt ?? "",
      ]
        .map((cell) =>
          escapeCsvValue(
            cell instanceof Date ? cell.toISOString() : cell
          )
        )
        .join(",")
    );

    const csv = `\uFEFF${[header.join(","), ...rows].join("\r\n")}`;

    const fileName = [
      sanitizeFileNamePart(submission.testId ?? "test"),
      sanitizeFileNamePart(submission.studentNumber || "no-number"),
      sanitizeFileNamePart(submission.studentName || "no-name"),
      sanitizeFileNamePart(String(submission.id)),
    ].join("_");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("submission csv export error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "internal_server_error",
        message: "CSV再出力中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}