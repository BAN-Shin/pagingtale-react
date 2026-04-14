"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type BookItem = {
  bookId: string;
  title?: string;
  description?: string;
  thumbnail?: string | null;
  order?: number;
};

type BooksManifest = {
  books?: BookItem[];
};

function formatBookTitle(bookId: string): string {
  return bookId
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBooks(value: unknown): BookItem[] {
  if (!value || typeof value !== "object") return [];

  const raw = value as BooksManifest;
  if (!Array.isArray(raw.books)) return [];

  return raw.books
    .filter((item): item is BookItem => {
      return !!item && typeof item === "object" && typeof item.bookId === "string";
    })
    .map((item, index) => {
      const bookId = item.bookId.trim();

      return {
        bookId,
        title:
          typeof item.title === "string" && item.title.trim()
            ? item.title.trim()
            : formatBookTitle(bookId),
        description:
          typeof item.description === "string" && item.description.trim()
            ? item.description.trim()
            : "教材を開きます。",
        thumbnail:
          typeof item.thumbnail === "string" && item.thumbnail.trim()
            ? item.thumbnail.trim()
            : `/book-assets/pics/${bookId}.png`,
        order:
          typeof item.order === "number" && Number.isFinite(item.order)
            ? item.order
            : 100000 + index,
      };
    })
    .sort((a, b) => {
      const orderA =
        typeof a.order === "number" && Number.isFinite(a.order) ? a.order : 100000;
      const orderB =
        typeof b.order === "number" && Number.isFinite(b.order) ? b.order : 100000;

      if (orderA !== orderB) return orderA - orderB;
      return a.bookId.localeCompare(b.bookId, "ja");
    });
}

export default function AdminBooksPage() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBooks() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const response = await fetch("/book-assets/books.json", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("book-assets/books.json の読み込みに失敗しました。");
        }

        const json = (await response.json()) as unknown;
        const safeBooks = normalizeBooks(json);

        if (cancelled) return;
        setBooks(safeBooks);
      } catch (error) {
        if (cancelled) return;

        console.error("book-assets/books.json 読み込み失敗:", error);
        setBooks([]);
        setLoadError(
          error instanceof Error
            ? error.message
            : "教材一覧の読み込みに失敗しました。"
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBooks();

    return () => {
      cancelled = true;
    };
  }, []);

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          教材一覧を読み込み中です…
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          <div className="font-bold">教材一覧の読み込みに失敗しました。</div>
          <div className="mt-2 break-all">{loadError}</div>
          <div className="mt-3 text-xs text-rose-600">
            public\book-assets\books.json を確認してください。
          </div>
        </div>
      );
    }

    if (books.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          教材一覧がありません。public\book-assets\books.json を用意してください。
        </div>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => (
          <Link
            key={book.bookId}
            href={`/books/${book.bookId}`}
            className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow"
          >
            {book.thumbnail ? (
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
                <Image
                  src={book.thumbnail}
                  alt={book.title ?? book.bookId}
                  fill
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                  className="object-cover transition group-hover:scale-[1.02]"
                />
              </div>
            ) : (
              <div className="flex aspect-[16/9] w-full items-center justify-center bg-slate-100 text-sm font-bold text-slate-400">
                NO IMAGE
              </div>
            )}

            <div className="space-y-2 p-5">
              <div className="text-lg font-bold text-slate-900">
                {book.title ?? formatBookTitle(book.bookId)}
              </div>

              <div className="text-xs text-slate-500">{book.bookId}</div>

              <div className="line-clamp-2 text-sm text-slate-600">
                {book.description ?? "教材を開きます。"}
              </div>

              <div className="pt-2 text-xs font-bold text-slate-500 transition group-hover:text-slate-700">
                教材を開く →
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  }, [books, isLoading, loadError]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">教材一覧（管理）</h1>
            <p className="mt-2 text-sm text-slate-600">
              public\book-assets\books.json をもとに教材一覧を表示します。
            </p>
          </div>

          <Link
            href="/admin/classes"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            ← クラス一覧へ
          </Link>
        </div>

        {content}
      </div>
    </main>
  );
}