import os
import re
import shutil
import sys
from pathlib import Path
from tkinter import Tk, filedialog
from typing import Optional

INSERT_SPREAD_PAGES = 2
HTML_GLOB = "mov_part_*.html"
TEXT_FILE_EXTS = {
    ".html", ".htm", ".css", ".js", ".json", ".svg", ".txt", ".xml", ".md"
}


def pad3(n: int) -> str:
    return f"{n:03d}"


def page_html_name(n: int) -> str:
    return f"mov_part_{pad3(n)}.html"


def material_dir_name(n: int) -> str:
    return f"page_{pad3(n)}"


def normalize_spread_start(page_num: int) -> int:
    """
    見開き開始ページは偶数に揃える
    005 が選択されたら 004-005 の見開きを対象にする
    """
    if page_num % 2 == 1:
        normalized = page_num - 1
        print(f"奇数ページ {pad3(page_num)} が選択されたため、見開き開始ページを {pad3(normalized)} に補正します。")
        return normalized
    return page_num


def choose_html_file() -> Path:
    root = Tk()
    root.withdraw()
    root.update()
    file_path = filedialog.askopenfilename(
        title="挿入基準にする pages\\mov_part_XXX.html を選択",
        filetypes=[("HTML files", "*.html"), ("All files", "*.*")]
    )
    root.destroy()

    if not file_path:
        raise RuntimeError("ファイルが選択されませんでした。")

    return Path(file_path)


def detect_project_root_from_selected_file(selected_file: Path) -> tuple[Path, Path, Path]:
    pages_dir = selected_file.parent
    if pages_dir.name.lower() != "pages":
        raise RuntimeError("pages フォルダ内の mov_part_XXX.html を選択してください。")

    project_root = pages_dir.parent
    material_dir = project_root / "material"

    if not material_dir.exists():
        raise RuntimeError(f"material フォルダが見つかりません: {material_dir}")

    return project_root, pages_dir, material_dir


def extract_page_number_from_html_path(path: Path) -> int:
    m = re.fullmatch(r"mov_part_(\d{3})\.html", path.name, re.IGNORECASE)
    if not m:
        raise RuntimeError("mov_part_XXX.html の形式のファイルを選択してください。")
    return int(m.group(1))


def find_last_page_number(pages_dir: Path) -> int:
    nums = []
    for p in pages_dir.glob(HTML_GLOB):
        m = re.fullmatch(r"mov_part_(\d{3})\.html", p.name, re.IGNORECASE)
        if m:
            nums.append(int(m.group(1)))
    if not nums:
        raise RuntimeError("pages フォルダに mov_part_XXX.html が見つかりません。")
    return max(nums)


def safe_copytree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def backup_project(project_root: Path) -> Path:
    backup_dir = project_root.parent / f"{project_root.name}_backup_before_insert"
    if backup_dir.exists():
        shutil.rmtree(backup_dir)
    shutil.copytree(project_root, backup_dir)
    return backup_dir


def read_text(path: Path) -> Optional[str]:
    for enc in ("utf-8", "utf-8-sig", "cp932", "shift_jis"):
        try:
            return path.read_text(encoding=enc)
        except Exception:
            continue
    return None


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def update_total_pages(index_path: Path, delta: int) -> None:
    if not index_path.exists():
        print("index.html が見つからないため TOTAL_PAGES 更新をスキップします。")
        return

    text = read_text(index_path)
    if text is None:
        raise RuntimeError(f"index.html が読めません: {index_path}")

    replaced = False

    def repl(match):
        nonlocal replaced
        replaced = True
        current = int(match.group(1))
        new_val = current + delta
        print(f"TOTAL_PAGES: {current} -> {new_val}")
        return f"var TOTAL_PAGES = {new_val};"

    new_text = re.sub(r"var\s+TOTAL_PAGES\s*=\s*(\d+)\s*;", repl, text, count=1)

    if not replaced:
        raise RuntimeError("index.html 内に 'var TOTAL_PAGES = 数字;' が見つかりません。")

    write_text(index_path, new_text)


def replace_page_tokens_in_text(text: str, old_num: int, new_num: int) -> str:
    old3 = pad3(old_num)
    new3 = pad3(new_num)

    replacements = [
        (f"page_{old3}", f"page_{new3}"),
        (f"mov_part_{old3}.html", f"mov_part_{new3}.html"),
        (f"k01_p{old3}", f"k01_p{new3}"),
        (f"p{old3}", f"p{new3}"),
        (f"P{old3}", f"P{new3}"),
        (f"_{old3}_", f"_{new3}_"),
        (f"/{old3}_", f"/{new3}_"),
        (f"mov_P{old3}", f"mov_P{new3}"),
        (f"iframe{old_num}", f"iframe{new_num}"),
    ]

    for old, new in replacements:
        text = text.replace(old, new)

    text = re.sub(rf"(?<!\d){old3}(?!\d)", new3, text)
    return text


def rename_file_or_dir_name_tokens(path: Path, old_num: int, new_num: int) -> Path:
    old3 = pad3(old_num)
    new3 = pad3(new_num)

    new_name = path.name.replace(f"page_{old3}", f"page_{new3}")
    new_name = new_name.replace(f"mov_part_{old3}", f"mov_part_{new3}")
    new_name = new_name.replace(f"k01_p{old3}", f"k01_p{new3}")
    new_name = new_name.replace(f"p{old3}", f"p{new3}")
    new_name = new_name.replace(old3, new3)

    new_path = path.with_name(new_name)
    if new_path != path:
        path.rename(new_path)
    return new_path


def update_text_files_under(root: Path, old_num: int, new_num: int) -> None:
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() not in TEXT_FILE_EXTS:
            continue

        text = read_text(p)
        if text is None:
            continue

        new_text = replace_page_tokens_in_text(text, old_num, new_num)
        if new_text != text:
            write_text(p, new_text)


def rename_all_names_under(root: Path, old_num: int, new_num: int) -> None:
    all_paths = sorted(root.rglob("*"), key=lambda x: len(x.parts), reverse=True)
    for p in all_paths:
        if not p.exists():
            continue
        rename_file_or_dir_name_tokens(p, old_num, new_num)


def shift_page_html(pages_dir: Path, backup_pages_dir: Path, old_num: int, new_num: int) -> None:
    src = backup_pages_dir / page_html_name(old_num)
    dst = pages_dir / page_html_name(new_num)

    if not src.exists():
        return

    text = read_text(src)
    if text is None:
        raise RuntimeError(f"HTML が読めません: {src}")

    text = replace_page_tokens_in_text(text, old_num, new_num)
    write_text(dst, text)


def shift_material_folder(material_dir: Path, backup_material_dir: Path, old_num: int, new_num: int) -> None:
    src = backup_material_dir / material_dir_name(old_num)
    dst = material_dir / material_dir_name(new_num)

    if not src.exists():
        return

    safe_copytree(src, dst)
    update_text_files_under(dst, old_num, new_num)
    rename_all_names_under(dst, old_num, new_num)

    corrected = material_dir / material_dir_name(new_num)
    if dst.exists() and dst != corrected:
        if corrected.exists():
            shutil.rmtree(corrected)
        dst.rename(corrected)


def remove_original_targets_before_restore(pages_dir: Path, material_dir: Path, start_page: int) -> None:
    for n in range(start_page, start_page + INSERT_SPREAD_PAGES):
        html_path = pages_dir / page_html_name(n)
        if html_path.exists():
            html_path.unlink()

        mat_dir = material_dir / material_dir_name(n)
        if mat_dir.exists():
            shutil.rmtree(mat_dir)


def restore_inserted_spread_from_backup(
    pages_dir: Path,
    material_dir: Path,
    backup_pages_dir: Path,
    backup_material_dir: Path,
    start_page: int
) -> None:
    for n in range(start_page, start_page + INSERT_SPREAD_PAGES):
        src_html = backup_pages_dir / page_html_name(n)
        dst_html = pages_dir / page_html_name(n)
        if src_html.exists():
            shutil.copy2(src_html, dst_html)

        src_mat = backup_material_dir / material_dir_name(n)
        dst_mat = material_dir / material_dir_name(n)
        if src_mat.exists():
            safe_copytree(src_mat, dst_mat)


def main() -> None:
    selected_file = choose_html_file()
    project_root, pages_dir, material_dir = detect_project_root_from_selected_file(selected_file)

    selected_page = extract_page_number_from_html_path(selected_file)
    start_page = normalize_spread_start(selected_page)
    last_page = find_last_page_number(pages_dir)

    print("=== PagingTale 見開き挿入 ===")
    print(f"プロジェクト: {project_root}")
    print(f"pages       : {pages_dir}")
    print(f"material    : {material_dir}")
    print(f"選択ページ  : {pad3(selected_page)}")
    print(f"挿入見開き  : {pad3(start_page)}-{pad3(start_page + 1)}")
    print(f"最終ページ  : {pad3(last_page)}")
    print()

    if start_page < 0:
        raise RuntimeError("補正後の開始ページが不正です。")

    if start_page > last_page:
        raise RuntimeError("選択ページ番号が最終ページより後です。")

    backup_root = backup_project(project_root)
    backup_pages_dir = backup_root / "pages"
    backup_material_dir = backup_root / "material"

    print(f"バックアップ作成: {backup_root}")
    print("後ろから +2 ずつずらします...")

    for old_num in range(last_page, start_page - 1, -1):
        new_num = old_num + INSERT_SPREAD_PAGES
        print(f"  {pad3(old_num)} -> {pad3(new_num)}")
        shift_page_html(pages_dir, backup_pages_dir, old_num, new_num)
        shift_material_folder(material_dir, backup_material_dir, old_num, new_num)

    print("挿入見開きを元番号へ戻します...")
    remove_original_targets_before_restore(pages_dir, material_dir, start_page)
    restore_inserted_spread_from_backup(
        pages_dir,
        material_dir,
        backup_pages_dir,
        backup_material_dir,
        start_page
    )

    index_path = project_root / "index.html"
    update_total_pages(index_path, +INSERT_SPREAD_PAGES)

    print()
    print("完了しました。")
    print(f"挿入位置: {pad3(start_page)}-{pad3(start_page + 1)}")
    print(f"元の最終ページ {pad3(last_page)} は {pad3(last_page + 2)} になっています。")
    print(f"バックアップ: {backup_root}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)