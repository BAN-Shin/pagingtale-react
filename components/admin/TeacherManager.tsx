"use client";

import { useEffect, useState } from "react";

type Teacher = {
  id: number;
  loginId: string;
  teacherName: string;
  role: string;
  isActive: boolean;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  teachers?: Teacher[];
  teacher?: Teacher;
};

export default function TeacherManager() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loginId, setLoginId] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [password, setPassword] = useState("");

  const [editingTeacherId, setEditingTeacherId] = useState<number | null>(null);
  const [editingTeacherName, setEditingTeacherName] = useState("");
  const [resetTargetId, setResetTargetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/teachers", {
      cache: "no-store",
    });

    const data = (await res.json()) as ApiResponse;

    if (data.ok && Array.isArray(data.teachers)) {
      setTeachers(data.teachers);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  async function createTeacher() {
    setErrorMessage(null);
    setToastMessage(null);

    if (!loginId.trim() || !teacherName.trim() || !password.trim()) {
      setErrorMessage("ログインID・名前・パスワードを入力してください。");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/admin/teachers/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loginId,
          teacherName,
          password,
        }),
      });

      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.ok) {
        setErrorMessage(
          data.message || "教師アカウントの追加に失敗しました。"
        );
        return;
      }

      setLoginId("");
      setTeacherName("");
      setPassword("");
      setToastMessage(data.message || "教師アカウントを追加しました。");
      await load();
    } catch (error) {
      console.error("createTeacher error:", error);
      setErrorMessage("教師アカウントの追加中にエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggle(id: number) {
    setErrorMessage(null);
    setToastMessage(null);

    try {
      const res = await fetch(`/api/admin/teachers/${id}/toggle-active`, {
        method: "POST",
      });

      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.ok) {
        setErrorMessage(data.message || "有効 / 無効の切替に失敗しました。");
        return;
      }

      setToastMessage(data.message || "状態を更新しました。");
      await load();
    } catch (error) {
      console.error("toggle teacher active error:", error);
      setErrorMessage("状態更新中にエラーが発生しました。");
    }
  }

  function startEdit(teacher: Teacher) {
    setErrorMessage(null);
    setToastMessage(null);
    setEditingTeacherId(teacher.id);
    setEditingTeacherName(teacher.teacherName);
  }

  function cancelEdit() {
    setEditingTeacherId(null);
    setEditingTeacherName("");
  }

  async function saveTeacherName(id: number) {
    setErrorMessage(null);
    setToastMessage(null);

    if (!editingTeacherName.trim()) {
      setErrorMessage("名前を入力してください。");
      return;
    }

    try {
      const res = await fetch(`/api/admin/teachers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teacherName: editingTeacherName,
        }),
      });

      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.ok) {
        setErrorMessage(data.message || "教師名の更新に失敗しました。");
        return;
      }

      setToastMessage(data.message || "教師名を更新しました。");
      setEditingTeacherId(null);
      setEditingTeacherName("");
      await load();
    } catch (error) {
      console.error("save teacher name error:", error);
      setErrorMessage("教師名の更新中にエラーが発生しました。");
    }
  }

  function startResetPassword(id: number) {
    setErrorMessage(null);
    setToastMessage(null);
    setResetTargetId(id);
    setResetPassword("");
  }

  function cancelResetPassword() {
    setResetTargetId(null);
    setResetPassword("");
  }

  async function submitResetPassword(id: number) {
    setErrorMessage(null);
    setToastMessage(null);

    if (!resetPassword.trim()) {
      setErrorMessage("新しいパスワードを入力してください。");
      return;
    }

    try {
      const res = await fetch(`/api/admin/teachers/${id}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newPassword: resetPassword,
        }),
      });

      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.ok) {
        setErrorMessage(data.message || "パスワードリセットに失敗しました。");
        return;
      }

      setToastMessage(data.message || "パスワードをリセットしました。");
      setResetTargetId(null);
      setResetPassword("");
    } catch (error) {
      console.error("reset teacher password error:", error);
      setErrorMessage("パスワードリセット中にエラーが発生しました。");
    }
  }

  return (
    <div className="p-6 space-y-6">
      {toastMessage ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
          {toastMessage}
        </div>
      ) : null}

      <h1 className="text-xl font-bold">教師管理</h1>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">教師追加</h2>
          <p className="text-sm text-slate-600">
            ログインIDの重複チェックとパスワード強度チェック付きです。
          </p>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <input
            placeholder="ログインID"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
          />
          <input
            placeholder="名前"
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
          />
        </div>

        <p className="text-xs text-slate-500">
          パスワードは8文字以上で、英字と数字を両方含めてください。
        </p>

        <button
          onClick={createTeacher}
          disabled={isSubmitting}
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "追加中..." : "教師を追加"}
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900">教師一覧</h2>

        <div className="space-y-3">
          {teachers.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  {editingTeacherId === t.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={editingTeacherName}
                        onChange={(e) => setEditingTeacherName(e.target.value)}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                      />
                      <button
                        onClick={() => void saveTeacherName(t.id)}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <div className="font-bold text-slate-900">{t.teacherName}</div>
                  )}

                  <div className="text-sm text-slate-600">{t.loginId}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t.role}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      t.isActive
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {t.isActive ? "有効" : "無効"}
                  </span>

                  {editingTeacherId !== t.id ? (
                    <button
                      onClick={() => startEdit(t)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                    >
                      名前変更
                    </button>
                  ) : null}

                  {resetTargetId !== t.id ? (
                    <button
                      onClick={() => startResetPassword(t.id)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                    >
                      パスワードリセット
                    </button>
                  ) : null}

                  <button
                    onClick={() => toggle(t.id)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                  >
                    切替
                  </button>
                </div>
              </div>

              {resetTargetId === t.id ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="space-y-2">
                    <div className="text-sm font-bold text-slate-900">
                      パスワードリセット
                    </div>
                    <input
                      type="password"
                      placeholder="新しいパスワード"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                    />
                    <p className="text-xs text-slate-500">
                      8文字以上で、英字と数字を両方含めてください。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void submitResetPassword(t.id)}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                      >
                        リセット実行
                      </button>
                      <button
                        onClick={cancelResetPassword}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}