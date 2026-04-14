"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

type DeletedClassRow = {
  id: number;
  name: string;
  createdAt: Date | string | null;
  deletedAt: Date | string | null;
  studentCount: number;
  activeAssignmentCount: number;
  hasActiveAssignments: boolean;
  hasDuplicateActiveClass: boolean;
  isRestorable: boolean;
};

type DeletedClassesPageClientProps = {
  rows: DeletedClassRow[];
  q: string;
  duplicateOnly: boolean;
  activeOnly: boolean;
  restorableOnly: boolean;
  sort: "deleted_desc" | "name_asc";
  restoreSingleAction: (formData: FormData) => Promise<void>;
  restoreSelectedAction: (formData: FormData) => Promise<void>;
};

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function BulkRestoreSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "復元中..." : "選択したクラスをまとめて復元"}
    </button>
  );
}

function SingleRestoreSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "復元中..." : "復元"}
    </button>
  );
}

export default function DeletedClassesPageClient({
  rows,
  q,
  duplicateOnly,
  activeOnly,
  restorableOnly,
  sort,
  restoreSingleAction,
  restoreSelectedAction,
}: DeletedClassesPageClientProps) {
  const selectableRows = useMemo(
    () => rows.filter((item) => item.isRestorable),
    [rows]
  );

  const selectableIdSet = useMemo(
    () => new Set(selectableRows.map((item) => item.id)),
    [selectableRows]
  );

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const effectiveSelectedIds = useMemo(
    () => selectedIds.filter((id) => selectableIdSet.has(id)),
    [selectedIds, selectableIdSet]
  );

  const selectedCount = effectiveSelectedIds.length;
  const selectableCount = selectableRows.length;
  const isAllSelected =
    selectableCount > 0 && selectedCount === selectableCount;

  const handleSelectAll = () => {
    setSelectedIds(selectableRows.map((item) => item.id));
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  return (
    <>
      {selectableRows.length > 0 ? (
        <form
          action={restoreSelectedAction}
          className="mb-4"
          onSubmit={(event) => {
            if (effectiveSelectedIds.length === 0) {
              event.preventDefault();
              window.alert("復元するクラスを選択してください。");
              return;
            }

            const selectedNames = selectableRows
              .filter((item) => effectiveSelectedIds.includes(item.id))
              .map((item) => `${item.name} (ID:${item.id})`);

            const ok = window.confirm(
              [
                "選択したクラスを復元します。よろしいですか？",
                "",
                ...selectedNames,
              ].join("\n")
            );

            if (!ok) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="q" value={q} />
          <input
            type="hidden"
            name="duplicateOnly"
            value={duplicateOnly ? "1" : ""}
          />
          <input
            type="hidden"
            name="activeOnly"
            value={activeOnly ? "1" : ""}
          />
          <input
            type="hidden"
            name="restorableOnly"
            value={restorableOnly ? "1" : ""}
          />
          <input type="hidden" name="sort" value={sort} />

          {effectiveSelectedIds.map((id) => (
            <input key={id} type="hidden" name="selectedIds" value={id} />
          ))}

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-sky-900">
                  復元可能なクラスを複数選んで、まとめて復元できます。
                </div>
                <div className="mt-1 text-xs text-sky-800/80">
                  復元可能 {selectableCount}件 / 選択中 {selectedCount}件
                </div>
              </div>

              <BulkRestoreSubmitButton disabled={effectiveSelectedIds.length === 0} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={isAllSelected}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                全選択
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                disabled={effectiveSelectedIds.length === 0}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                全解除
              </button>

              <div className="ml-2 self-center text-xs font-semibold text-slate-600">
                {effectiveSelectedIds.length}件選択中
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {selectableRows.map((item) => {
                const checked = effectiveSelectedIds.includes(item.id);

                return (
                  <label
                    key={item.id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelection(item.id)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600"
                    />
                    {item.name} (ID:{item.id})
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      ) : null}

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
                <th className="px-4 py-3 font-bold">削除日時</th>
                <th className="px-4 py-3 font-bold">導線</th>
                <th className="px-4 py-3 font-bold">復元</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-200 bg-white"
                >
                  <td className="px-4 py-3 align-top text-slate-700">
                    {item.id}
                  </td>

                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-slate-900">
                      {item.name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {item.hasDuplicateActiveClass ? (
                        <div className="inline-flex rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                          同名の通常クラスあり
                        </div>
                      ) : null}

                      {item.hasActiveAssignments ? (
                        <div className="inline-flex rounded-xl border border-sky-300 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">
                          配布中あり
                        </div>
                      ) : null}

                      {item.isRestorable ? (
                        <div className="inline-flex rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                          復元可能
                        </div>
                      ) : null}
                    </div>
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

                  <td className="px-4 py-3 align-top text-slate-700">
                    {formatDateTime(item.deletedAt)}
                  </td>

                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`/admin/students?classId=${item.id}`}
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-slate-100"
                      >
                        生徒名簿へ →
                      </a>

                      <a
                        href={`/admin/classes/${item.id}/results`}
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-slate-100"
                      >
                        成績一覧 →
                      </a>
                    </div>
                  </td>

                  <td className="px-4 py-3 align-top">
                    {item.hasDuplicateActiveClass ? (
                      <div className="inline-flex rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                        復元不可
                      </div>
                    ) : (
                      <form
                        action={restoreSingleAction}
                        onSubmit={(event) => {
                          const ok = window.confirm(
                            `「${item.name} (ID:${item.id})」を復元します。よろしいですか？`
                          );

                          if (!ok) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="q" value={q} />
                        <input
                          type="hidden"
                          name="duplicateOnly"
                          value={duplicateOnly ? "1" : ""}
                        />
                        <input
                          type="hidden"
                          name="activeOnly"
                          value={activeOnly ? "1" : ""}
                        />
                        <input
                          type="hidden"
                          name="restorableOnly"
                          value={restorableOnly ? "1" : ""}
                        />
                        <input type="hidden" name="sort" value={sort} />
                        <SingleRestoreSubmitButton />
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}