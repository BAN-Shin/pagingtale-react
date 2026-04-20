"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ChangePasswordResponse = {
  ok: boolean;
  message: string;
};

export default function ChangePasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword.trim() || !nextPassword.trim() || !confirmPassword.trim()) {
      setError("現在のパスワード・新しいパスワード・確認用パスワードを入力してください。");
      return;
    }

    if (nextPassword.trim().length < 4) {
      setError("新しいパスワードは4文字以上で入力してください。");
      return;
    }

    if (nextPassword !== confirmPassword) {
      setError("新しいパスワードと確認用パスワードが一致しません。");
      return;
    }

    if (currentPassword === nextPassword) {
      setError("現在のパスワードと異なる新しいパスワードを入力してください。");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/student-auth/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword,
            nextPassword,
            confirmPassword,
          }),
        });

        const data = (await response.json()) as ChangePasswordResponse;

        if (!response.ok || !data.ok) {
          setError(data.message || "パスワード変更に失敗しました。");
          return;
        }

        setSuccess(data.message || "パスワードを変更しました。");
        setCurrentPassword("");
        setNextPassword("");
        setConfirmPassword("");

        router.refresh();
      } catch (submitError) {
        console.error("change password submit error:", submitError);
        setError("パスワード変更中にエラーが発生しました。");
      }
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-slate-900">生徒用パスワード変更</h2>
        <p className="text-sm text-slate-600">
          変更後は、新しいパスワードでログインしてください。
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">
            現在のパスワード
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            placeholder="現在のパスワード"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">
            新しいパスワード
          </label>
          <input
            type="password"
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
            autoComplete="new-password"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            placeholder="新しいパスワード"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">
            新しいパスワード（確認）
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            placeholder="確認用"
          />
        </div>

        <p className="text-xs text-slate-500">
          他人に推測されにくいパスワードを設定してください。
        </p>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "変更中..." : "パスワードを変更する"}
        </button>
      </form>
    </section>
  );
}