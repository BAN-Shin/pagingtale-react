import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, count, eq, ilike, isNull } from "drizzle-orm";
import { db } from "@/db";
import { classes, students, testAssignments } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";
import {
  addClass,
  deleteClass,
  undoClassAction,
  updateClass,
} from "./actions";
import { ClassDeleteButton } from "./ClassDeleteButton";

type SearchParams = Promise<{
  q?: string;
  toast?: string;
  undo?: string;
  classId?: string;
  className?: string;
  prevClassName?: string;
}>;

function formatDateTime(value: Date | null | undefined): string {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatToastMessage(toast?: string) {
  switch ((toast ?? "").trim()) {
    case "added":
      return "クラスを追加しました。";
    case "updated":
      return "クラス名を更新しました。";
    case "deleted":
      return "クラスを削除しました。";
    case "restored":
      return "元に戻しました。";
    case "add_error":
      return "クラス追加に失敗しました。";
    case "update_error":
      return "クラス更新に失敗しました。";
    case "delete_error":
      return "クラス削除に失敗しました。";
    case "undo_error":
      return "元に戻す処理に失敗しました。";
    default:
      return null;
  }
}

export default async function AdminClassesPage(props: {
  searchParams?: SearchParams;
}) {
  const adminSession = await getAdminSession();

  if (
    !adminSession ||
    (adminSession.role !== "teacher" && adminSession.role !== "admin")
  ) {
    redirect("/admin/login");
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const q = (searchParams.q ?? "").trim();
  const toast = searchParams.toast;
  const undo = searchParams.undo;
  const classId = Number(searchParams.classId || 0);
  const className = (searchParams.className ?? "").trim();
  const prevClassName = (searchParams.prevClassName ?? "").trim();

  const toastMessage = formatToastMessage(toast);

  const baseClassRows = await db
    .select({
      id: classes.id,
      name: classes.name,
      createdAt: classes.createdAt,
      studentCount: count(students.id),
    })
    .from(classes)
    .leftJoin(students, eq(students.classId, classes.id))
    .where(
      q
        ? and(isNull(classes.deletedAt), ilike(classes.name, `%${q}%`))
        : isNull(classes.deletedAt)
    )
    .groupBy(classes.id, classes.name, classes.createdAt)
    .orderBy(asc(classes.name), asc(classes.id));

  const classRows = await Promise.all(
    baseClassRows.map(async (item) => {
      const [activeAssignmentCountRow] = await db
        .select({
          count: count(testAssignments.id),
        })
        .from(testAssignments)
        .where(
          and(
            eq(testAssignments.classId, item.id),
            eq(testAssignments.isActive, true)
          )
        );

      return {
        ...item,
        activeAssignmentCount: Number(activeAssignmentCountRow?.count ?? 0),
      };
    })
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      {toastMessage ? (
        <div className="fixed bottom-5 right-5 z-50 max-w-[min(92vw,360px)] animate-[toast-in_0.2s_ease-out] rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur [animation-fill-mode:forwards] after:pointer-events-none after:absolute after:inset-0 after:rounded-2xl after:animate-[toast-fade_6s_linear_forwards]">
          {undo === "add" || undo === "update" || undo === "delete" ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 break-words">{toastMessage}</div>

              <form action={undoClassAction}>
                <input type="hidden" name="undo" value={undo} />
                <input type="hidden" name="q" value={q} />
                <input type="hidden" name="classId" value={classId || ""} />
                <input type="hidden" name="className" value={className} />
                <input
                  type="hidden"
                  name="prevClassName"
                  value={prevClassName}
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/15"
                >
                  元に戻す
                </button>
              </form>
            </div>
          ) : (
            <div className="break-words">{toastMessage}</div>
          )}
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">クラス管理</h1>
              <p className="mt-2 text-sm text-slate-600">
                PagingTale のクラス一覧です。クラス追加・クラス名編集・生徒名簿管理への導線をまとめています。
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                削除は論理削除です。通常一覧から非表示になります。
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/admin/books"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                教材一覧へ
              </Link>

              <Link
                href="/admin/classes/deleted"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                削除済み一覧へ
              </Link>

              <Link
                href="/admin/submissions"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                提出一覧へ
              </Link>
            </div>
          </div>

          <form method="get" className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="クラス名で検索"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            />

            <div className="flex shrink-0 gap-2">
              <button
                type="submit"
                className="whitespace-nowrap rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                検索
              </button>

              <Link
                href="/admin/classes"
                className="whitespace-nowrap rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                クリア
              </Link>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">クラス追加</h2>
            <div className="text-xs text-slate-500">DB保存データ</div>
          </div>

          <form
            action={addClass}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <input type="hidden" name="q" value={q} />

            <input
              name="className"
              placeholder="クラス名を入力"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            />

            <button
              type="submit"
              className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              クラス追加
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              クラス一覧 ({classRows.length})
            </h2>
            <div className="text-xs text-slate-500">
              クラス名をその場で編集できます
            </div>
          </div>

          {classRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              クラスがまだありません。
              <br />
              上の「クラス追加」から登録してください。
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-slate-100">
                    <tr className="text-left text-slate-700">
                      <th className="px-4 py-3 font-bold">ID</th>
                      <th className="px-4 py-3 font-bold">クラス名</th>
                      <th className="px-4 py-3 font-bold">生徒数</th>
                      <th className="px-4 py-3 font-bold">配布中</th>
                      <th className="px-4 py-3 font-bold">作成日時</th>
                      <th className="px-4 py-3 font-bold">導線</th>
                      <th className="px-4 py-3 font-bold">削除</th>
                    </tr>
                  </thead>

                  <tbody>
                    {classRows.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-slate-200 bg-white"
                      >
                        <td className="px-4 py-3 align-top text-slate-700">
                          {item.id}
                        </td>

                        <td className="px-4 py-3 align-top">
                          <form
                            action={updateClass}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="q" value={q} />

                            <input
                              name="className"
                              defaultValue={item.name}
                              className="min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                            />

                            <button
                              type="submit"
                              className="rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700"
                            >
                              保存
                            </button>
                          </form>
                        </td>

                        <td className="px-4 py-3 align-top text-slate-700">
                          {Number(item.studentCount ?? 0)}
                        </td>

                        <td className="px-4 py-3 align-top text-slate-700">
                          {item.activeAssignmentCount}
                        </td>

                        <td className="px-4 py-3 align-top text-slate-700">
                          {formatDateTime(item.createdAt)}
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/admin/students?classId=${item.id}`}
                              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-slate-100"
                            >
                              生徒名簿へ →
                            </Link>

                            <Link
                              href={`/admin/classes/${item.id}/results`}
                              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-slate-100"
                            >
                              成績一覧 →
                            </Link>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          {item.activeAssignmentCount > 0 ? (
                            <span className="text-xs font-bold text-amber-600">
                              配布中テストあり
                            </span>
                          ) : (
                            <form action={deleteClass}>
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="q" value={q} />
                              <ClassDeleteButton classNameValue={item.name} />
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-amber-900">次のおすすめ</h2>
          <div className="mt-3 space-y-2 text-sm leading-7 text-amber-900">
            <p>
              次は削除済みクラス一覧と、手動復元導線を用意すると運用がさらに安定します。
            </p>
            <p>
              その次に、削除済みクラスの生徒や成績をどう見せるかを専用画面で整理すると分かりやすいです。
            </p>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes toast-fade {
          0%, 82% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}