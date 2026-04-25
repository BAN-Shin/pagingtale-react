import { db } from "@/db";
import {
  books,
  classes,
  studentScoreHistories,
  students,
  testSubmissions,
} from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

type ClassResultsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ScoreLikeRow = {
  score: number | null;
  total: number | null;
};

type HistoryRow = {
  id: number;
  studentId: number;
  classIdAtRecord: number | null;
  testId: string | null;
  testTitle: string | null;
  score: number | null;
  total: number | null;
  submittedAt: Date | null;
  recordedAt: Date | null;
  attemptNumber: number | null;
  submissionId: number | null;
  note: string | null;
  ownerTeacherId: number;
};

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function getRate(
  score: number | null | undefined,
  total: number | null | undefined
) {
  if (score == null || total == null || total <= 0) return null;
  return (score / total) * 100;
}

function getBestRate(rows: ScoreLikeRow[]) {
  let best: number | null = null;

  for (const row of rows) {
    const rate = getRate(row.score, row.total);
    if (rate == null) continue;
    if (best == null || rate > best) {
      best = rate;
    }
  }

  return best;
}

function pickLatestHistoryRow<T extends { submittedAt: Date | null; id: number }>(
  rows: T[]
): T | null {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => {
    const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return b.id - a.id;
  });

  return sorted[0] ?? null;
}

function getResultStatus(
  latestHistory: Pick<HistoryRow, "note"> | null
): "暫定" | "確定" | "-" {
  if (!latestHistory) return "-";

  const note = (latestHistory.note ?? "").trim();

  if (note === "提出時自動集計") {
    return "暫定";
  }

  return "確定";
}

function getStatusBadgeClass(status: "暫定" | "確定" | "-") {
  if (status === "暫定") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "確定") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-400";
}

export default async function ClassResultsPage(
  props: ClassResultsPageProps
) {
  const adminSession = await getAdminSession();

  if (
    !adminSession ||
    (adminSession.role !== "admin" && adminSession.role !== "teacher")
  ) {
    notFound();
  }

  const params = await props.params;
  const classId = Number(params.id);

  if (!classId) {
    notFound();
  }

  const [classInfo] = await db
    .select({
      id: classes.id,
      name: classes.name,
      deletedAt: classes.deletedAt,
    })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!classInfo) {
    notFound();
  }

  const studentRows = await db
    .select({
      id: students.id,
      studentNumber: students.studentNumber,
      studentName: students.studentName,
    })
    .from(students)
    .where(eq(students.classId, classId));

  const historyRows = await db
    .select({
      id: studentScoreHistories.id,
      studentId: studentScoreHistories.studentId,
      classIdAtRecord: studentScoreHistories.classIdAtRecord,
      testId: studentScoreHistories.testId,
      testTitle: studentScoreHistories.testTitle,
      score: studentScoreHistories.score,
      total: studentScoreHistories.total,
      submittedAt: studentScoreHistories.submittedAt,
      recordedAt: studentScoreHistories.recordedAt,
      attemptNumber: studentScoreHistories.attemptNumber,
      submissionId: studentScoreHistories.submissionId,
      note: studentScoreHistories.note,
      ownerTeacherId: books.ownerTeacherId,
    })
    .from(studentScoreHistories)
    .innerJoin(
      testSubmissions,
      eq(studentScoreHistories.submissionId, testSubmissions.id)
    )
    .innerJoin(books, eq(testSubmissions.bookId, books.bookId))
    .where(eq(studentScoreHistories.classIdAtRecord, classId));

  const visibleHistoryRows =
    adminSession.role === "admin"
      ? historyRows
      : historyRows.filter(
          (row) => row.ownerTeacherId === adminSession.teacherId
        );

  const historiesByStudent = new Map<number, HistoryRow[]>();

  for (const row of visibleHistoryRows) {
    const bucket = historiesByStudent.get(row.studentId) ?? [];
    bucket.push(row);
    historiesByStudent.set(row.studentId, bucket);
  }

  const studentSummaryRows = studentRows
    .map((student) => {
      const studentHistories = historiesByStudent.get(student.id) ?? [];
      const latestHistory = pickLatestHistoryRow(studentHistories);
      const latestRate = latestHistory
        ? getRate(latestHistory.score, latestHistory.total)
        : null;
      const bestRate = getBestRate(studentHistories);
      const attemptCount = studentHistories.length;
      const status = getResultStatus(latestHistory);

      return {
        studentId: student.id,
        studentNumber: student.studentNumber,
        studentName: student.studentName,
        attemptCount,
        latestScore: latestHistory?.score ?? null,
        latestTotal: latestHistory?.total ?? null,
        latestRate,
        bestRate,
        latestSubmittedAt: latestHistory?.submittedAt ?? null,
        latestTestId: latestHistory?.testId ?? null,
        latestTestTitle: latestHistory?.testTitle ?? null,
        latestSubmissionId: latestHistory?.submissionId ?? null,
        latestNote: latestHistory?.note ?? null,
        status,
      };
    })
    .sort((a, b) => {
      const numberCompare = a.studentNumber.localeCompare(
        b.studentNumber,
        "ja"
      );
      if (numberCompare !== 0) return numberCompare;
      return a.studentId - b.studentId;
    });

  const classStudentCount = studentSummaryRows.length;
  const testedStudentCount = studentSummaryRows.filter(
    (row) => row.attemptCount > 0
  ).length;

  const totalAttemptCount = studentSummaryRows.reduce(
    (sum, row) => sum + row.attemptCount,
    0
  );

  const latestRateRows = studentSummaryRows.filter(
    (row): row is typeof row & { latestRate: number } => row.latestRate != null
  );

  const classAverageLatestRate =
    latestRateRows.length > 0
      ? latestRateRows.reduce((sum, row) => sum + row.latestRate, 0) /
        latestRateRows.length
      : null;

  const provisionalCount = studentSummaryRows.filter(
    (row) => row.status === "暫定"
  ).length;

  const confirmedCount = studentSummaryRows.filter(
    (row) => row.status === "確定"
  ).length;

  const isDeletedClass = Boolean(classInfo.deletedAt);

  return (
    <main className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">
          クラス成績一覧（{classInfo.name}）
        </h1>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/students?classId=${classInfo.id}`}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            生徒名簿へ
          </Link>

          <Link
            href="/admin/classes"
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            クラス一覧へ
          </Link>
        </div>
      </div>

      {isDeletedClass ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-900">
          このクラスは削除済みです。履歴確認のため表示しています。
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">クラスサマリー</h2>
          <p className="mt-1 text-sm text-slate-500">
            一覧は最新結果ベースで表示し、受験回数は履歴全体から集計しています。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs font-bold tracking-wide text-slate-500">
              生徒数
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {classStudentCount}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs font-bold tracking-wide text-slate-500">
              受験者数
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {testedStudentCount}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs font-bold tracking-wide text-slate-500">
              総受験回数
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {totalAttemptCount}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs font-bold tracking-wide text-slate-500">
              最新結果ベース平均正答率
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {formatPercent(classAverageLatestRate)}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <div className="text-xs font-bold tracking-wide text-amber-700">
              暫定
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-900">
              {provisionalCount}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <div className="text-xs font-bold tracking-wide text-emerald-700">
              確定
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-900">
              {confirmedCount}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              生徒別最新成績サマリー
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              各生徒の最新結果を中心に表示し、受験回数と最高正答率は履歴から集計しています。
            </p>
          </div>

          <div className="text-sm font-semibold text-slate-600">
            {studentSummaryRows.length}人
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-100">
              <tr className="text-left text-slate-700">
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  学籍番号
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  氏名
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  受験回数
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  最新点
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  最新正答率
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  最高正答率
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  状態
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  最終受験日
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  導線
                </th>
              </tr>
            </thead>

            <tbody>
              {studentSummaryRows.map((row) => {
                const hasResults = row.attemptCount > 0;
                const isLowLatest =
                  row.latestRate != null && row.latestRate < 40;

                const latestScoreText =
                  row.latestScore != null && row.latestTotal != null
                    ? `${row.latestScore} / ${row.latestTotal}`
                    : row.latestScore != null
                      ? String(row.latestScore)
                      : "-";

                return (
                  <tr
                    key={row.studentId}
                    className={
                      isLowLatest
                        ? "border-t border-slate-200 bg-rose-50/70"
                        : "border-t border-slate-200"
                    }
                  >
                    <td className="px-4 py-3 text-slate-700">
                      {row.studentNumber}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {row.studentName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.attemptCount}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {latestScoreText}
                    </td>
                    <td
                      className={
                        isLowLatest
                          ? "px-4 py-3 font-bold text-rose-700"
                          : "px-4 py-3 text-slate-700"
                      }
                    >
                      {formatPercent(row.latestRate)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatPercent(row.bestRate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadgeClass(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>
                      {row.latestNote ? (
                        <div className="mt-1 text-xs text-slate-500">
                          {row.latestNote}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(row.latestSubmittedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/students/${row.studentId}`}
                          className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-slate-100"
                        >
                          生徒詳細 →
                        </Link>

                        {!hasResults ? (
                          <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400">
                            成績なし
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {studentSummaryRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    このクラスにはまだ生徒が登録されていません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}