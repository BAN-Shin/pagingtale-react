import Link from "next/link";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { classes, students, testAssignments } from "@/db/schema";
import DeletedClassesPageClient from "@/components/admin/deleted-classes-page-client";

type SearchParams = Promise<{
  q?: string;
  toast?: string;
  duplicateOnly?: string;
  activeOnly?: string;
  restorableOnly?: string;
  sort?: string;
}>;

function formatToastMessage(toast?: string): string | null {
  switch (toast) {
    case "restored":
      return "クラスを復元しました";
    case "bulk_restored":
      return "選択したクラスを復元しました";
    case "duplicate":
      return "同名の通常クラスがすでに存在するため復元できません";
    case "bulk_partial":
      return "復元できるクラスだけ復元しました";
    case "bulk_none":
      return "復元できるクラスがありませんでした";
    case "error":
      return "処理に失敗しました";
    default:
      return null;
  }
}

function buildDeletedClassesHref(params?: {
  q?: string;
  toast?: string;
  duplicateOnly?: boolean;
  activeOnly?: boolean;
  restorableOnly?: boolean;
  sort?: string;
}) {
  const search = new URLSearchParams();

  if (params?.q?.trim()) search.set("q", params.q.trim());
  if (params?.toast) search.set("toast", params.toast);
  if (params?.duplicateOnly) search.set("duplicateOnly", "1");
  if (params?.activeOnly) search.set("activeOnly", "1");
  if (params?.restorableOnly) search.set("restorableOnly", "1");
  if (params?.sort?.trim()) search.set("sort", params.sort.trim());

  const query = search.toString();
  return query ? `/admin/classes/deleted?${query}` : "/admin/classes/deleted";
}

async function restoreSingleClassAction(formData: FormData) {
  "use server";

  const id = Number(formData.get("id"));
  const q = String(formData.get("q") || "").trim();
  const duplicateOnly = String(formData.get("duplicateOnly") || "") === "1";
  const activeOnly = String(formData.get("activeOnly") || "") === "1";
  const restorableOnly = String(formData.get("restorableOnly") || "") === "1";
  const sort = String(formData.get("sort") || "").trim();

  if (!id) {
    redirect(
      buildDeletedClassesHref({
        q,
        toast: "error",
        duplicateOnly,
        activeOnly,
        restorableOnly,
        sort,
      })
    );
  }

  const [current] = await db
    .select({
      id: classes.id,
      name: classes.name,
      deletedAt: classes.deletedAt,
    })
    .from(classes)
    .where(eq(classes.id, id))
    .limit(1);

  if (!current || !current.deletedAt) {
    redirect(
      buildDeletedClassesHref({
        q,
        toast: "error",
        duplicateOnly,
        activeOnly,
        restorableOnly,
        sort,
      })
    );
  }

  const [duplicateActiveClass] = await db
    .select({
      id: classes.id,
    })
    .from(classes)
    .where(and(eq(classes.name, current.name), isNull(classes.deletedAt)))
    .limit(1);

  if (duplicateActiveClass) {
    redirect(
      buildDeletedClassesHref({
        q,
        toast: "duplicate",
        duplicateOnly,
        activeOnly,
        restorableOnly,
        sort,
      })
    );
  }

  await db
    .update(classes)
    .set({
      deletedAt: null,
    })
    .where(eq(classes.id, id));

  revalidatePath("/admin/classes");
  revalidatePath("/admin/classes/deleted");
  revalidatePath("/admin/students");

  redirect(
    buildDeletedClassesHref({
      q,
      toast: "restored",
      duplicateOnly,
      activeOnly,
      restorableOnly,
      sort,
    })
  );
}

async function restoreSelectedClassesAction(formData: FormData) {
  "use server";

  const q = String(formData.get("q") || "").trim();
  const duplicateOnly = String(formData.get("duplicateOnly") || "") === "1";
  const activeOnly = String(formData.get("activeOnly") || "") === "1";
  const restorableOnly = String(formData.get("restorableOnly") || "") === "1";
  const sort = String(formData.get("sort") || "").trim();

  const selectedIds = formData
    .getAll("selectedIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (selectedIds.length === 0) {
    redirect(
      buildDeletedClassesHref({
        q,
        toast: "error",
        duplicateOnly,
        activeOnly,
        restorableOnly,
        sort,
      })
    );
  }

  const selectedRows = await db
    .select({
      id: classes.id,
      name: classes.name,
      deletedAt: classes.deletedAt,
    })
    .from(classes)
    .where(inArray(classes.id, selectedIds));

  const deletedRows = selectedRows.filter((row) => Boolean(row.deletedAt));

  if (deletedRows.length === 0) {
    redirect(
      buildDeletedClassesHref({
        q,
        toast: "bulk_none",
        duplicateOnly,
        activeOnly,
        restorableOnly,
        sort,
      })
    );
  }

  const activeRows = await db
    .select({
      id: classes.id,
      name: classes.name,
    })
    .from(classes)
    .where(isNull(classes.deletedAt));

  const activeNameSet = new Set(activeRows.map((row) => row.name));
  const seenRestoredNames = new Set<string>();
  const restorableIds: number[] = [];

  for (const row of deletedRows) {
    if (activeNameSet.has(row.name)) continue;
    if (seenRestoredNames.has(row.name)) continue;

    seenRestoredNames.add(row.name);
    restorableIds.push(row.id);
  }

  if (restorableIds.length === 0) {
    redirect(
      buildDeletedClassesHref({
        q,
        toast: "bulk_none",
        duplicateOnly,
        activeOnly,
        restorableOnly,
        sort,
      })
    );
  }

  await db
    .update(classes)
    .set({
      deletedAt: null,
    })
    .where(inArray(classes.id, restorableIds));

  revalidatePath("/admin/classes");
  revalidatePath("/admin/classes/deleted");
  revalidatePath("/admin/students");

  redirect(
    buildDeletedClassesHref({
      q,
      toast:
        restorableIds.length === deletedRows.length
          ? "bulk_restored"
          : "bulk_partial",
      duplicateOnly,
      activeOnly,
      restorableOnly,
      sort,
    })
  );
}

export default async function DeletedClassesPage(props: {
  searchParams?: SearchParams;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const q = (searchParams.q ?? "").trim();
  const toast = searchParams.toast;
  const duplicateOnly = searchParams.duplicateOnly === "1";
  const activeOnly = searchParams.activeOnly === "1";
  const restorableOnly = searchParams.restorableOnly === "1";
  const sort =
    searchParams.sort === "name_asc" ? "name_asc" : "deleted_desc";

  const toastMessage = formatToastMessage(toast);

  const baseClassRows = await db
    .select({
      id: classes.id,
      name: classes.name,
      createdAt: classes.createdAt,
      deletedAt: classes.deletedAt,
      studentCount: count(students.id),
    })
    .from(classes)
    .leftJoin(students, eq(students.classId, classes.id))
    .where(
      q
        ? and(isNotNull(classes.deletedAt), ilike(classes.name, `%${q}%`))
        : isNotNull(classes.deletedAt)
    )
    .groupBy(classes.id, classes.name, classes.createdAt, classes.deletedAt)
    .orderBy(desc(classes.deletedAt), asc(classes.name), asc(classes.id));

  const classRowsWithFlags = await Promise.all(
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

      const [duplicateActiveClass] = await db
        .select({
          id: classes.id,
        })
        .from(classes)
        .where(and(eq(classes.name, item.name), isNull(classes.deletedAt)))
        .limit(1);

      const activeAssignmentCount = Number(activeAssignmentCountRow?.count ?? 0);
      const hasDuplicateActiveClass = Boolean(duplicateActiveClass);
      const isRestorable = !hasDuplicateActiveClass;

      return {
        ...item,
        activeAssignmentCount,
        hasActiveAssignments: activeAssignmentCount > 0,
        hasDuplicateActiveClass,
        isRestorable,
      };
    })
  );

  const filteredClassRows = classRowsWithFlags.filter((item) => {
    if (duplicateOnly && !item.hasDuplicateActiveClass) return false;
    if (activeOnly && !item.hasActiveAssignments) return false;
    if (restorableOnly && !item.isRestorable) return false;
    return true;
  });

  const classRows = [...filteredClassRows].sort((a, b) => {
    if (sort === "name_asc") {
      const nameCompare = a.name.localeCompare(b.name, "ja");
      if (nameCompare !== 0) return nameCompare;
      return a.id - b.id;
    }

    const deletedAtA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
    const deletedAtB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;

    if (deletedAtA !== deletedAtB) {
      return deletedAtB - deletedAtA;
    }

    const nameCompare = a.name.localeCompare(b.name, "ja");
    if (nameCompare !== 0) return nameCompare;

    return a.id - b.id;
  });

  const duplicateCount = classRowsWithFlags.filter(
    (item) => item.hasDuplicateActiveClass
  ).length;

  const activeCount = classRowsWithFlags.filter(
    (item) => item.hasActiveAssignments
  ).length;

  const restorableCount = classRowsWithFlags.filter(
    (item) => item.isRestorable
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      {toastMessage ? (
        <div className="fixed bottom-5 right-5 z-50 max-w-[min(92vw,360px)] animate-[toast-in_0.2s_ease-out] rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur [animation-fill-mode:forwards] after:pointer-events-none after:absolute after:inset-0 after:rounded-2xl after:animate-[toast-fade_6s_linear_forwards]">
          <div className="break-words">{toastMessage}</div>
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                削除済みクラス一覧
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                論理削除されたクラスを確認できます。必要に応じて復元できます。
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/admin/classes"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                通常クラス一覧へ
              </Link>
            </div>
          </div>

          <form method="get" className="mt-5 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row">
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
                  href="/admin/classes/deleted"
                  className="whitespace-nowrap rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  クリア
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  name="duplicateOnly"
                  value="1"
                  defaultChecked={duplicateOnly}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                同名衝突ありだけ表示
              </label>

              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  name="activeOnly"
                  value="1"
                  defaultChecked={activeOnly}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                配布中ありだけ表示
              </label>

              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  name="restorableOnly"
                  value="1"
                  defaultChecked={restorableOnly}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                復元可能だけ表示
              </label>

              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span>並び順</span>
                <select
                  name="sort"
                  defaultValue={sort}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-500"
                >
                  <option value="deleted_desc">削除日が新しい順</option>
                  <option value="name_asc">名前順</option>
                </select>
              </div>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                削除済みクラス ({classRows.length})
              </h2>
              <div className="mt-1 text-xs text-slate-500">
                同名衝突あり {duplicateCount}件 / 配布中あり {activeCount}件 / 復元可能 {restorableCount}件
                {(duplicateOnly || activeOnly || restorableOnly)
                  ? " / 絞り込み中"
                  : ""}
                {sort === "name_asc" ? " / 名前順" : " / 削除日が新しい順"}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              同名の通常クラスがある場合は復元できません
            </div>
          </div>

          {classRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              {duplicateOnly && activeOnly && restorableOnly
                ? "条件に一致する削除済みクラスはありません。"
                : restorableOnly
                ? "復元可能な削除済みクラスはありません。"
                : duplicateOnly && activeOnly
                ? "同名衝突あり・配布中ありに一致する削除済みクラスはありません。"
                : duplicateOnly
                ? "同名衝突ありの削除済みクラスはありません。"
                : activeOnly
                ? "配布中ありの削除済みクラスはありません。"
                : "削除済みクラスはありません。"}
            </div>
          ) : (
            <DeletedClassesPageClient
              rows={classRows}
              q={q}
              duplicateOnly={duplicateOnly}
              activeOnly={activeOnly}
              restorableOnly={restorableOnly}
              sort={sort}
              restoreSingleAction={restoreSingleClassAction}
              restoreSelectedAction={restoreSelectedClassesAction}
            />
          )}
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