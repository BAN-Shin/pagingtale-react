import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from tkinter import Tk, filedialog
from typing import Optional

DELETE_SPREAD_PAGES = 2
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
    選択したページを含む見開きの開始ページ
    004 -> 004
    005 -> 004
    006 -> 006
    007 -> 006
    """
    return page_num if page_num % 2 == 0 else page_num - 1


def update_total_pages(index_path: Path, delta: int) -> None:
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

    new_text = re.sub(
        r"var\s+TOTAL_PAGES\s*=\s*(\d+)\s*;",
        repl,
        text,
        count=1
    )

    if not replaced:
        raise RuntimeError("index.html 内に 'var TOTAL_PAGES = 数字;' が見つかりません。")

    write_text(index_path, new_text)


def choose_html_file() -> Path:
    root = Tk()
    root.withdraw()
    root.update()
    file_path = filedialog.askopenfilename(
        title="削除基準にする pages\\mov_part_XXX.html を選択",
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


def backup_project(project_root: Path, suffix: str) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = project_root.parent / f"{project_root.name}_{suffix}_{timestamp}"
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


def replace_page_tokens_in_text(text: str, old_num: int, new_num: int) -> str:
    old3 = pad3(old_num)
    new3 = pad3(new_num)

    replacements = [
        (f"page_{old3}", f"page_{new3}"),
        (f"mov_part_{old3}.html", f"mov_part_{new3}.html"),
        (f"k01_p{old3}", f"k01_p{new3}"),
        (f"p{old3}", f"p{new3}"),
        (f"P{old3}", f"P{new3}"),
        (f"mov_P{old3}", f"mov_P{new3}"),
        (f"iframe{old_num}", f"iframe{new_num}"),
        (f"_{old3}_", f"_{new3}_"),
        (f"/{old3}_", f"/{new3}_"),
    ]

    for old, new in replacements:
        text = text.replace(old, new)

    text = re.sub(rf"(?<!\d){old3}(?!\d)", new3, text)
    return text


def safe_delete_file(path: Path) -> None:
    if path.exists() and path.is_file():
        path.unlink()


def safe_delete_dir(path: Path) -> None:
    if path.exists() and path.is_dir():
        shutil.rmtree(path)


def copy_file_with_replacement(src: Path, dst: Path, old_num: int, new_num: int) -> None:
    text = read_text(src)
    if text is None:
        shutil.copy2(src, dst)
        return

    new_text = replace_page_tokens_in_text(text, old_num, new_num)
    write_text(dst, new_text)


def rename_file_or_dir_name_tokens(name: str, old_num: int, new_num: int) -> str:
    old3 = pad3(old_num)
    new3 = pad3(new_num)

    name = name.replace(f"page_{old3}", f"page_{new3}")
    name = name.replace(f"mov_part_{old3}", f"mov_part_{new3}")
    name = name.replace(f"k01_p{old3}", f"k01_p{new3}")
    name = name.replace(f"p{old3}", f"p{new3}")
    name = name.replace(old3, new3)
    return name


def copy_tree_with_replacement(src_dir: Path, dst_dir: Path, old_num: int, new_num: int) -> None:
    if dst_dir.exists():
        shutil.rmtree(dst_dir)
    dst_dir.mkdir(parents=True, exist_ok=True)

    for root, dirs, files in os.walk(src_dir):
        root_path = Path(root)
        rel = root_path.relative_to(src_dir)

        converted_parts = [
            rename_file_or_dir_name_tokens(part, old_num, new_num)
            for part in rel.parts
        ]
        target_root = dst_dir.joinpath(*converted_parts) if converted_parts else dst_dir
        target_root.mkdir(parents=True, exist_ok=True)

        for d in dirs:
            new_d = rename_file_or_dir_name_tokens(d, old_num, new_num)
            (target_root / new_d).mkdir(parents=True, exist_ok=True)

        for f in files:
            src_file = root_path / f
            new_f = rename_file_or_dir_name_tokens(f, old_num, new_num)
            dst_file = target_root / new_f

            if src_file.suffix.lower() in TEXT_FILE_EXTS:
                text = read_text(src_file)
                if text is None:
                    shutil.copy2(src_file, dst_file)
                else:
                    new_text = replace_page_tokens_in_text(text, old_num, new_num)
                    write_text(dst_file, new_text)
            else:
                shutil.copy2(src_file, dst_file)


def shift_pages_forward_compact(
    pages_dir: Path,
    material_dir: Path,
    start_page: int,
    last_page: int
) -> None:
    for old_num in range(start_page + DELETE_SPREAD_PAGES, last_page + 1):
        new_num = old_num - DELETE_SPREAD_PAGES

        src_html = pages_dir / page_html_name(old_num)
        dst_html = pages_dir / page_html_name(new_num)

        if src_html.exists():
            print(f"pages    {pad3(old_num)} -> {pad3(new_num)}")
            copy_file_with_replacement(src_html, dst_html, old_num, new_num)
            safe_delete_file(src_html)

    for old_num in range(start_page + DELETE_SPREAD_PAGES, last_page + 1):
        new_num = old_num - DELETE_SPREAD_PAGES

        src_dir = material_dir / material_dir_name(old_num)
        dst_dir = material_dir / material_dir_name(new_num)

        if src_dir.exists():
            print(f"material {pad3(old_num)} -> {pad3(new_num)}")
            safe_delete_dir(dst_dir)
            copy_tree_with_replacement(src_dir, dst_dir, old_num, new_num)
            safe_delete_dir(src_dir)


def cleanup_tail_targets(pages_dir: Path, material_dir: Path, last_page: int) -> None:
    for n in range(last_page - DELETE_SPREAD_PAGES + 1, last_page + 1):
        safe_delete_file(pages_dir / page_html_name(n))
        safe_delete_dir(material_dir / material_dir_name(n))


def main() -> None:
    selected_file = choose_html_file()
    project_root, pages_dir, material_dir = detect_project_root_from_selected_file(selected_file)

    selected_page = extract_page_number_from_html_path(selected_file)
    start_page = normalize_spread_start(selected_page)
    last_page = find_last_page_number(pages_dir)

    delete_end = start_page + DELETE_SPREAD_PAGES - 1

    print("=== PagingTale 見開き削除・前詰め ===")
    print(f"プロジェクト: {project_root}")
    print(f"pages       : {pages_dir}")
    print(f"material    : {material_dir}")
    print(f"選択ページ  : {pad3(selected_page)}")
    print(f"削除見開き  : {pad3(start_page)}-{pad3(delete_end)}")
    print(f"最終ページ  : {pad3(last_page)}")
    print()

    if start_page < 0:
        raise RuntimeError("補正後の開始ページが不正です。")

    if delete_end > last_page:
        raise RuntimeError("削除対象の見開きが最終ページを超えています。")

    backup_root = backup_project(project_root, "backup_before_delete_spread")
    print(f"バックアップ作成: {backup_root}")
    print()

    for n in range(start_page, start_page + DELETE_SPREAD_PAGES):
        html_path = pages_dir / page_html_name(n)
        mat_dir = material_dir / material_dir_name(n)

        if html_path.exists():
            print(f"削除 pages    {html_path.name}")
            safe_delete_file(html_path)

        if mat_dir.exists():
            print(f"削除 material {mat_dir.name}")
            safe_delete_dir(mat_dir)

    print()

    shift_pages_forward_compact(pages_dir, material_dir, start_page, last_page)

    print()

    cleanup_tail_targets(pages_dir, material_dir, last_page)

    index_path = project_root / "index.html"
    if index_path.exists():
        update_total_pages(index_path, -DELETE_SPREAD_PAGES)
    else:
        print("index.html が見つからないため TOTAL_PAGES 更新をスキップします。")

    print("完了しました。")
    print(f"{pad3(start_page)}-{pad3(delete_end)} を削除し、後続ページを前詰めしました。")
    print(f"バックアップ: {backup_root}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)