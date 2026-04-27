import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import {
  books,
  classes,
  testResults,
  testSubmissionAnswers,
  testSubmissions,
} from "@/db/schema";
import { getStudentSession } from "@/lib/student-auth";

type PageProps = {
  params: Promise<{
    submissionId: string;
  }>;
};

function parseSubmissionId(value: string): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function toLocaleStringOrDash(value: Date | null | undefined): string {
  if (!(value instanceof Date)) return "―";
  return value.toLocaleString("ja-JP");
}

function getDisplayMark(mark: string | null | undefined): string {
  const value = (mark ?? "").trim();

  if (!value) return "未判定";
  if (value === "correct") return "正解";
  if (value === "incorrect") return "不正解";
  if (value === "partial") return "部分点";
  if (value === "○" || value === "×" || value === "△" || value === "✓") {
    return value;
  }

  return value;
}

export default async function StudentResultDetailPage(props: PageProps) {
  const session = await getStudentSession();

  if (!session) {
    redirect("/books");
  }

  const params = await props.params;
  const submissionId = parseSubmissionId(params.submissionId);

  if (!submissionId) {
    notFound();
  }

  const [detail] = await db
    .select({
      submissionId: testSubmissions.id,
      bookId: testSubmissions.bookId,
      bookTitle: books.title,
      className: classes.name,
      testId: testSubmissions.testId,
      testTitle: testSubmissions.testTitle,
      studentNumber: testSubmissions.studentNumber,
      studentName: testSubmissions.studentName,
      submittedAt: testSubmissions.submittedAt,
      submitReason: testSubmissions.submitReason,
      timeLimitMinutes: testSubmissions.timeLimitMinutes,
      answerCount: testSubmissions.answerCount,
      score: testResults.score,
      total: testResults.total,
    })
    .from(testResults)
    .innerJoin(
      testSubmissions,
      eq(testResults.submissionId, testSubmissions.id)
    )
    .leftJoin(classes, eq(testSubmissions.classId, classes.id))
    .leftJoin(books, eq(testSubmissions.bookId, books.bookId))
    .where(
      and(
        eq(testResults.submissionId, submissionId),
        eq(testResults.studentId, session.studentId),
        eq(testSubmissions.classId, session.classId),
        eq(testSubmissions.studentNumber, session.studentNumber),
        eq(testSubmissions.studentName, session.studentName)
      )
    )
    .limit(1);

  if (!detail) {
    notFound(); // ← これで他人アクセス時は404になる
  }

  const answers = detail
    ? await db
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
        .innerJoin(
          testSubmissions,
          eq(testSubmissionAnswers.submissionId, testSubmissions.id)
        )
        .where(
          and(
            eq(testSubmissionAnswers.submissionId, submissionId),
            eq(testSubmissions.classId, session.classId),
            eq(testSubmissions.studentNumber, session.studentNumber),
            eq(testSubmissions.studentName, session.studentName)
          )
        )
        .orderBy(
          asc(testSubmissionAnswers.page),
          asc(testSubmissionAnswers.id)
        )
    : [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500">
                {detail.bookTitle ?? detail.bookId}
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                {detail.testTitle ?? detail.testId ?? "テスト結果詳細"}
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <span>クラス: {detail.className ?? "―"}</span>
                <span>提出日時: {toLocaleStringOrDash(detail.submittedAt)}</span>
                <span>提出理由: {detail.submitReason ?? "―"}</span>
              </div>
              <div className="text-sm text-slate-700">
                {detail.studentNumber} / {detail.studentName}
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-right">
                <div className="text-xs font-bold text-sky-700">得点</div>
                <div className="text-2xl font-extrabold text-sky-900">
                  {detail.score ?? "―"} / {detail.total ?? "―"}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/books/results"
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  ← 結果一覧へ
                </Link>
                <Link
                  href="/books"
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  教材一覧へ
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 text-lg font-bold text-slate-900">解答詳細</div>

          <div className="grid gap-4">
            {answers.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                解答データはまだありません。
              </div>
            ) : (
              answers.map((answer, index) => {
                const displayMark = getDisplayMark(
                  answer.manualMark ?? answer.mark
                );
                const displayScore =
                  answer.manualScore != null
                    ? answer.manualScore
                    : answer.points;

                return (
                  <article
                    key={answer.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                            問題 {index + 1}
                          </div>
                          <div className="text-xs text-slate-500">
                            page: {answer.page ?? "―"}
                          </div>
                          <div className="text-xs text-slate-500">
                            questionId: {answer.questionId}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-xs font-bold text-slate-500">
                            問題文
                          </div>
                          <div className="whitespace-pre-wrap text-sm leading-7 text-slate-900">
                            {answer.prompt ?? ""}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-xs font-bold text-slate-500">
                            あなたの解答
                          </div>
                          <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900">
                            {answer.answer?.trim() ? answer.answer : "（未入力）"}
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="mb-1 text-xs font-bold text-slate-500">
                              正答
                            </div>
                            <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900">
                              {answer.correctAnswer?.trim()
                                ? answer.correctAnswer
                                : "―"}
                            </div>
                          </div>

                          <div>
                            <div className="mb-1 text-xs font-bold text-slate-500">
                              採点コメント
                            </div>
                            <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900">
                              {answer.teacherComment?.trim()
                                ? answer.teacherComment
                                : "―"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-[180px] rounded-2xl border border-sky-200 bg-sky-50 p-4">
                        <div className="text-xs font-bold text-sky-700">判定</div>
                        <div className="mt-1 text-lg font-extrabold text-sky-900">
                          {displayMark}
                        </div>

                        <div className="mt-4 text-xs font-bold text-sky-700">点数</div>
                        <div className="mt-1 text-lg font-bold text-sky-900">
                          {displayScore}
                        </div>

                        <div className="mt-4 space-y-1 text-xs text-sky-800">
                          <div>採点方式: {answer.judgeMode ?? "―"}</div>
                          <div>
                            手動採点: {answer.isManuallyGraded ? "あり" : "なし"}
                          </div>
                          <div>
                            解答日時: {toLocaleStringOrDash(answer.answeredAt)}
                          </div>
                          <div>
                            採点日時: {toLocaleStringOrDash(answer.gradedAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}