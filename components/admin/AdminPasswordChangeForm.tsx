"use client";

import { useState } from "react";

export default function AdminPasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const normalizedCurrent = currentPassword.trim();
    const normalizedNew = newPassword.trim();
    const normalizedConfirm = confirmPassword.trim();

    if (!normalizedCurrent || !normalizedNew || !normalizedConfirm) {
      setErrorMessage(
        "現在のパスワード・新しいパスワード・確認用パスワードを入力してください。"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin-auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: normalizedCurrent,
          newPassword: normalizedNew,
          confirmPassword: normalizedConfirm,
        }),
      });

      const text = await response.text();

      let parsed:
        | {
            ok?: boolean;
            message?: string;
          }
        | null = null;

      try {
        parsed = JSON.parse(text) as {
          ok?: boolean;
          message?: string;
        };
      } catch {
        parsed = null;
      }

      if (!response.ok || !parsed?.ok) {
        setErrorMessage(parsed?.message || "パスワード変更に失敗しました。");
        return;
      }

      setSuccessMessage(parsed.message || "パスワードを変更しました。");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("change password form error:", error);
      setErrorMessage("パスワード変更中にエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-slate-900">パスワード変更</h2>
        <p className="text-sm text-slate-600">
          現在のパスワードを確認したうえで、新しいパスワードに変更します。
        </p>
      </div>

      {successMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">
            現在のパスワード
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            autoComplete="current-password"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">
            新しいパスワード
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-slate-500">
            8文字以上をおすすめします。
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">
            新しいパスワード（確認）
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "変更中..." : "パスワードを変更"}
        </button>
      </form>
    </section>
  );
}