import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { books, classes, testResults, testSubmissions } from "@/db/schema";
import { getStudentSession } from "@/lib/student-auth";

function toLocaleStringOrDash(value: Date | null | undefined): string {
  if (!(value instanceof Date)) return "―";
  return value.toLocaleString("ja-JP");
}

function toPercent(score: number | null, total: number | null): string {
  if (score == null || total == null || total <= 0) return "―";
  return `${Math.round((score / total) * 100)}%`;
}

export default async function StudentResultsPage() {
  const session = await getStudentSession();

  if (!session) {
    redirect("/books");
  }

  const rows = await db
    .select({
      submissionId: testResults.submissionId,
      testResultId: testResults.id,
      testId: testResults.testId,
      score: testResults.score,
      total: testResults.total,
      submittedAt: testResults.submittedAt,
      bookId: testSubmissions.bookId,
      testTitle: testSubmissions.testTitle,
      studentNumber: testSubmissions.studentNumber,
      studentName: testSubmissions.studentName,
      className: classes.name,
      bookTitle: books.title,
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
        eq(testResults.studentId, session.studentId),
        eq(testSubmissions.classId, session.classId),
        eq(testSubmissions.studentNumber, session.studentNumber),
        eq(testSubmissions.studentName, session.studentName)
      )
    )
    .orderBy(desc(testResults.submittedAt), desc(testResults.id));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                ログイン中
              </div>
              <h1 className="text-2xl font-bold text-slate-900">自分のテスト結果</h1>
              <p className="text-sm leading-7 text-slate-600">
                ログイン中の生徒本人に紐づく結果だけを表示しています。
              </p>
              <div className="text-sm text-slate-700">
                {session.studentNumber} / {session.studentName}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/books"
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                ← 教材一覧へ
              </Link>
            </div>
          </div>
        </section>

        {rows.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="text-lg font-bold text-slate-900">
              まだ表示できるテスト結果はありません
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              採点後の結果が登録されると、この画面に表示されます。
            </p>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 text-lg font-bold text-slate-900">結果一覧</div>

            <div className="grid gap-4">
              {rows.map((row) => (
                <article
                  key={row.testResultId}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-500">
                        {row.bookTitle ?? row.bookId}
                      </div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {row.testTitle ?? row.testId ?? "名称未設定テスト"}
                      </h2>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span>クラス: {row.className ?? "―"}</span>
                        <span>提出日時: {toLocaleStringOrDash(row.submittedAt)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-right">
                        <div className="text-xs font-bold text-sky-700">得点</div>
                        <div className="text-xl font-extrabold text-sky-900">
                          {row.score ?? "―"} / {row.total ?? "―"}
                        </div>
                        <div className="text-xs text-sky-700">
                          正答率: {toPercent(row.score, row.total)}
                        </div>
                      </div>

                      <Link
                        href={`/books/results/${row.submissionId}`}
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                      >
                        詳細を見る
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}