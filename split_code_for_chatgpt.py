import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog


EXPORT_DIR = Path(r"C:\Users\bants\Downloads\Export")


def split_text_by_lines(text: str, max_lines: int) -> list[str]:
    lines = text.splitlines()

    if not lines:
        return [""]

    chunks: list[str] = []
    total_lines = len(lines)

    for i in range(0, total_lines, max_lines):
        chunk = "\n".join(lines[i:i + max_lines])

        # 元ファイル末尾が改行なら、最後のチャンクにも改行を維持
        if i + max_lines >= total_lines and text.endswith("\n"):
            chunk += "\n"

        chunks.append(chunk)

    return chunks


def main() -> None:
    root = tk.Tk()
    root.withdraw()
    root.update()

    source_path_str = filedialog.askopenfilename(
        title="分割するファイルを選択してください",
        filetypes=[
            ("テキスト / コード", "*.tsx *.ts *.jsx *.js *.json *.css *.html *.md *.txt *.py"),
            ("すべてのファイル", "*.*"),
        ],
    )

    if not source_path_str:
        messagebox.showinfo("中止", "ファイル選択がキャンセルされました。")
        return

    max_lines = simpledialog.askinteger(
        "分割行数",
        "1ファイルあたりの行数を入力してください。\nおすすめ: 300〜500\n既定値: 400",
        parent=root,
        minvalue=50,
        maxvalue=5000,
        initialvalue=400,
    )

    if max_lines is None:
        messagebox.showinfo("中止", "分割行数の入力がキャンセルされました。")
        return

    source_path = Path(source_path_str)
    output_dir = EXPORT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    text = source_path.read_text(encoding="utf-8")
    chunks = split_text_by_lines(text, max_lines)
    total = len(chunks)

    stem = source_path.stem
    suffix = source_path.suffix.lstrip(".") or "txt"
    digits = max(2, len(str(total)))

    created_files: list[Path] = []

    for index, chunk in enumerate(chunks, start=1):
        chunk_name = f"{stem}{index:0{digits}d}.txt"
        out_path = output_dir / chunk_name

        header = (
            f"{source_path.name}\n"
            f"PART {index}/{total}\n"
            f"元拡張子: .{suffix}\n"
            f"---\n"
        )

        out_path.write_text(header + chunk, encoding="utf-8")
        created_files.append(out_path)

    preview = "\n".join(str(p) for p in created_files[:10])
    if len(created_files) > 10:
        preview += f"\n...ほか {len(created_files) - 10} 件"

    messagebox.showinfo(
        "完了",
        (
            f"分割が完了しました。\n\n"
            f"入力ファイル:\n{source_path}\n\n"
            f"出力先:\n{output_dir}\n\n"
            f"作成数: {len(created_files)}\n"
            f"1ファイルあたり行数: {max_lines}\n\n"
            f"{preview}"
        ),
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        try:
            root = tk.Tk()
            root.withdraw()
            messagebox.showerror(
                "エラー",
                f"処理中にエラーが発生しました。\n\n{exc}"
            )
        except Exception:
            print(f"エラー: {exc}")