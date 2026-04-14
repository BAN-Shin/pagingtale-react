import { db } from "@/db";
import { classes, studentScoreHistories, students } from "@/db/schema";
import { and, asc, count, eq, ilike, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import StudentDeleteButton from "@/components/admin/student-delete-button";
import AutoHideToast from "@/components/admin/AutoHideToast";
import { getAdminSession } from "@/lib/admin-auth";
import { makeStudentPasswordHash } from "@/lib/student-auth";

type SearchParams = Promise<{
  classId?: string;
  q?: string;
  toast?: string;
  undo?: string;
  studentId?: string;
  studentNumber?: string;
  studentName?: string;
  prevStudentNumber?: string;
  prevStudentName?: string;
  editId?: string;
  editStudentNumber?: string;
  editStudentName?: string;
  bulkAdded?: string;
  bulkSkipped?: string;
}>;

function buildStudentsHref(params: {
  classId: number;
  q?: string;
  toast?: string;
  undo?: string;
  studentId?: number;
  studentNumber?: string;
  studentName?: string;
  prevStudentNumber?: string;
  prevStudentName?: string;
  editId?: number;
  editStudentNumber?: string;
  editStudentName?: string;
  bulkAdded?: number;
  bulkSkipped?: number;
}) {
  const search = new URLSearchParams();

  search.set("classId", String(params.classId));

  if (params.q) search.set("q", params.q);
  if (params.toast) search.set("toast", params.toast);
  if (params.undo) search.set("undo", params.undo);

  if (typeof params.studentId === "number" && params.studentId > 0) {
    search.set("studentId", String(params.studentId));
  }

  if (params.studentNumber) search.set("studentNumber", params.studentNumber);
  if (params.studentName) search.set("studentName", params.studentName);

  if (params.prevStudentNumber) {
    search.set("prevStudentNumber", params.prevStudentNumber);
  }

  if (params.prevStudentName) {
    search.set("prevStudentName", params.prevStudentName);
  }

  if (typeof params.editId === "number" && params.editId > 0) {
    search.set("editId", String(params.editId));
  }

  if (params.editStudentNumber) {
    search.set("editStudentNumber", params.editStudentNumber);
  }

  if (params.editStudentName) {
    search.set("editStudentName", params.editStudentName);
  }

  if (typeof params.bulkAdded === "number") {
    search.set("bulkAdded", String(params.bulkAdded));
  }

  if (typeof params.bulkSkipped === "number") {
    search.set("bulkSkipped", String(params.bulkSkipped));
  }

  return `/admin/students?${search.toString()}`;
}

function isStrongEnoughPassword(password: string): boolean {
  if (password.length < 8) return false;

  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);

  return hasLetter && hasDigit;
}

function formatToastMessage(
  toast?: string,
  bulkAdded?: number,
  bulkSkipped?: number
): string | null {
  switch (toast) {
    case "added":
      return "生徒を追加しました";
    case "updated":
      return "保存しました";
    case "deleted":
      return "削除しました";
    case "undone":
      return "元に戻しました";
    case "duplicate":
      return "このクラス内で同じ学籍番号がすでに存在します";
    case "has_results":
      return "成績履歴がある生徒は削除できません";
    case "class_deleted":
      return "削除済みクラスは編集できません";
    case "error":
      return "入力内容を確認してください";
    case "password_reset":
      return "生徒パスワードを更新しました";
    case "weak_password":
      return "パスワードは8文字以上で、英字と数字を両方含めてください";
    case "bulk_added":
      return `${bulkAdded ?? 0}件追加しました${
        (bulkSkipped ?? 0) > 0 ? `（${bulkSkipped ?? 0}件をスキップ）` : ""
      }`;
    case "bulk_error":
      return "一括追加できませんでした。貼り付け内容を確認してください";
    default:
      return null;
  }
}

async function addStudent(formData: FormData) {
  "use server";

  const classId = Number(formData.get("classId"));
  const q = String(formData.get("q") || "").trim();
  const studentNumber = String(formData.get("studentNumber") || "").trim();
  const studentName = String(formData.get("studentName") || "").trim();
  const password = String(formData.get("password") || "").trim();

  if (!classId || !studentNumber || !studentName || !password) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "error",
        studentNumber,
        studentName,
      })
    );
  }

  if (!isStrongEnoughPassword(password)) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "weak_password",
        studentNumber,
        studentName,
      })
    );
  }

  const [classInfo] = await db
    .select({
      id: classes.id,
      deletedAt: classes.deletedAt,
    })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!classInfo || classInfo.deletedAt) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "class_deleted",
      })
    );
  }

  const [duplicate] = await db
    .select({
      id: students.id,
    })
    .from(students)
    .where(
      and(
        eq(students.classId, classId),
        eq(students.studentNumber, studentNumber)
      )
    )
    .limit(1);

  if (duplicate) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "duplicate",
        studentNumber,
        studentName,
      })
    );
  }

  const passwordHash = makeStudentPasswordHash(password);

  const [created] = await db
    .insert(students)
    .values({
      classId,
      studentNumber,
      studentName,
      passwordHash,
    })
    .returning({
      id: students.id,
      studentNumber: students.studentNumber,
      studentName: students.studentName,
    });

  revalidatePath("/admin/students");

  redirect(
    buildStudentsHref({
      classId,
      q,
      toast: "added",
      undo: "add",
      studentId: created.id,
      studentNumber: created.studentNumber,
      studentName: created.studentName,
    })
  );
}

async function bulkAddStudents(formData: FormData) {
  "use server";

  const classId = Number(formData.get("classId"));
  const q = String(formData.get("q") || "").trim();
  const bulkText = String(formData.get("bulkText") || "").replace(/\r\n/g, "\n");

  if (!classId || !bulkText.trim()) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "bulk_error",
      })
    );
  }

  const [classInfo] = await db
    .select({
      id: classes.id,
      deletedAt: classes.deletedAt,
    })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!classInfo || classInfo.deletedAt) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "class_deleted",
      })
    );
  }

  const lines = bulkText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "bulk_error",
      })
    );
  }

  const parsedRows = lines.map((line) => {
    const cols = line.split("\t");
    return {
      studentNumber: String(cols[0] ?? "").trim(),
      studentName: String(cols[1] ?? "").trim(),
      password: String(cols[2] ?? "").trim(),
    };
  });

  const numberCandidates = parsedRows
    .map((row) => row.studentNumber)
    .filter(Boolean);

  const existingRows =
    numberCandidates.length > 0
      ? await db
          .select({
            studentNumber: students.studentNumber,
          })
          .from(students)
          .where(
            and(
              eq(students.classId, classId),
              inArray(
                students.studentNumber,
                Array.from(new Set(numberCandidates))
              )
            )
          )
      : [];

  const existingNumberSet = new Set(
    existingRows.map((row) => row.studentNumber.trim())
  );
  const seenNumberSet = new Set<string>();

  const valuesToInsert: Array<{
    classId: number;
    studentNumber: string;
    studentName: string;
    passwordHash: string;
  }> = [];

  let skippedCount = 0;

  for (const row of parsedRows) {
    if (!row.studentNumber || !row.studentName || !row.password) {
      skippedCount += 1;
      continue;
    }

    if (!isStrongEnoughPassword(row.password)) {
      skippedCount += 1;
      continue;
    }

    if (
      existingNumberSet.has(row.studentNumber) ||
      seenNumberSet.has(row.studentNumber)
    ) {
      skippedCount += 1;
      continue;
    }

    seenNumberSet.add(row.studentNumber);

    valuesToInsert.push({
      classId,
      studentNumber: row.studentNumber,
      studentName: row.studentName,
      passwordHash: makeStudentPasswordHash(row.password),
    });
  }

  if (valuesToInsert.length === 0) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "bulk_error",
      })
    );
  }

  await db.insert(students).values(valuesToInsert);

  revalidatePath("/admin/students");

  redirect(
    buildStudentsHref({
      classId,
      q,
      toast: "bulk_added",
      bulkAdded: valuesToInsert.length,
      bulkSkipped: skippedCount,
    })
  );
}

async function deleteStudent(formData: FormData) {
  "use server";

  const id = Number(formData.get("id"));
  const classId = Number(formData.get("classId"));
  const q = String(formData.get("q") || "").trim();

  if (!id || !classId) {
    redirect("/admin/students");
  }

  const [classInfo] = await db
    .select({
      id: classes.id,
      deletedAt: classes.deletedAt,
    })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!classInfo || classInfo.deletedAt) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "class_deleted",
      })
    );
  }

  const [current] = await db
    .select({
      id: students.id,
    })
    .from(students)
    .where(eq(students.id, id))
    .limit(1);

  if (!current) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "deleted",
      })
    );
  }

  const [historyCountRow] = await db
    .select({
      count: count(studentScoreHistories.id),
    })
    .from(studentScoreHistories)
    .where(eq(studentScoreHistories.studentId, id));

  if (Number(historyCountRow?.count ?? 0) > 0) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "has_results",
      })
    );
  }

  await db.delete(students).where(eq(students.id, id));

  revalidatePath("/admin/students");

  redirect(
    buildStudentsHref({
      classId,
      q,
      toast: "deleted",
    })
  );
}

async function updateStudent(formData: FormData) {
  "use server";

  const id = Number(formData.get("id"));
  const classId = Number(formData.get("classId"));
  const q = String(formData.get("q") || "").trim();
  const studentNumber = String(formData.get("studentNumber") || "").trim();
  const studentName = String(formData.get("studentName") || "").trim();

  if (!id || !classId || !studentNumber || !studentName) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "error",
        editId: id,
        editStudentNumber: studentNumber,
        editStudentName: studentName,
      })
    );
  }

  const [classInfo] = await db
    .select({
      id: classes.id,
      deletedAt: classes.deletedAt,
    })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!classInfo || classInfo.deletedAt) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "class_deleted",
      })
    );
  }

  const [current] = await db
    .select({
      id: students.id,
      studentNumber: students.studentNumber,
      studentName: students.studentName,
    })
    .from(students)
    .where(eq(students.id, id))
    .limit(1);

  if (!current) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "error",
        editId: id,
        editStudentNumber: studentNumber,
        editStudentName: studentName,
      })
    );
  }

  const [duplicate] = await db
    .select({
      id: students.id,
    })
    .from(students)
    .where(
      and(
        eq(students.classId, classId),
        eq(students.studentNumber, studentNumber)
      )
    )
    .limit(1);

  if (duplicate && duplicate.id !== id) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "duplicate",
        editId: id,
        editStudentNumber: studentNumber,
        editStudentName: studentName,
      })
    );
  }

  await db
    .update(students)
    .set({
      studentNumber,
      studentName,
    })
    .where(eq(students.id, id));

  revalidatePath("/admin/students");

  redirect(
    buildStudentsHref({
      classId,
      q,
      toast: "updated",
      undo: "update",
      studentId: id,
      prevStudentNumber: current.studentNumber,
      prevStudentName: current.studentName,
    })
  );
}

async function resetStudentPassword(formData: FormData) {
  "use server";

  const id = Number(formData.get("id"));
  const classId = Number(formData.get("classId"));
  const q = String(formData.get("q") || "").trim();
  const newPassword = String(formData.get("newPassword") || "").trim();

  if (!id || !classId || !newPassword) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "error",
      })
    );
  }

  if (!isStrongEnoughPassword(newPassword)) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "weak_password",
      })
    );
  }

  const [classInfo] = await db
    .select({
      id: classes.id,
      deletedAt: classes.deletedAt,
    })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!classInfo || classInfo.deletedAt) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "class_deleted",
      })
    );
  }

  const [current] = await db
    .select({
      id: students.id,
    })
    .from(students)
    .where(eq(students.id, id))
    .limit(1);

  if (!current) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "error",
      })
    );
  }

  await db
    .update(students)
    .set({
      passwordHash: makeStudentPasswordHash(newPassword),
    })
    .where(eq(students.id, id));

  revalidatePath("/admin/students");

  redirect(
    buildStudentsHref({
      classId,
      q,
      toast: "password_reset",
    })
  );
}

async function undoStudentAction(formData: FormData) {
  "use server";

  const undo = String(formData.get("undo") || "");
  const classId = Number(formData.get("classId"));
  const q = String(formData.get("q") || "").trim();
  const studentId = Number(formData.get("studentId"));
  const prevStudentNumber = String(
    formData.get("prevStudentNumber") || ""
  ).trim();
  const prevStudentName = String(formData.get("prevStudentName") || "").trim();

  if (!classId) {
    redirect("/admin/students");
  }

  const [classInfo] = await db
    .select({
      id: classes.id,
      deletedAt: classes.deletedAt,
    })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!classInfo || classInfo.deletedAt) {
    redirect(
      buildStudentsHref({
        classId,
        q,
        toast: "class_deleted",
      })
    );
  }

  if (undo === "add" && studentId) {
    await db.delete(students).where(eq(students.id, studentId));
  }

  if (undo === "update" && studentId && prevStudentNumber && prevStudentName) {
    await db
      .update(students)
      .set({
        studentNumber: prevStudentNumber,
        studentName: prevStudentName,
      })
      .where(eq(students.id, studentId));
  }

  revalidatePath("/admin/students");

  redirect(
    buildStudentsHref({
      classId,
      q,
      toast: "undone",
    })
  );
}

export default async function StudentsPage(props: {
  searchParams?: SearchParams;
}) {
  const session = await getAdminSession();

  if (!session || (session.role !== "teacher" && session.role !== "admin")) {
    redirect("/admin/login");
  }

  const searchParams = props.searchParams ? await props.searchParams : {};

  const classId = Number(searchParams.classId || 0);
  const q = (searchParams.q ?? "").trim();
  const toast = searchParams.toast;
  const undo = searchParams.undo;
  const studentId = Number(searchParams.studentId || 0);
  const studentNumber = (searchParams.studentNumber ?? "").trim();
  const studentName = (searchParams.studentName ?? "").trim();
  const prevStudentNumber = (searchParams.prevStudentNumber ?? "").trim();
  const prevStudentName = (searchParams.prevStudentName ?? "").trim();
  const editId = Number(searchParams.editId || 0);
  const editStudentNumber = (searchParams.editStudentNumber ?? "").trim();
  const editStudentName = (searchParams.editStudentName ?? "").trim();
  const bulkAdded = Number(searchParams.bulkAdded || 0);
  const bulkSkipped = Number(searchParams.bulkSkipped || 0);

  const toastMessage = formatToastMessage(toast, bulkAdded, bulkSkipped);

  const classInfo = classId
    ? await db
        .select({
          id: classes.id,
          name: classes.name,
          deletedAt: classes.deletedAt,
        })
        .from(classes)
        .where(eq(classes.id, classId))
        .limit(1)
    : [];

  const classRow = classInfo[0] ?? null;
  const isDeletedClass = Boolean(classRow?.deletedAt);

  const studentRows = classId
    ? await db
        .select({
          id: students.id,
          classId: students.classId,
          studentNumber: students.studentNumber,
          studentName: students.studentName,
          createdAt: students.createdAt,
        })
        .from(students)
        .where(
          q
            ? and(
                eq(students.classId, classId),
                or(
                  ilike(students.studentNumber, `%${q}%`),
                  ilike(students.studentName, `%${q}%`)
                )
              )
            : eq(students.classId, classId)
        )
        .orderBy(asc(students.studentNumber), asc(students.id))
    : [];

  const addFormStudentNumber =
    toast === "duplicate" && !editId
      ? studentNumber
      : toast === "error" && !editId
        ? studentNumber
        : "";

  const addFormStudentName =
    toast === "duplicate" && !editId
      ? studentName
      : toast === "error" && !editId
        ? studentName
        : "";

  return (
    <main className="min-h-screen bg-slate-50 p-6 space-y-6">
      {toastMessage ? (
        <AutoHideToast
          message={toastMessage}
          undo={undo}
          classId={classId}
          q={q}
          studentId={studentId}
          prevStudentNumber={prevStudentNumber}
          prevStudentName={prevStudentName}
          undoAction={undoStudentAction}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">
          生徒名簿管理{" "}
          {classRow ? `（${classRow.name}${isDeletedClass ? "・削除済み" : ""}）` : ""}
        </h1>

        <div className="flex gap-2">
          <Link
            href="/admin/classes"
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            クラス一覧へ
          </Link>
        </div>
      </div>

      {!classId ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-800">
          classId が指定されていません。クラス一覧から移動してください。
        </div>
      ) : !classRow ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-800">
          指定されたクラスが見つかりません。
        </div>
      ) : (
        <>
          {isDeletedClass ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-900">
              このクラスは削除済みです。生徒の閲覧はできますが、追加・編集・削除はできません。
            </div>
          ) : null}

          <div className="space-y-2">
            <form
              method="get"
              className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
            >
              <input type="hidden" name="classId" value={classId} />

              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="学籍番号・氏名で検索"
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
                  href={`/admin/students?classId=${classId}`}
                  className="whitespace-nowrap rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  クリア
                </Link>
              </div>
            </form>

            <div className="px-1 text-sm font-semibold text-slate-600">
              {q
                ? `検索結果 ${studentRows.length}件`
                : `登録生徒 ${studentRows.length}件`}
            </div>
          </div>

          {!isDeletedClass ? (
            <>
              <form
                action={addStudent}
                className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <input type="hidden" name="classId" value={classId} />
                <input type="hidden" name="q" value={q} />

                <div className="space-y-1">
                  <h2 className="text-base font-bold text-slate-900">
                    生徒を追加
                  </h2>
                  <p className="text-sm text-slate-600">
                    学籍番号・氏名・初期パスワードを設定して追加します。
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    name="studentNumber"
                    defaultValue={addFormStudentNumber}
                    placeholder="学籍番号"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                  />

                  <input
                    name="studentName"
                    defaultValue={addFormStudentName}
                    placeholder="氏名"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                  />

                  <input
                    type="password"
                    name="password"
                    placeholder="初期パスワード"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                  />
                </div>

                <p className="text-xs text-slate-500">
                  パスワードは8文字以上で、英字と数字を両方含めてください。
                </p>

                <div>
                  <button className="whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700">
                    追加
                  </button>
                </div>
              </form>

              <form
                action={bulkAddStudents}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
              >
                <input type="hidden" name="classId" value={classId} />
                <input type="hidden" name="q" value={q} />

                <div className="space-y-1">
                  <h2 className="text-base font-bold text-slate-900">
                    Excel から一括追加
                  </h2>
                  <p className="text-sm text-slate-600">
                    Excelで「学籍番号 / 氏名 / 初期パスワード」の3列を選んで、そのまま貼り付けてください。
                  </p>
                </div>

                <textarea
                  name="bulkText"
                  rows={8}
                  placeholder={`1001\t山田太郎\tyamada1001\n1002\t佐藤花子\tsato1002`}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                />

                <p className="text-xs text-slate-500">
                  タブ区切り・1行1人です。不正な行、空欄行、同じクラス内で重複する学籍番号はスキップします。
                </p>

                <div>
                  <button className="whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800">
                    一括追加
                  </button>
                </div>
              </form>
            </>
          ) : null}

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr className="text-left text-slate-700">
                    <th className="border-b border-slate-200 px-4 py-3 font-bold">
                      ID
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-bold">
                      学籍番号
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-bold">
                      氏名
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-bold">
                      操作
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {studentRows.map((s) => {
                    const isEditingErrorRow =
                      editId === s.id &&
                      (toast === "duplicate" || toast === "error");

                    const rowStudentNumber = isEditingErrorRow
                      ? editStudentNumber
                      : s.studentNumber;

                    const rowStudentName = isEditingErrorRow
                      ? editStudentName
                      : s.studentName;

                    return (
                      <tr
                        key={s.id}
                        className={
                          isEditingErrorRow
                            ? "border-t border-slate-200 bg-amber-50/80"
                            : "border-t border-slate-200"
                        }
                      >
                        <td className="px-4 py-3 align-top text-slate-700">
                          {s.id}
                        </td>

                        {isDeletedClass ? (
                          <>
                            <td className="px-4 py-3 align-top text-slate-700">
                              {s.studentNumber}
                            </td>
                            <td className="px-4 py-3 align-top text-slate-900">
                              {s.studentName}
                            </td>
                            <td className="w-[180px] px-4 py-3 align-top">
                              <Link
                                href={`/admin/students/${s.id}`}
                                className="inline-flex whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-slate-100"
                              >
                                詳細 →
                              </Link>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 align-top" colSpan={2}>
                              <div className="space-y-2">
                                <form
                                  action={updateStudent}
                                  className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
                                >
                                  <input type="hidden" name="id" value={s.id} />
                                  <input
                                    type="hidden"
                                    name="classId"
                                    value={classId}
                                  />
                                  <input type="hidden" name="q" value={q} />

                                  <input
                                    name="studentNumber"
                                    defaultValue={rowStudentNumber}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 sm:w-36 sm:min-w-[9rem]"
                                  />

                                  <input
                                    name="studentName"
                                    defaultValue={rowStudentName}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 sm:min-w-[14rem] sm:flex-1"
                                  />

                                  <button className="whitespace-nowrap rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 sm:shrink-0">
                                    保存
                                  </button>

                                  <Link
                                    href={`/admin/students/${s.id}`}
                                    className="whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-slate-100 sm:shrink-0"
                                  >
                                    詳細 →
                                  </Link>
                                </form>

                                <form
                                  action={resetStudentPassword}
                                  className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
                                >
                                  <input type="hidden" name="id" value={s.id} />
                                  <input
                                    type="hidden"
                                    name="classId"
                                    value={classId}
                                  />
                                  <input type="hidden" name="q" value={q} />

                                  <input
                                    type="password"
                                    name="newPassword"
                                    placeholder="新しいパスワード"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 sm:w-56 sm:min-w-[14rem]"
                                  />

                                  <button className="whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 sm:shrink-0">
                                    パスワード変更
                                  </button>
                                </form>
                              </div>
                            </td>

                            <td className="w-[140px] px-4 py-3 align-top">
                              <form action={deleteStudent}>
                                <input type="hidden" name="id" value={s.id} />
                                <input
                                  type="hidden"
                                  name="classId"
                                  value={classId}
                                />
                                <input type="hidden" name="q" value={q} />
                                <StudentDeleteButton
                                  studentName={s.studentName}
                                  studentNumber={s.studentNumber}
                                />
                              </form>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}

                  {studentRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        {q
                          ? "検索条件に一致する生徒がいません。"
                          : "まだ生徒が登録されていません。"}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

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
      `}</style>
    </main>
  );
}