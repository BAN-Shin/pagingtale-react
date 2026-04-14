"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

type Props = {
  submission: {
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
  answers: SubmissionDetailAnswer[];
  result: {
    id: number;
    submissionId: number;
    studentId: number | null;
    classId: number | null;
    testId: string | null;
    score: number | null;
    total: number | null;
    submittedAt: string | null;
  } | null;
  histories: Array<{
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
  }>;
};

type GradeRowState = {
  answerId: number;
  manualMark: string;
  manualScore: string;
  teacherComment: string;
};

function formatDateTime(value: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

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

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function buildInitialGradeRows(answers: SubmissionDetailAnswer[]): GradeRowState[] {
  return answers.map((answer) => ({
    answerId: answer.id,
    manualMark: answer.manualMark ?? "",
    manualScore: answer.manualScore == null ? "" : String(answer.manualScore),
    teacherComment: answer.teacherComment ?? "",
  }));
}

export default function AdminSubmissionDetailClient({
  submission,
  answers,
  result,
  histories,
}: Props) {
  const router = useRouter();
  const [gradeRows, setGradeRows] = useState<GradeRowState[]>(
    buildInitialGradeRows(answers)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const scorePreview = useMemo(() => {
    const total = answers.reduce((sum, answer) => sum + (answer.points ?? 0), 0);

    const score = answers.reduce((sum, answer) => {
      const row = gradeRows.find((item) => item.answerId === answer.id);

      const manualMark = normalizeText(row?.manualMark);
      const manualScoreText = normalizeText(row?.manualScore);
      const manualScore =
        manualScoreText && Number.isFinite(Number(manualScoreText))
          ? Math.max(0, Math.floor(Number(manualScoreText)))
          : null;

      if (manualScore != null) {
        return sum + manualScore;
      }

      const mark = manualMark || answer.manualMark || answer.mark || "";
      return sum + (mark === "○" ? answer.points : 0);
    }, 0);

    return { score, total };
  }, [answers, gradeRows]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toastMessage]);

  function updateGradeRow(
    answerId: number,
    key: keyof Omit<GradeRowState, "answerId">,
    value: string
  ) {
    setGradeRows((prev) =>
      prev.map((row) =>
        row.answerId === answerId
          ? {
              ...row,
              [key]: value,
            }
          : row
      )
    );
  }

  function applyManualMarkToAll(mark: string) {
    setGradeRows((prev) =>
      prev.map((row) => ({
        ...row,
        manualMark: mark,
      }))
    );
  }

  function clearAllManualGrades() {
    setGradeRows((prev) =>
      prev.map((row) => ({
        ...row,
        manualMark: "",
        manualScore: "",
        teacherComment: "",
      }))
    );
  }

  async function handleSaveGrades() {
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const payload = {
        answers: gradeRows.map((row) => ({
          answerId: row.answerId,
          manualMark: normalizeText(row.manualMark) || null,
          manualScore: normalizeText(row.manualScore)
            ? Math.max(0, Math.floor(Number(row.manualScore)))
            : null,
          teacherComment: normalizeText(row.teacherComment) || null,
        })),
      };

      const response = await fetch(
        `/api/admin/submissions/${submission.id}/grade`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const text = await response.text();

      let parsed:
        | {
            ok?: boolean;
            message?: string;
            error?: string;
          }
        | null = null;

      try {
        parsed = JSON.parse(text) as {
          ok?: boolean;
          message?: string;
          error?: string;
        };
      } catch {
        parsed = null;
      }

      if (!response.ok || !parsed?.ok) {
        setSaveError(parsed?.message || "手動採点の保存に失敗しました。");
        return;
      }

      const message = parsed.message || "手動採点を保存しました。";
      setSaveMessage(message);
      setToastMessage(message);
      router.refresh();
    } catch (error) {
      console.error("grade save error:", error);
      setSaveError("手動採点の保存中にエラーが発生しました。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      {toastMessage ? (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
            {toastMessage}
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">提出詳細</h1>
              <p className="text-sm text-slate-600">
                提出情報、回答一覧、採点結果、履歴を確認できます。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/submissions"
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                ← 提出一覧へ
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">提出情報</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500">提出ID</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {submission.id}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500">提出日時</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDateTime(submission.submittedAt || submission.createdAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500">クラス</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {submission.className || "-"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  classId: {submission.classId ?? "-"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500">受験者</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {submission.studentNumber} / {submission.studentName}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500">教材</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {submission.bookId}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500">テスト</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {submission.testTitle || "-"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {submission.testId || "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">集計</h2>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500">保存済み得点</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {formatScore(result?.score ?? null, result?.total ?? null)}
                </div>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <div className="text-xs font-bold text-sky-700">入力中プレビュー</div>
                <div className="mt-1 text-xl font-bold text-sky-900">
                  {formatScore(scorePreview.score, scorePreview.total)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyManualMarkToAll("○")}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  全て ○
                </button>

                <button
                  type="button"
                  onClick={() => applyManualMarkToAll("×")}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  全て ×
                </button>

                <button
                  type="button"
                  onClick={() => applyManualMarkToAll("△")}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  全て △
                </button>

                <button
                  type="button"
                  onClick={() => applyManualMarkToAll("□")}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  全て □
                </button>
              </div>

              <button
                type="button"
                onClick={() => clearAllManualGrades()}
                className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                一括クリア
              </button>

              <button
                type="button"
                onClick={() => void handleSaveGrades()}
                disabled={isSaving}
                className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "保存中..." : "手動採点を保存"}
              </button>

              {saveMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {saveMessage}
                </div>
              ) : null}

              {saveError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {saveError}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">回答一覧・手動採点</h2>
            <div className="text-sm text-slate-500">{answers.length}件</div>
          </div>

          {answers.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              回答データはありません。
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {answers.map((answer) => {
                const row = gradeRows.find((item) => item.answerId === answer.id) ?? {
                  answerId: answer.id,
                  manualMark: "",
                  manualScore: "",
                  teacherComment: "",
                };

                return (
                  <div
                    key={answer.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="text-xs font-bold text-slate-500">
                        page: {answer.page ?? "-"}
                      </div>
                      <div className="text-xs font-bold text-slate-500">
                        questionId: {answer.questionId}
                      </div>
                      <div className="text-xs font-bold text-slate-500">
                        自動判定: {answer.mark || "-"}
                      </div>
                      <div className="text-xs font-bold text-slate-500">
                        配点: {answer.points}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div>
                          <div className="mb-1 text-xs font-bold text-slate-600">
                            問題
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm whitespace-pre-wrap break-words text-slate-900">
                            {normalizeText(answer.prompt) || "-"}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-xs font-bold text-slate-600">
                            生徒解答
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm whitespace-pre-wrap break-words text-slate-900">
                            {normalizeText(answer.answer) || "-"}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-xs font-bold text-slate-600">
                            正答
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm whitespace-pre-wrap break-words text-slate-700">
                            {normalizeText(answer.correctAnswer) || "-"}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-bold text-slate-600">
                              手動判定
                            </label>
                            <select
                              value={row.manualMark}
                              onChange={(e) =>
                                updateGradeRow(answer.id, "manualMark", e.target.value)
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                            >
                              <option value="">未設定</option>
                              <option value="○">○</option>
                              <option value="△">△</option>
                              <option value="×">×</option>
                              <option value="□">□</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-bold text-slate-600">
                              手動点
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={row.manualScore}
                              onChange={(e) =>
                                updateGradeRow(answer.id, "manualScore", e.target.value)
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                              placeholder="未設定"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-600">
                            コメント
                          </label>
                          <textarea
                            value={row.teacherComment}
                            onChange={(e) =>
                              updateGradeRow(
                                answer.id,
                                "teacherComment",
                                e.target.value
                              )
                            }
                            rows={4}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                            placeholder="採点コメント"
                          />
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-6 text-slate-600">
                          回答日時: {formatDateTime(answer.answeredAt)}
                          <br />
                          保存済み手動判定: {answer.manualMark || "-"}
                          <br />
                          保存済み手動点:{" "}
                          {answer.manualScore == null ? "-" : answer.manualScore}
                          <br />
                          手動採点済み: {answer.isManuallyGraded ? "はい" : "いいえ"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">採点結果</h2>

            {!result ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                採点結果はまだ保存されていません。
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold text-slate-500">score</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {result.score ?? "-"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold text-slate-500">total</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {result.total ?? "-"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <div className="text-xs font-bold text-slate-500">submittedAt</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDateTime(result.submittedAt)}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">履歴</h2>

            {histories.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                履歴データはありません。
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {histories.map((history) => (
                  <div
                    key={history.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <div className="font-bold text-slate-900">
                        {history.testTitle || history.testId || "-"}
                      </div>
                      <div className="text-slate-600">
                        得点: {formatScore(history.score, history.total)}
                      </div>
                      <div className="text-slate-600">
                        受験回数: {history.attemptNumber ?? "-"}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-slate-500">
                      提出日時: {formatDateTime(history.submittedAt)} / 記録日時:{" "}
                      {formatDateTime(history.recordedAt)}
                    </div>

                    {history.note ? (
                      <div className="mt-2 text-xs font-semibold text-slate-600">
                        note: {history.note}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}