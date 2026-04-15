import Link from "next/link";
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
  const initialPage = parseInitialPage(searchParams.page);
  const testId = normalizeTestId(searchParams.testId);
  const isGuest = !session;

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
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 shadow-md">
            ゲスト閲覧中
          </div>
        )}
      </div>

      <BookViewerWithQuiz
        bookId={bookId}
        initialPage={initialPage}
        testId={testId}
        authenticatedStudentProfile={
          session
            ? {
                classId: session.classId,
                studentNumber: session.studentNumber,
                studentName: session.studentName,
              }
            : null
        }
        lockStudentProfile={Boolean(session)}
        showQuestionUi={!isGuest}
      />
    </main>
  );
}