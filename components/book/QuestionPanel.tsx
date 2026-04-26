"use client";

import { useMemo, useState } from "react";
import type {
  AnswerResult,
  QuestionItem,
  QuestionMode,
  StoredAnswer,
} from "@/lib/pagingtale/types";

type QuestionPanelProps = {
  question: QuestionItem;
  storedAnswer?: StoredAnswer;
  mode: QuestionMode;
  onSubmit: (value: string, result: AnswerResult) => void;
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeAnswerValue(value: string): string {
  console.log("normalize called", value);
  return normalizeText(value)
    .replace(/，/g, ",")
    .replace(/：/g, ":")   // 全角コロン統一
    .replace(/\r?\n/g, "") // 改行削除
    .trim();
}
// debug
function splitCorrectAnswers(value: string): string[] {
  return normalizeAnswerValue(value)
    .split(",")
    .map((item) => normalizeText(item))
    .filter((item) => item.length > 0);
}

function judgeAnswer(question: QuestionItem, value: string): AnswerResult {
  const input = normalizeAnswerValue(value);
  const answers = splitCorrectAnswers(question.correctAnswer ?? "");

  if (!input) return "unanswered";

  if (answers.length === 0 || question.judgeMode === "none") {
    return "unanswered";
  }

  if (question.judgeMode === "includes") {
    return answers.some(
      (answer) => input.includes(answer) || answer.includes(input)
    )
      ? "correct"
      : "incorrect";
  }

  return answers.includes(input) ? "correct" : "incorrect";
}

export default function QuestionPanel({
  question,
  storedAnswer,
  mode,
  onSubmit,
}: QuestionPanelProps) {
  const [draftValue, setDraftValue] = useState<string>(storedAnswer?.value ?? "");

  const value = mode === "test" ? (storedAnswer?.value ?? "") : draftValue;

  const currentResult = useMemo<AnswerResult>(() => {
    return storedAnswer?.result ?? "unanswered";
  }, [storedAnswer]);

  const resultLabel =
    question.judgeMode === "none"
      ? (value && value.trim() !== "" ? "解答済" : "未回答")
      : currentResult === "correct"
        ? "正解"
        : currentResult === "incorrect"
          ? "不正解"
          : "未回答";

  const resultClassName =
    currentResult === "correct"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : currentResult === "incorrect"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

  function handleJudge() {
    const result = judgeAnswer(question, value);
    onSubmit(value, result);
  }

  function handleSaveOnly(nextValue?: string) {
    const safeValue = typeof nextValue === "string" ? nextValue : value;
    onSubmit(safeValue, storedAnswer?.result ?? "unanswered");
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white/95 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur">
      <div className="mb-3 text-sm font-bold text-slate-500">問題</div>

      <div className="mb-3 text-base font-semibold leading-7 text-slate-900">
        {question.prompt}
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => {
          const nextValue = e.target.value;

          if (mode === "practice") {
            setDraftValue(nextValue);
          }

          if (mode === "test") {
            handleSaveOnly(nextValue);
          }
        }}
        onBlur={() => {
          if (mode === "test") {
            handleSaveOnly();
          }
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();

          if (mode === "practice") {
            handleJudge();
          } else {
            handleSaveOnly();
          }
        }}
        placeholder={
          question.placeholder ??
          (mode === "practice" ? "ここに入力して Enter" : "ここに入力")
        }
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
      />

      {mode === "practice" && (
        <>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${resultClassName}`}
            >
              {resultLabel}
            </div>

          {question.judgeMode !== "none" && (
            <button
              type="button"
              onClick={handleJudge}
              className="rounded-xl bg-[#4a3f39] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#5a4d46]"
            >
              判定する
            </button>
          )}
          </div>

          {question.explanation ? (
            <div className="mt-3 text-xs leading-6 text-slate-500">
              {question.explanation}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}