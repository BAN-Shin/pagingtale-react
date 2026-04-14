"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type BookItem = {
  bookId: string;
  title: string;
  description: string;
  thumbnail: string | null;
  order: number;
};

type BooksManifestItem = {
  bookId?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  order?: number;
};

type BooksManifestResponse = {
  books?: BooksManifestItem[];
};

function formatBookTitle(bookId: string): string {
  return bookId.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function toBookItem(
  item: BooksManifestItem,
  index: number
): BookItem | null {
  const bookId = String(item.bookId ?? "").trim();

  if (!bookId) {
    return null;
  }

  const title = String(item.title ?? "").trim() || formatBookTitle(bookId);
  const description =
    String(item.description ?? "").trim() || "教材を開きます。";

  const rawThumbnail = String(item.thumbnail ?? "").trim();
  const thumbnail = rawThumbnail || `/book-assets/pics/${bookId}.png`;

  const order =
    typeof item.order === "number" && Number.isFinite(item.order)
      ? item.order
      : 100000 + index;

  return {
    bookId,
    title,
    description,
    thumbnail,
    order,
  };
}

function normalizeBooks(data: BooksManifestResponse | null): BookItem[] {
  const source = Array.isArray(data?.books) ? data.books : [];

  const books: BookItem[] = [];

  source.forEach((item, index) => {
    const normalized = toBookItem(item, index);
    if (normalized) {
      books.push(normalized);
    }
  });

  books.sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }

    return a.bookId.localeCompare(b.bookId, "ja");
  });

  return books;
}

export default function BooksCatalog() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/book-assets/books.json", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`books.json の取得に失敗しました (${response.status})`);
        }

        const data = (await response.json()) as BooksManifestResponse;
        const nextBooks = normalizeBooks(data);

        if (!alive) {
          return;
        }

        setBooks(nextBooks);
      } catch (err) {
        console.error("BooksCatalog load error:", err);

        if (!alive) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "教材一覧の取得で不明なエラーが発生しました。"
        );
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">教材を選ぶ</h2>
          <p className="mt-1 text-sm text-slate-500">
            閲覧したい教材を選んでください。
          </p>
        </div>
      </div>

      {loading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          教材一覧を読み込んでいます...
        </section>
      ) : error ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-10 text-center text-sm text-red-700 shadow-sm">
          {error}
        </section>
      ) : books.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          表示できる教材がありません。
          <br />
          public\book-assets\books.json を確認してください。
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    alt={book.title}
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
                  {book.title}
                </div>

                <div className="text-xs text-slate-500">{book.bookId}</div>

                <div className="line-clamp-2 text-sm text-slate-600">
                  {book.description}
                </div>

                <div className="pt-2 text-xs font-bold text-slate-500 transition group-hover:text-slate-700">
                  開く →
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </section>
  );
}