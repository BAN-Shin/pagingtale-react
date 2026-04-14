"use client";

type Props = {
  classNameValue: string;
};

export function ClassDeleteButton({ classNameValue }: Props) {
  return (
    <button
      type="submit"
      className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
      onClick={(event) => {
        const ok = window.confirm(
          `クラス「${classNameValue}」を削除します。よろしいですか？`
        );

        if (!ok) {
          event.preventDefault();
        }
      }}
    >
      削除
    </button>
  );
}