"use client";

import { useEffect, useState } from "react";

type Props = {
  message: string;
  undo?: string;
  classId: number;
  q: string;
  studentId: number;
  prevStudentNumber: string;
  prevStudentName: string;
  undoAction: (formData: FormData) => Promise<void>;
};

export default function AutoHideToast({
  message,
  undo,
  classId,
  q,
  studentId,
  prevStudentNumber,
  prevStudentName,
  undoAction,
}: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const canUndo = undo === "add" || undo === "update";

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-[min(92vw,420px)] rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur animate-[toast-in_0.2s_ease-out]">
      {canUndo ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 break-words">{message}</div>

          <form action={undoAction}>
            <input type="hidden" name="undo" value={undo} />
            <input type="hidden" name="classId" value={classId} />
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="studentId" value={studentId || ""} />
            <input
              type="hidden"
              name="prevStudentNumber"
              value={prevStudentNumber}
            />
            <input
              type="hidden"
              name="prevStudentName"
              value={prevStudentName}
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/15"
            >
              元に戻す
            </button>
          </form>
        </div>
      ) : (
        <div className="break-words">{message}</div>
      )}
    </div>
  );
}