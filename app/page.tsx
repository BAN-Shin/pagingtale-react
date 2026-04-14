import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12 md:px-10 lg:px-12">
        <header className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">
              PagingTale
            </p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">
              デジタル教材を、読みやすく・使いやすく
            </h1>
          </div>

          <nav className="hidden items-center gap-3 sm:flex">
            <Link
              href="/books"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              教材一覧
            </Link>
            <Link
              href="/admin"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              管理画面
            </Link>
          </nav>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-8">
            <div className="space-y-5">
              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
                教材閲覧・問題配信・学習支援
              </span>

              <div className="space-y-4">
                <h2 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
                  PagingTale
                </h2>
                <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                  絵の描き方、美術鑑賞、デジタル表現などの教材を、
                  ページをめくる感覚で閲覧できる教材プラットフォームです。
                  作品・動画・問題を組み合わせて、学びをひとつの流れにまとめます。
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/books"
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-base font-bold text-white transition hover:bg-blue-700"
                >
                  教材一覧を見る
                </Link>

                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-6 py-3 text-base font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  管理画面へ
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-semibold text-slate-900">教材を読む</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  複数教材を一覧から選んで、すぐに閲覧できます。
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-semibold text-slate-900">問題に取り組む</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  教材に合わせて問題や確認テストを組み込めます。
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-semibold text-slate-900">授業で活用する</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  学校や講座で使いやすい形で教材を整理できます。
                </p>
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-6 shadow-sm md:p-8">
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-slate-500">おすすめ導線</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">
                  まずは教材一覧から
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  本番公開後の導線としては、トップページから
                  <span className="font-semibold text-slate-900"> /books </span>
                  に案内するのが最優先です。
                </p>
              </div>

              <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <p className="text-sm font-medium text-slate-500">公開中の主な動線</p>
                <div className="mt-4 space-y-3">
                  <Link
                    href="/books"
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    <span>教材一覧</span>
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link
                    href="/admin"
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    <span>管理画面</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 p-5">
                <p className="text-sm font-semibold text-slate-700">次の整備候補</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  books.json の正式運用、トップの見た目調整、
                  本番環境での動画・画像パス確認を進めると全体が安定します。
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}