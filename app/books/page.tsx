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
import BooksCatalog from "@/components/book/BooksCatalog";

type SearchParams = Promise<{
  error?: string;
}>;

type LoginActionResult = {
  ok: boolean;
  message: string;
};

type ClassOption = {
  id: number;
  name: string;
};

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

          <BooksCatalog />
        </div>
      </div>
    </main>
  );
}