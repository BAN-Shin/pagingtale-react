import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import {
  getStudentSession,
  makeStudentPasswordHash,
  verifyStudentPassword,
} from "@/lib/student-auth";

type SearchParams = Promise<{
  message?: string;
}>;

function isStrongEnoughPassword(password: string): boolean {
  if (password.length < 8) return false;

  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);

  return hasLetter && hasDigit;
}

function buildAccountHref(message?: string) {
  const search = new URLSearchParams();

  if (message) {
    search.set("message", message);
  }

  const qs = search.toString();
  return qs ? `/books/account?${qs}` : "/books/account";
}

function formatMessage(message?: string): {
  type: "success" | "error";
  text: string;
} | null {
  switch ((message ?? "").trim()) {
    case "updated":
      return {
        type: "success",
        text: "パスワードを変更しました。",
      };
    case "missing":
      return {
        type: "error",
        text: "現在のパスワード・新しいパスワード・確認用パスワードを入力してください。",
      };
    case "mismatch":
      return {
        type: "error",
        text: "新しいパスワードと確認用パスワードが一致しません。",
      };
    case "weak":
      return {
        type: "error",
        text: "新しいパスワードは8文字以上で、英字と数字を両方含めてください。",
      };
    case "invalid_current":
      return {
        type: "error",
        text: "現在のパスワードが正しくありません。",
      };
    case "not_found":
      return {
        type: "error",
        text: "生徒情報が見つかりません。",
      };
    default:
      return null;
  }
}

export default async function StudentAccountPage(props: {
  searchParams?: SearchParams;
}) {
  const session = await getStudentSession();

  if (!session) {
    redirect("/books");
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const message = formatMessage(searchParams.message);

  async function changePassword(formData: FormData) {
    "use server";

    const session = await getStudentSession();

    if (!session) {
      redirect("/books");
    }

    const currentPassword = String(
      formData.get("currentPassword") ?? ""
    ).trim();
    const newPassword = String(formData.get("newPassword") ?? "").trim();
    const confirmPassword = String(
      formData.get("confirmPassword") ?? ""
    ).trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      redirect(buildAccountHref("missing"));
    }

    if (newPassword !== confirmPassword) {
      redirect(buildAccountHref("mismatch"));
    }

    if (!isStrongEnoughPassword(newPassword)) {
      redirect(buildAccountHref("weak"));
    }

    const [student] = await db
      .select({
        id: students.id,
        passwordHash: students.passwordHash,
      })
      .from(students)
      .where(eq(students.id, session.studentId))
      .limit(1);

    if (!student) {
      redirect(buildAccountHref("not_found"));
    }

    if (!verifyStudentPassword(currentPassword, student.passwordHash)) {
      redirect(buildAccountHref("invalid_current"));
    }

    await db
      .update(students)
      .set({
        passwordHash: makeStudentPasswordHash(newPassword),
      })
      .where(eq(students.id, session.studentId));

    redirect(buildAccountHref("updated"));
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">
                パスワード変更
              </h1>
              <p className="text-sm text-slate-600">
                現在のパスワードを確認したうえで、新しいパスワードに変更します。
              </p>
            </div>

            <Link
              href="/books"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              ← 教材一覧へ
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div>
              <span className="font-bold text-slate-900">ログイン中:</span>{" "}
              {session.studentNumber} / {session.studentName}
            </div>
          </div>

          {message ? (
            <div
              className={`mb-5 rounded-2xl px-4 py-3 text-sm font-semibold ${
                message.type === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <form action={changePassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                現在のパスワード
              </label>
              <input
                type="password"
                name="currentPassword"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                placeholder="現在のパスワード"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                新しいパスワード
              </label>
              <input
                type="password"
                name="newPassword"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                placeholder="新しいパスワード"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                name="confirmPassword"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                placeholder="もう一度入力"
              />
            </div>

            <p className="text-xs text-slate-500">
              新しいパスワードは8文字以上で、英字と数字を両方含めてください。
            </p>

            <button
              type="submit"
              className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              パスワードを変更する
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}