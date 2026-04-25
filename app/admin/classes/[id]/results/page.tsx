import { db } from "@/db";
import {
  books,
  classes,
  studentScoreHistories,
  students,
  testSubmissions,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";

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
  return new Intl.DateTimeFormat("ja-JP").format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function getRate(score: number | null, total: number | null) {
  if (score == null || total == null || total <= 0) return null;
  return (score / total) * 100;
}

function getBestRate(rows: ScoreLikeRow[]) {
  let best: number | null = null;
  for (const row of rows) {
    const rate = getRate(row.score, row.total);
    if (rate == null) continue;
    if (best == null || rate > best) best = rate;
  }
  return best;
}

function pickLatest(rows: HistoryRow[]) {
  return [...rows].sort((a, b) => {
    const at = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bt = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return bt - at || b.id - a.id;
  })[0] ?? null;
}

export default async function ClassResultsPage(
  props: ClassResultsPageProps
) {
  const params = await props.params;
  const classId = Number(params.id);

  if (!classId) notFound();

  // 🔥 セッション取得
  const adminSession = await getAdminSession();

  if (
    !adminSession ||
    (adminSession.role !== "admin" && adminSession.role !== "teacher")
  ) {
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

  if (!classInfo) notFound();

  const studentRows = await db
    .select({
      id: students.id,
      studentNumber: students.studentNumber,
      studentName: students.studentName,
    })
    .from(students)
    .where(eq(students.classId, classId));

  // 🔥 ここが本質（権限制御付き）
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

  // 🔥 teacher制限
  const filtered =
    adminSession.role === "admin"
      ? historyRows
      : historyRows.filter(
          (row) => row.ownerTeacherId === adminSession.teacherId
        );

  const map = new Map<number, HistoryRow[]>();

  for (const row of filtered) {
    const bucket = map.get(row.studentId) ?? [];
    bucket.push(row);
    map.set(row.studentId, bucket);
  }

  const rows = studentRows.map((s) => {
    const histories = map.get(s.id) ?? [];
    const latest = pickLatest(histories);
    const latestRate = latest ? getRate(latest.score, latest.total) : null;

    return {
      studentId: s.id,
      studentNumber: s.studentNumber,
      studentName: s.studentName,
      attemptCount: histories.length,
      latestRate,
      bestRate: getBestRate(histories),
      latestScore: latest?.score ?? null,
      latestTotal: latest?.total ?? null,
      latestSubmittedAt: latest?.submittedAt ?? null,
    };
  });

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-bold">
        クラス成績一覧（{classInfo.name}）
      </h1>

      <table className="w-full text-sm border">
        <thead>
          <tr>
            <th>番号</th>
            <th>氏名</th>
            <th>回数</th>
            <th>最新</th>
            <th>最高</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.studentId}>
              <td>{r.studentNumber}</td>
              <td>{r.studentName}</td>
              <td>{r.attemptCount}</td>
              <td>{formatPercent(r.latestRate)}</td>
              <td>{formatPercent(r.bestRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Link href="/admin/classes">← 戻る</Link>
    </main>
  );
}