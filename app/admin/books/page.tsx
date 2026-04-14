import Link from "next/link";
import Image from "next/image";
import { promises as fs } from "fs";
import path from "path";

type BookMeta = {
  title?: string;
  description?: string;
  thumbnail?: string;
  order?: number;
};

type BookItem = {
  bookId: string;
  title: string;
  description: string;
  thumbnail: string | null;
  order: number;
};

function formatBookTitle(bookId: string): string {
  return bookId
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readBookMeta(bookDir: string): Promise<BookMeta | null> {
  const metaPath = path.join(bookDir, "meta.json");

  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    const parsed = JSON.parse(raw) as BookMeta;
    return parsed;
  } catch {
    return null;
  }
}

async function loadBooksFromPublic(): Promise<BookItem[]> {
  const booksDir = path.join(process.cwd(), "public", "book-assets");

  try {
    const entries = await fs.readdir(booksDir, { withFileTypes: true });

    const bookDirs = entries.filter(
      (entry) => entry.isDirectory() && entry.name !== "pics"
    );

    const books = await Promise.all(
      bookDirs.map(async (entry, index) => {
        const bookId = entry.name;
        const bookDir = path.join(booksDir, bookId);
        const meta = await readBookMeta(bookDir);

        return {
          bookId,
          title: meta?.title?.trim() || formatBookTitle(bookId),
          description: meta?.description?.trim() || "教材を開きます。",
          thumbnail: meta?.thumbnail?.trim() || null,
          order:
            typeof meta?.order === "number" && Number.isFinite(meta.order)
              ? meta.order
              : 100000 + index,
        };
      })
    );

    books.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.bookId.localeCompare(b.bookId, "ja");
    });

    return books;
  } catch (error) {
    console.error("public/book-assets 読み込み失敗:", error);
    return [];
  }
}

export default async function AdminBooksPage() {
  const books = await loadBooksFromPublic();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">教材一覧（管理）</h1>
            <p className="mt-2 text-sm text-slate-600">
              public\book-assets 配下の教材フォルダを表示しています。pics は除外しています。
            </p>
          </div>

          <Link
            href="/admin/classes"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            ← クラス一覧へ
          </Link>
        </div>

        {books.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            教材フォルダが見つかりません
          </div>
        ) : (
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
                      alt={book.title}
                      fill
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
                    教材を開く →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}