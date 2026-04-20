"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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

type NameCandidate = {
  id: number;
  studentNumber: string;
  studentName: string;
};

export default function LoginForm({
  initialError,
  loginAction,
  classes,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [isPending, startTransition] = useTransition();

  const [classId, setClassId] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");

  const [candidates, setCandidates] = useState<NameCandidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const lastAutoFilledNameRef = useRef("");
  const trimmedStudentName = useMemo(() => studentName.trim(), [studentName]);

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

  useEffect(() => {
    if (!classId || trimmedStudentName.length < 2) {
      setCandidates([]);
      setHasSearched(false);
      setIsLoadingCandidates(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        setIsLoadingCandidates(true);
        setHasSearched(true);

        const params = new URLSearchParams({
          classId,
          q: trimmedStudentName,
        });

        const res = await fetch(
          `/api/student-auth/name-candidates?${params.toString()}`,
          {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
          }
        );

        if (!res.ok) {
          throw new Error(`候補取得失敗: ${res.status}`);
        }

        const data = (await res.json()) as {
          ok: boolean;
          candidates?: NameCandidate[];
        };

        const list = Array.isArray(data.candidates) ? data.candidates : [];
        setCandidates(list);

        if (list.length === 1) {
          const only = list[0];

          setStudentName(only.studentName);
          setStudentNumber(only.studentNumber);
          setCandidates([]);
          lastAutoFilledNameRef.current = only.studentName;
        } else {
          lastAutoFilledNameRef.current = "";
        }
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          console.error("name candidates fetch error:", fetchError);
          setCandidates([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCandidates(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [classId, trimmedStudentName]);

  function selectCandidate(candidate: NameCandidate) {
    setStudentName(candidate.studentName);
    setStudentNumber(candidate.studentNumber);
    setCandidates([]);
    setHasSearched(true);
    lastAutoFilledNameRef.current = candidate.studentName;
  }

  const shouldShowHintNoClass = !classId;
  const shouldShowHintNeedMoreChars =
    !!classId && trimmedStudentName.length > 0 && trimmedStudentName.length < 2;

  const wasAutoFilled =
    trimmedStudentName.length > 0 &&
    trimmedStudentName === lastAutoFilledNameRef.current &&
    !!studentNumber;

  const shouldShowCandidateBox = !!classId && trimmedStudentName.length >= 2;
  const shouldShowNoMatch =
    shouldShowCandidateBox &&
    !isLoadingCandidates &&
    hasSearched &&
    candidates.length === 0 &&
    !wasAutoFilled;

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
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setStudentName("");
              setStudentNumber("");
              setCandidates([]);
              setHasSearched(false);
              lastAutoFilledNameRef.current = "";
            }}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
          >
            <option value="">クラスを選択</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
            value={studentNumber}
            onChange={(e) => setStudentNumber(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            placeholder="例: 240001"
          />
        </div>

        <div className="relative">
          <label className="mb-1 block text-xs font-bold text-slate-600">
            氏名
          </label>
          <input
            type="text"
            name="studentName"
            value={studentName}
            onChange={(e) => {
              setStudentName(e.target.value);
              setStudentNumber("");
              lastAutoFilledNameRef.current = "";
            }}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
            placeholder="例: 山田 太郎"
          />

          {shouldShowHintNoClass ? (
            <p className="mt-2 text-xs text-slate-500">
              先にクラスを選択してください。
            </p>
          ) : null}

          {shouldShowHintNeedMoreChars ? (
            <p className="mt-2 text-xs text-slate-500">
              氏名を2文字以上入力すると候補が表示されます。
            </p>
          ) : null}

          {wasAutoFilled ? (
            <p className="mt-2 text-xs text-emerald-600">
              氏名から学籍番号を自動入力しました。
            </p>
          ) : null}

          {shouldShowCandidateBox ? (
            <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
              {isLoadingCandidates ? (
                <div className="px-3 py-2 text-xs text-slate-500">
                  検索中...
                </div>
              ) : candidates.length > 0 ? (
                <ul className="space-y-1">
                  {candidates.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => selectCandidate(c)}
                        className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                      >
                        <span className="font-medium text-slate-900">
                          {c.studentName}
                        </span>
                        <span className="text-xs text-slate-500">
                          {c.studentNumber}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : shouldShowNoMatch ? (
                <div className="px-3 py-2 text-xs text-slate-500">
                  一致する候補はありません。
                </div>
              ) : null}
            </div>
          ) : null}
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