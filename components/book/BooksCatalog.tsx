"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BookMode = "dev" | "practice" | "test";

type TeacherSessionLite = {
  teacherId: number;
  teacherName: string;
  role: "teacher" | "admin";
} | null;

type BookItem = {
  bookId: string;
  title: string;
  description: string;
  thumbnail: string | null;
  order: number;
  mode: BookMode;
  isPublished: boolean;
  pageCount: number;
  ownerTeacherId: number | null;
  ownerTeacherName: string | null;
};

type BooksManifestItem = {
  bookId?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  order?: number;
  mode?: string;
};

type BooksManifestResponse = {
  books?: BooksManifestItem[];
};

type TeacherBookMeta = {
  bookId: string;
  title: string;
  mode: string;
  isPublished: boolean;
  pageCount: number;
  ownerTeacherId: number | null;
  ownerTeacherName: string | null;
};

type TeacherBooksResponse = {
  ok?: boolean;
  books?: TeacherBookMeta[];
  currentTeacherId?: number | null;
  currentRole?: string | null;
};

type BooksCatalogProps = {
  teacherSession?: TeacherSessionLite;
  adminMode?: boolean;
};

function formatBookTitle(bookId: string): string {
  return bookId.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeMode(value: unknown): BookMode {
  const mode = String(value ?? "").trim().toLowerCase();

  if (mode === "test") return "test";
  if (mode === "practice") return "practice";
  return "dev";
}

function isVisibleForStudent(book: BookItem): boolean {
  return book.mode === "practice" || book.mode === "test";
}

function toBookItem(item: BooksManifestItem, index: number): BookItem | null {
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

  const mode = normalizeMode(item.mode);

  return {
    bookId,
    title,
    description,
    thumbnail,
    order,
    mode,
    isPublished: mode !== "dev",
    pageCount: 0,
    ownerTeacherId: null,
    ownerTeacherName: null,
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

function mergeBookMeta(
  catalogBooks: BookItem[],
  teacherBooks: TeacherBookMeta[]
): BookItem[] {
  const metaMap = new Map<string, TeacherBookMeta>();

  teacherBooks.forEach((item) => {
    const key = String(item.bookId ?? "").trim();
    if (key) {
      metaMap.set(key, item);
    }
  });

  return catalogBooks.map((book) => {
    const meta = metaMap.get(book.bookId);

    if (!meta) {
      return book;
    }

    const mode = normalizeMode(meta.mode);

    return {
      ...book,
      title: String(meta.title ?? "").trim() || book.title,
      mode,
      isPublished:
        typeof meta.isPublished === "boolean"
          ? meta.isPublished
          : mode !== "dev",
      pageCount:
        typeof meta.pageCount === "number" && Number.isFinite(meta.pageCount)
          ? meta.pageCount
          : 0,
      ownerTeacherId:
        typeof meta.ownerTeacherId === "number" ? meta.ownerTeacherId : null,
      ownerTeacherName:
        typeof meta.ownerTeacherName === "string"
          ? meta.ownerTeacherName
          : null,
    };
  });
}

function getModeLabel(mode: BookMode): string {
  if (mode === "dev") return "開発中";
  if (mode === "practice") return "練習公開";
  return "テスト公開";
}

function getModeBadgeClass(mode: BookMode): string {
  if (mode === "dev") return "bg-slate-200 text-slate-700";
  if (mode === "test") return "bg-rose-100 text-rose-700";
  return "bg-sky-100 text-sky-700";
}

export default function BooksCatalog({
  teacherSession = null,
  adminMode = false,
}: BooksCatalogProps) {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingBookId, setPendingBookId] = useState<string | null>(null);

  const visibleBooks = useMemo(() => {
    if (adminMode) {
      return books;
    }

    return books.filter(isVisibleForStudent);
  }, [adminMode, books]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const manifestResponse = await fetch("/book-assets/books.json", {
          cache: "no-store",
        });

        if (!manifestResponse.ok) {
          throw new Error(
            `books.json の取得に失敗しました (${manifestResponse.status})`
          );
        }

        const manifestData =
          (await manifestResponse.json()) as BooksManifestResponse;

        let nextBooks = normalizeBooks(manifestData);

        const metaApiUrl = teacherSession ? "/api/teacher/books" : "/api/books";

        const metaResponse = await fetch(metaApiUrl, {
          cache: "no-store",
        });

        if (!metaResponse.ok) {
          throw new Error(
            `${metaApiUrl} の取得に失敗しました (${metaResponse.status})`
          );
        }

        const metaData = (await metaResponse.json()) as TeacherBooksResponse;

        const metaBooks = Array.isArray(metaData.books)
          ? metaData.books
          : [];

        nextBooks = mergeBookMeta(nextBooks, metaBooks);

        if (!alive) return;
        setBooks(nextBooks);
      } catch (err) {
        console.error("BooksCatalog load error:", err);

        if (!alive) return;

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
  }, [teacherSession]);

  async function switchBookMode(bookId: string, mode: BookMode) {
    try {
      setPendingBookId(bookId);

      const response = await fetch(
        `/api/teacher/books/${encodeURIComponent(bookId)}/mode`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mode }),
        }
      );

      const text = await response.text();

      let payload:
        | { ok?: boolean; message?: string; mode?: string }
        | null = null;

      try {
        payload = JSON.parse(text) as {
          ok?: boolean;
          message?: string;
          mode?: string;
        };
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "モード切替に失敗しました。");
      }

      setBooks((prev) =>
        prev.map((book) =>
          book.bookId === bookId
            ? {
                ...book,
                mode: normalizeMode(payload?.mode ?? mode),
                isPublished: normalizeMode(payload?.mode ?? mode) !== "dev",
              }
            : book
        )
      );
    } catch (err) {
      console.error("switchBookMode error:", err);
      window.alert(
        err instanceof Error ? err.message : "モード切替に失敗しました。"
      );
    } finally {
      setPendingBookId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {adminMode ? "教材管理一覧" : "教材を選ぶ"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {adminMode
              ? "開発中の教材も含めて表示します。dev / practice / test を切り替えられます。"
              : "公開中の教材だけを表示しています。"}
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
      ) : visibleBooks.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          表示できる教材がありません。
          <br />
          {adminMode
            ? "public\\book-assets\\books.json と DB の books テーブルを確認してください。"
            : "教師が practice または test に切り替えると、ここに表示されます。"}
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleBooks.map((book) => {
            const canEditMode = Boolean(
              teacherSession &&
                (teacherSession.role === "admin" ||
                  (book.ownerTeacherId !== null &&
                    book.ownerTeacherId === teacherSession.teacherId))
            );

            return (
              <div
                key={book.bookId}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow"
              >
                <Link href={`/books/${book.bookId}`} className="block">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-bold text-slate-900">
                        {book.title}
                      </div>

                      {teacherSession ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${getModeBadgeClass(
                            book.mode
                          )}`}
                        >
                          {getModeLabel(book.mode)}
                        </span>
                      ) : null}
                    </div>

                    <div className="text-xs text-slate-500">{book.bookId}</div>

                    <div className="line-clamp-2 text-sm text-slate-600">
                      {book.description}
                    </div>

                    {teacherSession ? (
                      <div className="space-y-1 pt-1 text-xs text-slate-500">
                        <div>作成者: {book.ownerTeacherName ?? "未設定"}</div>
                        <div>ページ数: {book.pageCount}</div>
                      </div>
                    ) : null}

                    <div className="pt-2 text-xs font-bold text-slate-500 transition group-hover:text-slate-700">
                      開く →
                    </div>
                  </div>
                </Link>

                {teacherSession ? (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-3">
                    {canEditMode ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pendingBookId === book.bookId}
                          onClick={() => void switchBookMode(book.bookId, "dev")}
                          className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                            book.mode === "dev"
                              ? "bg-slate-700 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          } disabled:opacity-60`}
                        >
                          dev
                        </button>

                        <button
                          type="button"
                          disabled={pendingBookId === book.bookId}
                          onClick={() =>
                            void switchBookMode(book.bookId, "practice")
                          }
                          className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                            book.mode === "practice"
                              ? "bg-sky-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          } disabled:opacity-60`}
                        >
                          practice
                        </button>

                        <button
                          type="button"
                          disabled={pendingBookId === book.bookId}
                          onClick={() =>
                            void switchBookMode(book.bookId, "test")
                          }
                          className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                            book.mode === "test"
                              ? "bg-rose-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          } disabled:opacity-60`}
                        >
                          test
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-slate-400">
                        他の教師の教材です
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      )}
    </section>
  );
}