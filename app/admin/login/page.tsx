import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export default async function AdminLoginPage() {
  const adminSession = await getAdminSession();

  if (adminSession) {
    redirect("/admin/submissions");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">
              教師ログイン
            </h1>
            <p className="text-sm text-slate-600">
              ログインすると、提出一覧（/admin/submissions）へ移動し、そこからクラス管理画面にも入れます。
            </p>
          </div>
        </section>

        <AdminLoginForm />
      </div>
    </main>
  );
}