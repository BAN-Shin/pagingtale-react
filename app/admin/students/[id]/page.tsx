import { db } from "@/db";
import { classes, studentScoreHistories, students } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

type StudentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type HistoryRow = {
  id: number;
  testId: string | null;
  testTitle: string | null;
  score: number | null;
  total: number | null;
  submittedAt: Date | null;
  submissionId: number | null;
  recordedAt: Date | null;
  attemptNumber: number | null;
  note: string | null;
};

type GroupedHistory = {
  key: string;
  testId: string | null;
  testTitle: string;
  rows: HistoryRow[];
};

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatScoreRate(
  score: number | null | undefined,
  total: number | null | undefined
) {
  if (score == null || total == null || total <= 0) {
    return "-";
  }

  return `${((score / total) * 100).toFixed(1)}%`;
}

function getScoreRateValue(
  score: number | null | undefined,
  total: number | null | undefined
) {
  if (score == null || total == null || total <= 0) {
    return null;
  }

  return (score / total) * 100;
}

function formatAverageScore(
  rows: Array<{ score: number | null; total: number | null }>
) {
  const validRows = rows.filter(
    (row): row is { score: number; total: number } =>
      row.score != null && row.total != null && row.total > 0
  );

  if (validRows.length === 0) {
    return "-";
  }

  const averagePercent =
    validRows.reduce((sum, row) => sum + (row.score / row.total) * 100, 0) /
    validRows.length;

  return `${averagePercent.toFixed(1)}%`;
}

function formatBestScore(
  rows: Array<{ score: number | null; total: number | null }>
) {
  const validRows = rows.filter(
    (row): row is { score: number; total: number } =>
      row.score != null && row.total != null && row.total > 0
  );

  if (validRows.length === 0) {
    return "-";
  }

  const bestRow = validRows.reduce((best, current) => {
    const bestRate = best.score / best.total;
    const currentRate = current.score / current.total;
    return currentRate > bestRate ? current : best;
  });

  return `${bestRow.score} / ${bestRow.total}`;
}

function buildChartPoints(rows: HistoryRow[]) {
  const plotted = rows
    .map((row, index) => ({
      index,
      rate: getScoreRateValue(row.score, row.total),
      label: row.testTitle?.trim() || row.testId?.trim() || `第${index + 1}回`,
      dateLabel: formatDate(row.submittedAt),
      attemptLabel:
        row.attemptNumber != null ? `第${row.attemptNumber}回` : `#${index + 1}`,
    }))
    .filter((row): row is typeof row & { rate: number } => row.rate != null);

  if (plotted.length === 0) {
    return {
      points: [] as Array<{
        x: number;
        y: number;
        rate: number;
        label: string;
        dateLabel: string;
        attemptLabel: string;
      }>,
      polyline: "",
    };
  }

  const width = 640;
  const height = 240;
  const paddingLeft = 44;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 28;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const points = plotted.map((row, i) => {
    const x =
      plotted.length === 1
        ? paddingLeft + innerWidth / 2
        : paddingLeft + (innerWidth * i) / (plotted.length - 1);

    const y =
      paddingTop +
      innerHeight -
      (Math.max(0, Math.min(100, row.rate)) / 100) * innerHeight;

    return {
      x,
      y,
      rate: row.rate,
      label: row.label,
      dateLabel: row.dateLabel,
      attemptLabel: row.attemptLabel,
    };
  });

  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return { points, polyline };
}

function buildGroupedHistories(rows: HistoryRow[]): GroupedHistory[] {
  const map = new Map<string, GroupedHistory>();

  for (const row of rows) {
    const normalizedTitle = row.testTitle?.trim() || "";
    const normalizedTestId = row.testId?.trim() || "";
    const key = normalizedTestId
      ? `id:${normalizedTestId}`
      : normalizedTitle
        ? `title:${normalizedTitle}`
        : "unknown:名称未設定テスト";

    const displayTitle =
      normalizedTitle || normalizedTestId || "名称未設定テスト";

    const current =
      map.get(key) ??
      {
        key,
        testId: normalizedTestId || null,
        testTitle: displayTitle,
        rows: [],
      };

    current.rows.push(row);
    map.set(key, current);
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) => {
        const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;

        if (aTime !== bTime) {
          return aTime - bTime;
        }

        return a.id - b.id;
      }),
    }))
    .sort((a, b) => a.testTitle.localeCompare(b.testTitle, "ja"));
}

function getHistoryStatus(row: Pick<HistoryRow, "note">): "暫定" | "確定" {
  const note = (row.note ?? "").trim();
  return note === "提出時自動集計" ? "暫定" : "確定";
}

function getStatusBadgeClass(status: "暫定" | "確定") {
  if (status === "暫定") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default async function StudentDetailPage(
  props: StudentDetailPageProps
) {
  const params = await props.params;
  const studentId = Number(params.id);

  if (!studentId) {
    notFound();
  }

  const [studentInfo] = await db
    .select({
      id: students.id,
      classId: students.classId,
      studentNumber: students.studentNumber,
      studentName: students.studentName,
      createdAt: students.createdAt,
      className: classes.name,
      classDeletedAt: classes.deletedAt,
    })
    .from(students)
    .innerJoin(classes, eq(students.classId, classes.id))
    .where(eq(students.id, studentId))
    .limit(1);

  if (!studentInfo) {
    notFound();
  }

  const latestFirstRows = await db
    .select({
      id: studentScoreHistories.id,
      testId: studentScoreHistories.testId,
      testTitle: studentScoreHistories.testTitle,
      score: studentScoreHistories.score,
      total: studentScoreHistories.total,
      submittedAt: studentScoreHistories.submittedAt,
      submissionId: studentScoreHistories.submissionId,
      recordedAt: studentScoreHistories.recordedAt,
      attemptNumber: studentScoreHistories.attemptNumber,
      note: studentScoreHistories.note,
    })
    .from(studentScoreHistories)
    .where(eq(studentScoreHistories.studentId, studentId))
    .orderBy(
      desc(studentScoreHistories.submittedAt),
      desc(studentScoreHistories.id)
    );

  const oldestFirstRows = await db
    .select({
      id: studentScoreHistories.id,
      testId: studentScoreHistories.testId,
      testTitle: studentScoreHistories.testTitle,
      score: studentScoreHistories.score,
      total: studentScoreHistories.total,
      submittedAt: studentScoreHistories.submittedAt,
      submissionId: studentScoreHistories.submissionId,
      recordedAt: studentScoreHistories.recordedAt,
      attemptNumber: studentScoreHistories.attemptNumber,
      note: studentScoreHistories.note,
    })
    .from(studentScoreHistories)
    .where(eq(studentScoreHistories.studentId, studentId))
    .orderBy(
      asc(studentScoreHistories.submittedAt),
      asc(studentScoreHistories.id)
    );

  const attemptCount = latestFirstRows.length;
  const averageScoreText = formatAverageScore(latestFirstRows);
  const bestScoreText = formatBestScore(latestFirstRows);
  const isDeletedClass = Boolean(studentInfo.classDeletedAt);

  const latestRate =
    latestFirstRows.length > 0
      ? getScoreRateValue(latestFirstRows[0].score, latestFirstRows[0].total)
      : null;

  const provisionalCount = latestFirstRows.filter(
    (row) => getHistoryStatus(row) === "暫定"
  ).length;

  const confirmedCount = latestFirstRows.filter(
    (row) => getHistoryStatus(row) === "確定"
  ).length;

  const { points: chartPoints, polyline } = buildChartPoints(oldestFirstRows);
  const groupedHistories = buildGroupedHistories(latestFirstRows);

  return (
    <main className="min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">生徒詳細</h1>

        <Link
          href={`/admin/students?classId=${studentInfo.classId}`}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
        >
          ← 生徒一覧へ
        </Link>
      </div>

      {isDeletedClass ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-900">
          この生徒は削除済みクラスに所属していた履歴として表示しています。
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs font-bold tracking-wide text-slate-500">
              ID
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {studentInfo.id}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold tracking-wide text-slate-500">
              学籍番号
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {studentInfo.studentNumber}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold tracking-wide text-slate-500">
              氏名
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {studentInfo.studentName}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold tracking-wide text-slate-500">
              クラス
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {studentInfo.className}
              {isDeletedClass ? (
                <span className="ml-2 inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                  削除済み
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">成績サマリー</h2>
          <p className="mt-1 text-sm text-slate-500">
            登録されている成績履歴から集計しています。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs font-bold tracking-wide text-slate-500">
              受験回数
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {attemptCount}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs font-bold tracking-wide text-slate-500">
              最新正答率
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {latestRate == null ? "-" : `${latestRate.toFixed(1)}%`}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs font-bold tracking-wide text-slate-500">
              平均正答率
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {averageScoreText}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs font-bold tracking-wide text-slate-500">
              最高点
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {bestScoreText}
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

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">成績推移</h2>
          <p className="mt-1 text-sm text-slate-500">
            正答率の推移を古い順に表示しています。
          </p>
        </div>

        {chartPoints.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            グラフにできる成績データがまだありません。
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <div className="min-w-[680px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <svg
                  viewBox="0 0 640 240"
                  className="h-[240px] w-full"
                  role="img"
                  aria-label="成績推移グラフ"
                >
                  {[0, 25, 50, 75, 100].map((tick) => {
                    const y = 16 + (196 - (tick / 100) * 196);
                    return (
                      <g key={tick}>
                        <line
                          x1="44"
                          y1={y}
                          x2="624"
                          y2={y}
                          stroke="rgb(226 232 240)"
                          strokeWidth="1"
                        />
                        <text
                          x="38"
                          y={y + 4}
                          textAnchor="end"
                          fontSize="10"
                          fill="rgb(100 116 139)"
                        >
                          {tick}
                        </text>
                      </g>
                    );
                  })}

                  <line
                    x1="44"
                    y1="16"
                    x2="44"
                    y2="212"
                    stroke="rgb(148 163 184)"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="44"
                    y1="212"
                    x2="624"
                    y2="212"
                    stroke="rgb(148 163 184)"
                    strokeWidth="1.5"
                  />

                  {polyline ? (
                    <polyline
                      fill="none"
                      stroke="rgb(37 99 235)"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={polyline}
                    />
                  ) : null}

                  {chartPoints.map((point, index) => {
                    const isLow = point.rate < 40;
                    return (
                      <g key={`${point.label}-${index}`}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="5"
                          fill={isLow ? "rgb(190 24 93)" : "rgb(37 99 235)"}
                        />
                        <title>
                          {`${point.attemptLabel} / ${point.label} / ${point.dateLabel} / ${point.rate.toFixed(1)}%`}
                        </title>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {chartPoints.map((point, index) => (
                <div
                  key={`${point.label}-${index}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs"
                >
                  <div className="font-bold text-slate-900">
                    {point.attemptLabel}
                  </div>
                  <div className="mt-1 text-slate-600">{point.label}</div>
                  <div className="mt-1 text-slate-500">{point.dateLabel}</div>
                  <div className="mt-2 text-sm font-bold text-slate-900">
                    {point.rate.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">テスト別履歴</h2>
          <p className="mt-1 text-sm text-slate-500">
            同じテストごとに履歴をまとめて表示しています。
          </p>
        </div>

        {groupedHistories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            まだテスト別に表示できる履歴がありません。
          </div>
        ) : (
          <div className="space-y-4">
            {groupedHistories.map((group) => (
              <section
                key={group.key}
                className="overflow-hidden rounded-2xl border border-slate-200"
              >
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900">
                        {group.testTitle}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {group.testId ? `testId: ${group.testId}` : "testId: -"}
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-slate-600">
                      {group.rows.length}件
                    </div>
                  </div>
                </div>

                <div className="overflow-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-white">
                      <tr className="text-left text-slate-700">
                        <th className="border-b border-slate-200 px-4 py-3 font-bold">
                          回数
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 font-bold">
                          日付
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 font-bold">
                          点数
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 font-bold">
                          点数率
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 font-bold">
                          状態
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 font-bold">
                          submissionId
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 font-bold">
                          メモ
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {group.rows.map((row, index) => {
                        const scoreRateValue = getScoreRateValue(
                          row.score,
                          row.total
                        );
                        const isLowScoreRow =
                          scoreRateValue != null && scoreRateValue < 40;

                        const scoreText =
                          row.score != null && row.total != null
                            ? `${row.score} / ${row.total}`
                            : row.score != null
                              ? String(row.score)
                              : "-";

                        const status = getHistoryStatus(row);

                        return (
                          <tr
                            key={row.id}
                            className={
                              isLowScoreRow
                                ? "border-t border-slate-200 bg-rose-50/70"
                                : "border-t border-slate-200 bg-white"
                            }
                          >
                            <td className="px-4 py-3 text-slate-700">
                              {row.attemptNumber != null
                                ? `第${row.attemptNumber}回`
                                : `#${index + 1}`}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {formatDate(row.submittedAt)}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {scoreText}
                            </td>
                            <td
                              className={
                                isLowScoreRow
                                  ? "px-4 py-3 font-bold text-rose-700"
                                  : "px-4 py-3 text-slate-700"
                              }
                            >
                              {formatScoreRate(row.score, row.total)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadgeClass(
                                  status
                                )}`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {row.submissionId ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {row.note || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">成績履歴</h2>
            <p className="mt-1 text-sm text-slate-500">
              この生徒に紐づく成績履歴を新しい順で表示しています。
            </p>
          </div>

          <div className="text-sm font-semibold text-slate-600">
            {latestFirstRows.length}件
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-100">
              <tr className="text-left text-slate-700">
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  日付
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  テスト
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  テストID
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  点数
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  点数率
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  状態
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  attempt
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  submissionId
                </th>
              </tr>
            </thead>

            <tbody>
              {latestFirstRows.map((row) => {
                const title =
                  row.testTitle?.trim() ||
                  row.testId?.trim() ||
                  "名称未設定テスト";

                const scoreText =
                  row.score != null && row.total != null
                    ? `${row.score} / ${row.total}`
                    : row.score != null
                      ? String(row.score)
                      : "-";

                const scoreRateText = formatScoreRate(row.score, row.total);
                const scoreRateValue = getScoreRateValue(row.score, row.total);
                const isLowScoreRow =
                  scoreRateValue != null && scoreRateValue < 40;
                const status = getHistoryStatus(row);

                return (
                  <tr
                    key={row.id}
                    className={
                      isLowScoreRow
                        ? "border-t border-slate-200 bg-rose-50/70"
                        : "border-t border-slate-200"
                    }
                  >
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(row.submittedAt)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div>{title}</div>
                      {row.note ? (
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          {row.note}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.testId || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{scoreText}</td>
                    <td
                      className={
                        isLowScoreRow
                          ? "px-4 py-3 font-bold text-rose-700"
                          : "px-4 py-3 text-slate-700"
                      }
                    >
                      {scoreRateText}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadgeClass(
                          status
                        )}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {row.attemptNumber ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {row.submissionId ?? "-"}
                    </td>
                  </tr>
                );
              })}

              {latestFirstRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    まだ成績履歴がありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {latestFirstRows.length > 0 ? (
          <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-500">
            最終記録日時: {formatDateTime(latestFirstRows[0].recordedAt)}
          </div>
        ) : null}
      </section>
    </main>
  );
}