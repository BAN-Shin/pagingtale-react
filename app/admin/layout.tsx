import Link from "next/link";
import { getAdminSession } from "@/lib/admin-auth";

type Props = {
  children: React.ReactNode;
};

async function logoutAction() {
  "use server";

  const { clearAdminSession } = await import("@/lib/admin-auth");
  const { redirect } = await import("next/navigation");

  await clearAdminSession();
  redirect("/admin/login");
}

export default async function AdminLayout({ children }: Props) {
  const adminSession = await getAdminSession();
  const isLoggedIn = Boolean(adminSession);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={isLoggedIn ? "/admin/submissions" : "/admin/login"}
              className="text-lg font-bold text-slate-900 transition hover:text-slate-700"
            >
              PagingTale 管理
            </Link>

            {isLoggedIn ? (
              <nav className="flex flex-wrap gap-2">
                <Link
                  href="/admin/submissions"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  提出一覧
                </Link>

                <Link
                  href="/admin/classes"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  クラス管理
                </Link>

                <Link
                  href="/admin/books"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  教材一覧
                </Link>

                {adminSession?.role === "admin" ? (
                  <Link
                    href="/admin/teachers"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  >
                    教師管理
                  </Link>
                ) : null}            

                <Link
                  href="/admin/account"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  アカウント設定
                </Link>
              </nav>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isLoggedIn ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                  <span className="font-bold text-slate-900">
                    {adminSession?.teacherName}
                  </span>
                  <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {adminSession?.role}
                  </span>
                </div>

                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    ログアウト
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/admin/login"
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                教師ログイン
              </Link>
            )}
          </div>
        </div>
      </header>

      <div>{children}</div>
    </div>
  );
}