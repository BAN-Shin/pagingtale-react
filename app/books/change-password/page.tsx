import Link from "next/link";
import { redirect } from "next/navigation";
import { getStudentSession } from "@/lib/student-auth";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function StudentChangePasswordPage() {
  const session = await getStudentSession();

  if (!session) {
    redirect("/books");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* ヘッダー */}
        <section className="relative z-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                ログイン中
              </div>

              <h1 className="text-2xl font-bold text-slate-900">
                パスワード変更
              </h1>

              <p className="text-sm leading-7 text-slate-600">
                現在のパスワードを確認してから、新しいパスワードに変更します。
              </p>

              <div className="text-sm text-slate-700">
                {session.studentNumber} / {session.studentName}
              </div>
            </div>

            {/* ← ここが重要（クリック可能エリア） */}
            <div className="flex flex-wrap gap-2 relative z-20">
              <Link
                href="/books"
                className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                ← 教材一覧へ
              </Link>
            </div>
          </div>
        </section>

        {/* フォーム */}
        <div className="relative z-0">
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}