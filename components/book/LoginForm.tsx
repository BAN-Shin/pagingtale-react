"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type LoginActionResult = {
  ok: boolean;
  message: string;
};

type Props = {
  initialError: string | null;
  loginAction: (formData: FormData) => Promise<LoginActionResult>;
  classes: { id: number; name: string }[];
};

export default function LoginForm({
  initialError,
  loginAction,
  classes,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);

    const result = await loginAction(formData);

    if (!result.ok) {
      setError(result.message || "ログインに失敗しました。");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-slate-900">生徒ログイン</h2>
        <p className="text-sm text-slate-600">
          クラス・学籍番号・氏名・パスワードを入力してください。
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <form action={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">
            クラス
          </label>
          <select
            name="classId"
            defaultValue=""
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
          >
            <option value="">クラスを選択</option>
            {classes.map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">
            学籍番号
          </label>
          <input
            type="text"
            name="studentNumber"
            autoComplete="username"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            placeholder="例: 240001"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">
            氏名
          </label>
          <input
            type="text"
            name="studentName"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            placeholder="例: 山田 太郎"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">
            パスワード
          </label>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            placeholder="パスワード"
          />
        </div>

        <p className="text-xs text-slate-500">
          パスワードを忘れた場合は、先生に連絡してください。
        </p>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "ログイン中..." : "ログインして教材一覧を開く"}
        </button>
      </form>
    </section>
  );
}