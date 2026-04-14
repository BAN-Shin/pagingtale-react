import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, eq, isNull } from "drizzle-orm";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/db";
import { classes, testSubmissionAnswers } from "@/db/schema";

async function countBookDirectories() {
  try {
    const booksRoot = path.join(process.cwd(), "public", "books");
    const entries = await readdir(booksRoot, { withFileTypes: true });

    const folderNames = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name !== "pics");

    return folderNames.length;
  } catch (error) {
    console.error("countBookDirectories error:", error);
    return 0;
  }
}

export default async function AdminHomePage() {
  const adminSession = await getAdminSession();

  if (
    !adminSession ||
    (adminSession.role !== "teacher" && adminSession.role !== "admin")
  ) {
    redirect("/admin/login");
  }

  const [classCountRow] = await db
    .select({
      count: count(classes.id),
    })
    .from(classes)
    .where(isNull(classes.deletedAt));

  const [ungradedCountRow] = await db
    .select({
      count: count(testSubmissionAnswers.id),
    })
    .from(testSubmissionAnswers)
    .where(eq(testSubmissionAnswers.isManuallyGraded, false));

  const bookCount = await countBookDirectories();

  const classCount = Number(classCountRow?.count ?? 0);
  const ungradedCount = Number(ungradedCountRow?.count ?? 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">管理トップ</h1>
            <p className="text-sm text-slate-600">
              PagingTale の管理メニューです。提出確認、クラス管理、教材管理へ進めます。
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-bold text-slate-900">
              {adminSession.teacherName}
            </span>
            <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {adminSession.role}
            </span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Link
            href="/admin/submissions?ungraded=1"
            className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm transition hover:border-rose-300 hover:bg-rose-50/40"
          >
            <div className="text-sm font-bold text-rose-700">未採点件数</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {ungradedCount}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              手動採点が未実施の回答件数です。
            </p>
            <div className="mt-3 text-xs font-bold text-rose-700">
              未採点一覧へ →
            </div>
          </Link>

          <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold text-blue-700">クラス数</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {classCount}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              論理削除されていないクラス数です。
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold text-emerald-700">教材数</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {bookCount}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              `public\books` 配下の教材フォルダ数です。
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link
            href="/admin/submissions"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="space-y-2">
              <div className="text-lg font-bold text-slate-900">提出一覧</div>
              <p className="text-sm leading-6 text-slate-600">
                生徒の提出データを検索して確認できます。詳細画面から採点にも進めます。
              </p>
            </div>
          </Link>

          <Link
            href="/admin/classes"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="space-y-2">
              <div className="text-lg font-bold text-slate-900">クラス管理</div>
              <p className="text-sm leading-6 text-slate-600">
                クラスの追加、編集、削除、生徒名簿や成績一覧への導線を管理できます。
              </p>
            </div>
          </Link>

          <Link
            href="/admin/books"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="space-y-2">
              <div className="text-lg font-bold text-slate-900">教材一覧</div>
              <p className="text-sm leading-6 text-slate-600">
                登録されている教材を確認し、管理画面から教材単位の操作へ進めます。
              </p>
            </div>
          </Link>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-amber-900">次のおすすめ</h2>
          <div className="mt-3 space-y-2 text-sm leading-7 text-amber-900">
            <p>
              次は、提出一覧に「未採点のみ」フィルタを付けると採点作業がかなりしやすくなります。
            </p>
            <p>
              その次に、管理トップから未採点一覧へ直接飛べるボタンを付けるとさらに便利です。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}