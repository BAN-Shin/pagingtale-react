"use client";

import { useState } from "react";
import Link from "next/link";

type BookRow = {
  id: number;
  bookId: string;
  title: string;
  ownerTeacherId: number;
  ownerTeacherName: string | null;
  mode: string;
  isPublished: boolean;
  pageCount: number;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

type TeacherBooksListProps = {
  books: BookRow[];
  currentTeacherId: number | null;
  currentRole: string | null;
};

function formatDate(value: string | Date | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("ja-JP");
}

export default function TeacherBooksList({
  books,
  currentTeacherId,
  currentRole,
}: TeacherBooksListProps) {
  const [items, setItems] = useState<BookRow[]>(books);
  const [pendingBookId, setPendingBookId] = useState<string | null>(null);

  async function switchMode(bookId: string, mode: "practice" | "test") {
    try {
      setPendingBookId(bookId);

      const res = await fetch(`/api/teacher/books/${encodeURIComponent(bookId)}/mode`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode }),
      });

      const text = await res.text();
      let payload: { ok?: boolean; mode?: string; message?: string } | null = null;

      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }

      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.message || "モード切替に失敗しました。");
      }

      setItems((prev) =>
        prev.map((item) =>
          item.bookId === bookId
            ? {
                ...item,
                mode: payload?.mode ?? mode,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : "モード切替に失敗しました。");
    } finally {
      setPendingBookId(null);
    }
  }

  return (
    <div className="space-y-4">
      {items.map((book) => {
        const canEdit =
          currentRole === "admin" || book.ownerTeacherId === currentTeacherId;

        return (
          <div
            key={book.bookId}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-800">{book.title}</h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {book.bookId}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      book.mode === "test"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    {book.mode}
                  </span>
                </div>

                <div className="text-sm text-slate-600">
                  作成者: {book.ownerTeacherName ?? "-"}
                </div>

                <div className="text-sm text-slate-600">
                  ページ数: {book.pageCount}
                </div>

                <div className="text-sm text-slate-600">
                  更新日時: {formatDate(book.updatedAt)}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/books/${encodeURIComponent(book.bookId)}`}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  開く
                </Link>

                {canEdit ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void switchMode(book.bookId, "practice")}
                      disabled={pendingBookId === book.bookId}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
                    >
                      practice にする
                    </button>

                    <button
                      type="button"
                      onClick={() => void switchMode(book.bookId, "test")}
                      disabled={pendingBookId === book.bookId}
                      className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
                    >
                      test にする
                    </button>
                  </>
                ) : (
                  <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-500">
                    他の教師の教材
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}