import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import AdminPasswordChangeForm from "@/components/admin/AdminPasswordChangeForm";

export default async function AdminAccountPage() {
  const adminSession = await getAdminSession();

  if (
    !adminSession ||
    (adminSession.role !== "teacher" && adminSession.role !== "admin")
  ) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">アカウント設定</h1>
            <p className="text-sm text-slate-600">
              教師アカウントのパスワードを変更できます。
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-bold text-slate-900">
              {adminSession.teacherName}
            </span>
            <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {adminSession.role}
            </span>
            <span className="ml-3 text-xs text-slate-500">
              {adminSession.loginId}
            </span>
          </div>
        </section>

        <AdminPasswordChangeForm />
      </div>
    </main>
  );
}