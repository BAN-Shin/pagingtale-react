import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import AdminSubmissionDetailClient from "@/components/admin/AdminSubmissionDetailClient";

type PageProps = {
  params: Promise<{
    submissionId: string;
  }>;
};

type SubmissionDetailSubmission = {
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
  createdAt: string | null;
};

type SubmissionDetailAnswer = {
  id: number;
  questionId: string;
  page: number | null;
  prompt: string;
  correctAnswer: string;
  judgeMode: string;
  mark: string;
  answer: string;
  answeredAt: string | null;
  points: number;
  manualMark: string | null;
  manualScore: number | null;
  teacherComment: string | null;
  isManuallyGraded: boolean;
  gradedAt: string | null;
};

type SubmissionDetailResult = {
  id: number;
  submissionId: number;
  studentId: number | null;
  classId: number | null;
  testId: string | null;
  score: number | null;
  total: number | null;
  submittedAt: string | null;
} | null;

type SubmissionDetailHistory = {
  id: number;
  studentId: number;
  classIdAtRecord: number | null;
  testResultId: number | null;
  submissionId: number | null;
  testId: string | null;
  testTitle: string | null;
  score: number | null;
  total: number | null;
  submittedAt: string | null;
  recordedAt: string | null;
  attemptNumber: number | null;
  note: string | null;
};

type SubmissionDetailData = {
  ok: boolean;
  submission?: SubmissionDetailSubmission;
  answers?: SubmissionDetailAnswer[];
  result?: SubmissionDetailResult;
  histories?: SubmissionDetailHistory[];
  message?: string;
};

async function fetchSubmissionDetail(submissionId: string) {
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

  const res = await fetch(
    `${baseUrl}/api/admin/submissions/${encodeURIComponent(submissionId)}`,
    {
      cache: "no-store",
      headers: cookieHeader
        ? {
            Cookie: cookieHeader,
          }
        : undefined,
    }
  );

  const text = await res.text();

  let payload: SubmissionDetailData | null = null;

  try {
    payload = JSON.parse(text) as SubmissionDetailData;
  } catch {
    payload = null;
  }

  if (res.status === 404) {
    return {
      ok: false as const,
      notFound: true as const,
      message: "not found",
    };
  }

  if (!res.ok || !payload?.ok || !payload.submission) {
    return {
      ok: false as const,
      notFound: false as const,
      message:
        payload?.message ||
        "提出詳細の取得に失敗しました。APIレスポンスを確認してください。",
      raw: text,
    };
  }

  return {
    ok: true as const,
    submission: payload.submission,
    answers: Array.isArray(payload.answers) ? payload.answers : [],
    result: payload.result ?? null,
    histories: Array.isArray(payload.histories) ? payload.histories : [],
  };
}

export default async function AdminSubmissionDetailPage(props: PageProps) {
  const adminSession = await getAdminSession();

  if (!adminSession) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <section className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">提出詳細</h1>
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              管理者ログインが必要です。
            </div>
          </section>
        </div>
      </main>
    );
  }

  const params = await props.params;
  const result = await fetchSubmissionDetail(params.submissionId);

  if (result.notFound) {
    notFound();
  }

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-slate-900">提出詳細</h1>
              <Link
                href="/admin/submissions"
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                ← 提出一覧へ
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {result.message}
            </div>

            {"raw" in result ? (
              <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-700">
                  デバッグ用レスポンスを表示
                </summary>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs text-slate-600">
                  {result.raw}
                </pre>
              </details>
            ) : null}
          </section>
        </div>
      </main>
    );
  }

  return (
    <AdminSubmissionDetailClient
      submission={result.submission}
      answers={result.answers}
      result={result.result}
      histories={result.histories}
    />
  );
}