import Link from "next/link";
import Image from "next/image";
import { promises as fs } from "fs";
import path from "path";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { classes, students } from "@/db/schema";
import {
  clearStudentSession,
  getStudentSession,
  setStudentSession,
  verifyStudentPassword,
} from "@/lib/student-auth";
import LoginForm from "@/components/book/LoginForm";

type SearchParams = Promise<{
  error?: string;
}>;

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

type LoginActionResult = {
  ok: boolean;
  message: string;
};

type ClassOption = {
  id: number;
  name: string;
};

function formatBookTitle(bookId: string): string {
  return bookId.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function formatLoginError(error?: string): string | null {
  switch ((error ?? "").trim()) {
    case "missing":
      return "クラス・学籍番号・氏名・パスワードを入力してください。";
    case "invalid":
      return "ログイン情報が一致しません。";
    default:
      return null;
  }
}

async function readBookMeta(bookDir: string): Promise<BookMeta | null> {
  const metaPath = path.join(bookDir, "meta.json");

  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(raw) as BookMeta;
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
        const meta = await readBookMeta(path.join(booksDir, bookId));

        const thumbnail =
          meta?.thumbnail?.trim() || `/book-assets/pics/${bookId}.png`;

        return {
          bookId,
          title: meta?.title?.trim() || formatBookTitle(bookId),
          description: meta?.description?.trim() || "教材を開きます。",
          thumbnail,
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
    console.error("public/book-assets の読み込みに失敗しました:", error);
    return [];
  }
}

async function loadLoginClasses(): Promise<ClassOption[]> {
  return db
    .select({
      id: classes.id,
      name: classes.name,
    })
    .from(classes)
    .where(isNull(classes.deletedAt))
    .orderBy(asc(classes.name), asc(classes.id));
}

export default async function BooksPage(props: {
  searchParams?: SearchParams;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const loginError = formatLoginError(searchParams.error);
  const session = await getStudentSession();

  async function loginStudent(formData: FormData): Promise<LoginActionResult> {
    "use server";

    try {
      const classId = Number(formData.get("classId") ?? 0);
      const studentNumber = String(formData.get("studentNumber") ?? "").trim();
      const studentName = String(formData.get("studentName") ?? "").trim();
      const password = String(formData.get("password") ?? "").trim();

      if (!classId || !studentNumber || !studentName || !password) {
        return {
          ok: false,
          message: "クラス・学籍番号・氏名・パスワードを入力してください。",
        };
      }

      const [student] = await db
        .select({
          id: students.id,
          classId: students.classId,
          studentNumber: students.studentNumber,
          studentName: students.studentName,
          passwordHash: students.passwordHash,
        })
        .from(students)
        .where(
          and(
            eq(students.classId, classId),
            eq(students.studentNumber, studentNumber),
            eq(students.studentName, studentName)
          )
        )
        .limit(1);

      if (!student) {
        return {
          ok: false,
          message: "ログイン情報が一致しません。",
        };
      }

      if (!verifyStudentPassword(password, student.passwordHash)) {
        return {
          ok: false,
          message: "ログイン情報が一致しません。",
        };
      }

      await setStudentSession({
        studentId: student.id,
        classId: student.classId,
        studentNumber: student.studentNumber,
        studentName: student.studentName,
      });

      return { ok: true, message: "" };
    } catch (error) {
      console.error("loginStudent error:", error);

      return {
        ok: false,
        message:
          error instanceof Error
            ? `ログイン処理エラー: ${error.message}`
            : "ログイン処理で不明なエラーが発生しました。",
      };
    }
  }

  async function logoutStudent() {
    "use server";
    await clearStudentSession();
  }

  const books = await loadBooksFromPublic();
  const loginClasses = session ? [] : await loadLoginClasses();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">教材一覧</h1>
              <p className="text-sm text-slate-600">
                教材はゲストでも閲覧できます。問題への解答・提出・成績反映は、ログインした受験者のみ利用できます。
              </p>
            </div>
          </section>

          {session ? (
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-emerald-900">
                  <div className="font-bold">ログイン中</div>
                  <div className="mt-1">
                    {session.studentNumber} / {session.studentName}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <form action={logoutStudent}>
                    <button
                      type="submit"
                      className="rounded-2xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      ログアウト
                    </button>
                  </form>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-3">
                  <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                    ゲスト閲覧中
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-900">
                      教材はそのまま閲覧できます
                    </h2>
                    <p className="max-w-2xl text-sm leading-7 text-slate-600">
                      ログインしなくても教材の閲覧は可能です。問題の解答や提出、成績反映を使う場合は、右側の生徒ログインから開始してください。
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-bold text-slate-900">
                    生徒ログイン
                  </div>
                  <LoginForm
                    initialError={loginError}
                    loginAction={loginStudent}
                    classes={loginClasses}
                  />
                </div>
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">教材を選ぶ</h2>
                <p className="mt-1 text-sm text-slate-500">
                  閲覧したい教材を選んでください。
                </p>
              </div>
            </div>

            {books.length === 0 ? (
              <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
                表示できる教材フォルダがありません。
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
        </div>
      </div>
    </main>
  );
}