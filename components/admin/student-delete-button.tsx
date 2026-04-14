"use client";

type StudentDeleteButtonProps = {
  studentName: string;
  studentNumber: string;
};

export default function StudentDeleteButton({
  studentName,
  studentNumber,
}: StudentDeleteButtonProps) {
  return (
    <button
      type="submit"
      className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
      onClick={(event) => {
        const label =
          studentNumber && studentName
            ? `${studentNumber} ${studentName}`
            : studentName || studentNumber || "この生徒";

        const ok = window.confirm(`「${label}」を削除します。よろしいですか？`);

        if (!ok) {
          event.preventDefault();
        }
      }}
    >
      削除
    </button>
  );
}