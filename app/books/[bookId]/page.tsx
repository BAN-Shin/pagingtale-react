import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";
import BookViewer from "@/components/book/BookViewer";
import BookViewerWithQuiz from "@/components/book/BookViewerWithQuiz";
import { getStudentSession } from "@/lib/student-auth";

type BookPageProps = {
  params: Promise<{
    bookId: string;
  }>;
  searchParams?: Promise<{
    page?: string;
    testId?: string;
  }>;
};

type TocItem = {
  page: number;
  title: string;
};

type BookMeta = {
  bookId?: string;
  totalPages?: number;
  binding?: "rtl" | "ltr";
  startPage?: number;
};

function parseInitialPage(value?: string): number {
  const page = Number(value ?? "1");

  if (!Number.isFinite(page)) {
    return 1;
  }

  return Math.max(1, Math.floor(page));
}

function normalizeBookId(value?: string): string {
  const bookId = (value ?? "").trim();
  return bookId || "pagingtale-book-001";
}

function normalizeTestId(value?: string): string | null {
  const testId = (value ?? "").trim();
  return testId || null;
}

function normalizeTocItems(value: unknown): TocItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const page = Number((item as { page?: unknown }).page);
      const title = String((item as { title?: unknown }).title ?? "").trim();

      if (!Number.isFinite(page) || page <= 0 || !title) {
        return null;
      }

      return {
        page: Math.floor(page),
        title,
      } satisfies TocItem;
    })
    .filter((item): item is TocItem => item !== null);
}

function normalizeBookMeta(value: unknown, fallbackBookId: string): {
  bookId: string;
  totalPages?: number;
  binding?: "rtl" | "ltr";
  startPage?: number;
} {
  if (!value || typeof value !== "object") {
    return { bookId: fallbackBookId };
  }

  const raw = value as Record<string, unknown>;

  return {
    bookId:
      typeof raw.bookId === "string" && raw.bookId.trim()
        ? raw.bookId.trim()
        : fallbackBookId,
    totalPages:
      typeof raw.totalPages === "number" &&
      Number.isFinite(raw.totalPages) &&
      raw.totalPages > 0
        ? Math.floor(raw.totalPages)
        : undefined,
    binding:
      raw.binding === "rtl" || raw.binding === "ltr"
        ? raw.binding
        : undefined,
    startPage:
      typeof raw.startPage === "number" &&
      Number.isFinite(raw.startPage) &&
      raw.startPage > 0
        ? Math.floor(raw.startPage)
        : undefined,
  };
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default async function BookDetailPage(props: BookPageProps) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const session = await getStudentSession();

  async function logoutStudent() {
    "use server";

    const { clearStudentSession } = await import("@/lib/student-auth");
    await clearStudentSession();
  }

  const bookId = normalizeBookId(params.bookId);
  const requestedPage = parseInitialPage(searchParams.page);
  const testId = normalizeTestId(searchParams.testId);

  const bookDir = path.join(process.cwd(), "public", "book-assets", bookId);
  const bookJsonPath = path.join(bookDir, "data", "book.json");
  const tocJsonPath = path.join(bookDir, "data", "toc.json");

  const [bookJson, tocJson] = await Promise.all([
    readJsonFile<BookMeta>(bookJsonPath),
    readJsonFile<unknown>(tocJsonPath),
  ]);

  const bookMeta = normalizeBookMeta(bookJson, bookId);
  const tocItems = normalizeTocItems(tocJson);

  const initialPage =
    requestedPage > 0
      ? requestedPage
      : typeof bookMeta.startPage === "number"
        ? bookMeta.startPage
        : 1;

  const totalPages =
    typeof bookMeta.totalPages === "number" && bookMeta.totalPages > 0
      ? bookMeta.totalPages
      : tocItems.length > 0
        ? Math.max(...tocItems.map((item) => item.page))
        : 1;

  const binding = bookMeta.binding === "ltr" ? "ltr" : "rtl";

  return (
    <main className="relative h-screen w-full bg-white">
      <div className="fixed right-4 top-4 z-50 flex flex-wrap gap-2">
        <Link
          href="/books"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-md transition hover:bg-slate-100"
        >
          ← 教材一覧へ
        </Link>

        {session ? (
          <form action={logoutStudent}>
            <button
              type="submit"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-md transition hover:bg-slate-100"
            >
              ログアウト
            </button>
          </form>
        ) : null}
      </div>

      {session ? (
        <BookViewerWithQuiz
          bookId={bookId}
          initialPage={initialPage}
          testId={testId}
          authenticatedStudentProfile={{
            classId: session.classId,
            studentNumber: session.studentNumber,
            studentName: session.studentName,
          }}
          lockStudentProfile
        />
      ) : (
        <BookViewer
          bookId={bookId}
          initialPage={initialPage}
          tocItems={tocItems}
          totalPages={totalPages}
          binding={binding}
        />
      )}

      {null}
    </main>
  );
}