"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ManualMark = "" | "○" | "△" | "×";

type Props = {
  submissionId: number;
  answerId: number;
  points: number;
  manualIndex: number;
  manualTargetCount: number;
  initialManualMark: string | null;
  initialManualScore: number | null;
  initialTeacherComment: string | null;
  initialIsManuallyGraded: boolean;
  gradedAtLabel: string;
  previousManualHref: string | null;
  nextManualHref: string | null;
  nextRedirectHref: string;
};

type ToastState =
  | {
      kind: "saved";
      message: string;
    }
  | {
      kind: "reverted";
      message: string;
    }
  | {
      kind: "error";
      message: string;
    }
  | null;

function normalizeManualMark(value: string | null | undefined): ManualMark {
  if (value === "○" || value === "△" || value === "×") return value;
  return "";
}

function parseScoreInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;

  return num;
}

export default function ManualGradeForm({
  submissionId,
  answerId,
  points,
  manualIndex,
  manualTargetCount,
  initialManualMark,
  initialManualScore,
  initialTeacherComment,
  initialIsManuallyGraded,
  gradedAtLabel,
  previousManualHref,
  nextManualHref,
  nextRedirectHref,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initialMark = normalizeManualMark(initialManualMark);
  const initialScore =
    typeof initialManualScore === "number" ? String(initialManualScore) : "";
  const initialComment = initialTeacherComment ?? "";

  const [manualMark, setManualMark] = useState<ManualMark>(initialMark);
  const [manualScore, setManualScore] = useState<string>(initialScore);
  const [teacherComment, setTeacherComment] = useState<string>(initialComment);
  const [isManuallyGraded, setIsManuallyGraded] = useState<boolean>(
    initialIsManuallyGraded
  );

  const [toast, setToast] = useState<ToastState>(null);

  const redirectTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  function clearRedirectTimer() {
    if (redirectTimerRef.current !== null) {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  }

  function clearToastTimer() {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }

  function showToast(nextToast: ToastState, autoHideMs = 6000) {
    clearToastTimer();
    setToast(nextToast);

    if (nextToast) {
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, autoHideMs);
    }
  }

  async function patchManualGrade(payload: {
    manualMark: string | null;
    manualScore: number | null;
    teacherComment: string | null;
  }) {
    const response = await fetch(
      `/api/admin/submissions/${submissionId}/answers/${answerId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      }
    );

    const text = await response.text();

    let data:
      | {
          ok?: boolean;
          message?: string;
        }
      | null = null;

    try {
      data = JSON.parse(text) as {
        ok?: boolean;
        message?: string;
      };
    } catch {
      data = null;
    }

    if (!response.ok || !data?.ok) {
      throw new Error(data?.message || "手動採点の保存に失敗しました。");
    }
  }

  async function handleSave() {
    const parsedScore = parseScoreInput(manualScore);

    if (manualScore.trim().length > 0 && parsedScore === null) {
      showToast(
        {
          kind: "error",
          message: "手動点は数値で入力してください。",
        },
        7000
      );
      return;
    }

    if (parsedScore !== null && parsedScore < 0) {
      showToast(
        {
          kind: "error",
          message: "手動点は 0 以上で入力してください。",
        },
        7000
      );
      return;
    }

    if (parsedScore !== null && parsedScore > points) {
      showToast(
        {
          kind: "error",
          message: `手動点は ${points} 点以下で入力してください。`,
        },
        7000
      );
      return;
    }

    const payload = {
      manualMark: manualMark || null,
      manualScore: parsedScore,
      teacherComment:
        teacherComment.trim().length > 0 ? teacherComment.trim() : null,
    };

    try {
      await patchManualGrade(payload);

      setIsManuallyGraded(true);

      showToast({
        kind: "saved",
        message: "採点を保存しました。右下の「元に戻す」で取り消せます。",
      });

      clearRedirectTimer();
      redirectTimerRef.current = window.setTimeout(() => {
        router.push(nextRedirectHref);
      }, 1800);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "手動採点の保存に失敗しました。";

      showToast(
        {
          kind: "error",
          message,
        },
        7000
      );
    }
  }

  async function handleUndo() {
    clearRedirectTimer();

    try {
      await patchManualGrade({
        manualMark: initialMark || null,
        manualScore:
          initialScore.trim().length > 0 ? Number(initialScore) : null,
        teacherComment: initialComment.trim().length > 0 ? initialComment : null,
      });

      setManualMark(initialMark);
      setManualScore(initialScore);
      setTeacherComment(initialComment);
      setIsManuallyGraded(initialIsManuallyGraded);

      showToast({
        kind: "reverted",
        message: "保存前の状態に戻しました。",
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "元に戻す処理に失敗しました。";

      showToast(
        {
          kind: "error",
          message,
        },
        7000
      );
    }
  }

  useEffect(() => {
    return () => {
      clearRedirectTimer();
      clearToastTimer();
    };
  }, []);

  const currentLabel = isManuallyGraded
    ? `${manualMark || "-"} / ${manualScore.trim() || "-"}点`
    : "未採点";

  const disabled = isPending;

  return (
    <>
      <div className="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-800">
              手動採点対象
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
              問 {manualIndex + 1} / {manualTargetCount}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
              現在: {currentLabel}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
              採点日時: {gradedAtLabel}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={previousManualHref ?? "#"}
              aria-disabled={!previousManualHref}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                previousManualHref
                  ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
              }`}
            >
              ← 前問
            </a>

            <a
              href={nextManualHref ?? "#"}
              aria-disabled={!nextManualHref}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                nextManualHref
                  ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
              }`}
            >
              次問 →
            </a>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[120px_120px_1fr]">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              手動記号
            </label>
            <select
              name="manualMark"
              value={manualMark}
              onChange={(event) =>
                setManualMark(
                  normalizeManualMark(event.currentTarget.value) as ManualMark
                )
              }
              disabled={disabled}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">未設定</option>
              <option value="○">○</option>
              <option value="△">△</option>
              <option value="×">×</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              手動点
            </label>
            <input
              type="number"
              name="manualScore"
              min={0}
              max={points}
              step={1}
              value={manualScore}
              onChange={(event) => setManualScore(event.currentTarget.value)}
              disabled={disabled}
              placeholder={`0〜${points}`}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              コメント
            </label>
            <textarea
              name="teacherComment"
              value={teacherComment}
              onChange={(event) => setTeacherComment(event.currentTarget.value)}
              rows={3}
              disabled={disabled}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="教師コメント"
            />
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-white p-4">
          <div className="mb-3 text-xs font-semibold text-slate-500">
            採点内容を入力したら保存してください
          </div>

          <button
            type="button"
            onClick={() => startTransition(handleSave)}
            disabled={disabled}
            className="block w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-black shadow-md transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "保存中..." : "この採点を保存"}
          </button>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-2xl ${
              toast.kind === "error"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 leading-6">{toast.message}</div>

              {toast.kind === "saved" ? (
                <button
                  type="button"
                  onClick={() => startTransition(handleUndo)}
                  disabled={isPending}
                  className="rounded-lg border border-slate-300 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  元に戻す
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}