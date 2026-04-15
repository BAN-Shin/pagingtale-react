import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";

type SearchParams = Promise<{
  classId?: string;
  testId?: string;
  bookId?: string;
  studentNumber?: string;
  studentName?: string;
  q?: string;
  limit?: string;
  ungraded?: string;
}>;

type SubmissionListItem = {
  id: number;
  bookId: string;
  classId: number | null;
  className: string | null;
  testId: string | null;
  testTitle: string | null;
  studentNumber: string;
  studentName: string;
  submittedAt: string | null;
  submitReason: string | null;
  submittedPage: number | null;
  timeLimitMinutes: number | null;
  answerCount: number | null;
  score: number | null;
  total: number | null;
  createdAt: string | null;
  gradingStatus: "provisional" | "confirmed";
  gradingStatusLabel: "暫定" | "確定";
};

type SubmissionListResponse = {
  ok: boolean;
  submissions?: SubmissionListItem[];
  count?: number;
  message?: string;
  error?: string;
};

function safeText(value?: string): string {
  return (value ?? "").trim();
}

function buildQueryString(search: {
  classId?: string;
  testId?: string;
  bookId?: string;
  studentNumber?: string;
  studentName?: string;
  q?: string;
  limit?: string;
  ungraded?: string;
}): string {
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(search)) {
    const value = safeText(rawValue);
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatScore(score: number | null, total: number | null): string {
  if (score == null && total == null) return "-";
  if (score == null) return `- / ${total}`;
  if (total == null) return `${score} / -`;
  return `${score} / ${total}`;
}

function getStatusBadgeClass(status: SubmissionListItem["gradingStatus"]) {
  if (status === "provisional") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

async function fetchAdminSubmissions(queryString: string) {
  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (host
      ? `${forwardedProto || "https"}://${host}`
      : "http://localhost:3000");

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");

  const res = await fetch(`${baseUrl}/api/admin/submissions${queryString}`, {
    cache: "no-store",
    headers: cookieHeader
      ? {
          Cookie: cookieHeader,
        }
      : undefined,
  });

  const text = await res.text();

  let payload: SubmissionListResponse | null = null;

  try {
    payload = JSON.parse(text) as SubmissionListResponse;
  } catch {
    payload = null;
  }

  if (!res.ok || !payload?.ok) {
    return {
      ok: false as const,
      submissions: [] as SubmissionListItem[],
      message:
        payload?.message ||
        "提出一覧の取得に失敗しました。APIレスポンスを確認してください。",
      status: res.status,
      raw: text,
    };
  }

  return {
    ok: true as const,
    submissions: Array.isArray(payload.submissions) ? payload.submissions : [],
    count:
      typeof payload.count === "number" && Number.isFinite(payload.count)
        ? payload.count
        : 0,
  };
}

export default async function AdminSubmissionsPage(props: {
  searchParams?: SearchParams;
}) {
  const adminSession = await getAdminSession();

  if (
    !adminSession ||
    (adminSession.role !== "teacher" && adminSession.role !== "admin")
  ) {
    redirect("/admin/login");
  }

  const searchParams = props.searchParams ? await props.searchParams : {};

  const filters = {
    classId: safeText(searchParams.classId),
    testId: safeText(searchParams.testId),
    bookId: safeText(searchParams.bookId),
    studentNumber: safeText(searchParams.studentNumber),
    studentName: safeText(searchParams.studentName),
    q: safeText(searchParams.q),
    limit: safeText(searchParams.limit) || "50",
    ungraded: safeText(searchParams.ungraded) === "1" ? "1" : "",
  };

  const queryString = buildQueryString(filters);
  const result = await fetchAdminSubmissions(queryString);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">提出一覧</h1>
              <p className="text-sm text-slate-600">
                提出データを検索して確認できます。行を開くと詳細確認や採点UIへの導線に使えます。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                ← 管理画面へ
              </Link>

              <Link
                href="/admin/submissions"
                className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                条件をリセット
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <form method="GET" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                フリーワード
              </label>
              <input
                type="text"
                name="q"
                defaultValue={filters.q}
                placeholder="学籍番号・氏名・testId・bookId"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                classId
              </label>
              <input
                type="text"
                name="classId"
                defaultValue={filters.classId}
                placeholder="例: 1"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                testId
              </label>
              <input
                type="text"
                name="testId"
                defaultValue={filters.testId}
                placeholder="例: test-art-002"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                bookId
              </label>
              <input
                type="text"
                name="bookId"
                defaultValue={filters.bookId}
                placeholder="例: pagingtale-book-001"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                学籍番号
              </label>
              <input
                type="text"
                name="studentNumber"
                defaultValue={filters.studentNumber}
                placeholder="例: 240001"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                氏名
              </label>
              <input
                type="text"
                name="studentName"
                defaultValue={filters.studentName}
                placeholder="例: 山田"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                最大件数
              </label>
              <input
                type="number"
                name="limit"
                min={1}
                max={200}
                defaultValue={filters.limit}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                name="ungraded"
                value="1"
                defaultChecked={filters.ungraded === "1"}
                className="h-4 w-4 rounded border-slate-300"
              />
              未採点のみ
            </label>

            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-3">
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                検索する
              </button>

              <Link
                href="/admin/submissions"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                クリア
              </Link>
            </div>
          </form>
        </section>

        {!result.ok ? (
          <section className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {result.message}
            </div>

            <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-bold text-slate-700">
                デバッグ用レスポンスを表示
              </summary>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs text-slate-600">
                {result.raw}
              </pre>
            </details>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                <div>
                  取得件数:{" "}
                  <span className="font-bold text-slate-900">{result.count}</span>
                </div>

                {filters.ungraded === "1" ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    未採点のみ
                  </span>
                ) : null}
              </div>
            </section>

            {result.submissions.length === 0 ? (
              <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
                条件に一致する提出はありません。
              </section>
            ) : (
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-left text-xs font-bold text-slate-600">
                      <tr>
                        <th className="px-4 py-3">詳細</th>
                        <th className="px-4 py-3">提出日時</th>
                        <th className="px-4 py-3">状態</th>
                        <th className="px-4 py-3">クラス</th>
                        <th className="px-4 py-3">学籍番号</th>
                        <th className="px-4 py-3">氏名</th>
                        <th className="px-4 py-3">教材</th>
                        <th className="px-4 py-3">テスト</th>
                        <th className="px-4 py-3">得点</th>
                        <th className="px-4 py-3">回答数</th>
                        <th className="px-4 py-3">提出種別</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.submissions.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-slate-200 align-top transition hover:bg-slate-50"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/submissions/${item.id}`}
                              className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                            >
                              開く
                            </Link>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                            {formatDateTime(item.submittedAt || item.createdAt)}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadgeClass(
                                item.gradingStatus
                              )}`}
                            >
                              {item.gradingStatusLabel}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            <div>{item.className || "-"}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              classId: {item.classId ?? "-"}
                            </div>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                            {item.studentNumber}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-slate-900">
                            {item.studentName}
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            <div>{item.bookId}</div>
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            <div>{item.testTitle || "-"}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              {item.testId || "-"}
                            </div>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900">
                            {formatScore(item.score, item.total)}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                            {item.answerCount ?? "-"}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                            {item.submitReason || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
} 