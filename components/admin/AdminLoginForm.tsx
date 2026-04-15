"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const response = await fetch("/api/admin-auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loginId: loginId.trim(),
          password: password.trim(),
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
        setError(parsed?.message || "教師ログインに失敗しました。");
        return;
      }

      startTransition(() => {
        window.location.href = "/admin/submissions";
      });
    } catch (submitError) {
      console.error("admin login form error:", submitError);
      setError("教師ログイン中にエラーが発生しました。");
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">
            ログインID
          </label>
          <input
            type="text"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            placeholder="例: teacher001"
            autoComplete="username"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">
            パスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            placeholder="パスワード"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "ログイン中..." : "教師ログイン"}
        </button>
      </form>
    </section>
  );
}