import { redirect } from "next/navigation";
import BooksCatalog from "@/components/book/BooksCatalog";
import { getAdminSession } from "@/lib/admin-auth";

export default async function AdminBooksPage() {
  const adminSession = await getAdminSession();

  if (
    !adminSession ||
    (adminSession.role !== "teacher" && adminSession.role !== "admin")
  ) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">教材管理</h1>
            <p className="text-sm text-slate-600">
              教師用の教材一覧です。教材の確認、practice / test 切替、管理導線の確認を行えます。
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

        <section className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <div className="space-y-2 text-sm text-sky-900">
            <div className="font-bold">この画面でできること</div>
            <ul className="list-disc space-y-1 pl-5">
              <li>教材を開いて表示確認</li>
              <li>自分の教材だけ practice / test を切り替え</li>
              <li>教材の所有者とページ数の確認</li>
            </ul>
          </div>
        </section>

        <BooksCatalog
          teacherSession={{
            teacherId: adminSession.teacherId,
            teacherName: adminSession.teacherName,
            role: adminSession.role,
          }}
          adminMode={TrueToBoolean()}
        />
      </div>
    </main>
  );
}

function TrueToBoolean() {
  return true;
}