import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { books } from "@/db/schema";
import BookViewerWithQuiz from "@/components/book/BookViewerWithQuiz";
import { getStudentSession } from "@/lib/student-auth";
import { getAdminSession } from "@/lib/admin-auth";

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
  const studentSession = await getStudentSession();
  const adminSession = await getAdminSession();

  async function logoutStudent() {
    "use server";

    const { clearStudentSession } = await import("@/lib/student-auth");
    await clearStudentSession();
  }

  const bookId = normalizeBookId(params.bookId);
  const initialPage = parseInitialPage(searchParams.page);
  const testId = normalizeTestId(searchParams.testId);

  const bookRecord = await db.query.books.findFirst({
    where: eq(books.bookId, bookId),
  });

  const forcedMode = bookRecord?.mode === "test" ? "test" : "practice";

  const isStudentViewer = Boolean(studentSession);
  const isTeacherViewer = Boolean(
    adminSession &&
      !studentSession &&
      (adminSession.role === "teacher" || adminSession.role === "admin")
  );
  const isGuestViewer = !isStudentViewer && !isTeacherViewer;

  return (
    <main className="relative h-screen w-full bg-white">
      <div className="fixed right-4 top-4 z-50 flex flex-wrap gap-2">
        <Link
          href="/books"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-md transition hover:bg-slate-100"
        >
          ← 教材一覧へ
        </Link>

        {isStudentViewer ? (
          <Link
            href="/books/results"
            className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-md transition hover:bg-emerald-50"
          >
            自分の結果
          </Link>
        ) : null}

        {isTeacherViewer ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 shadow-md">
            教師閲覧中
          </div>
        ) : isStudentViewer ? (
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
        forcedMode={forcedMode}
        authenticatedStudentProfile={
          studentSession
            ? {
                classId: studentSession.classId,
                studentNumber: studentSession.studentNumber,
                studentName: studentSession.studentName,
              }
            : null
        }
        lockStudentProfile={isStudentViewer}
        showQuestionUi={!isGuestViewer}
        teacherCanSwitchMode={isTeacherViewer}
      />
    </main>
  );
}