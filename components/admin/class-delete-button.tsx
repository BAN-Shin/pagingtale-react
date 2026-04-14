"use client";

type ClassDeleteButtonProps = {
  classNameValue: string;
};

export default function ClassDeleteButton({
  classNameValue,
}: ClassDeleteButtonProps) {
  return (
    <button
      type="submit"
      className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
      onClick={(event) => {
        const ok = window.confirm(
          `「${classNameValue}」を削除します。よろしいですか？`
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