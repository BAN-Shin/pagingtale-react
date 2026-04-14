import re
import shutil
import sys
from datetime import datetime
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
    選択したページを含む見開きの開始ページを返す
    004 -> 004
    005 -> 004
    006 -> 006
    007 -> 006
    """
    return page_num if page_num % 2 == 0 else page_num - 1


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


def backup_project(project_root: Path, suffix: str) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = project_root.parent / f"{project_root.name}_{suffix}_{timestamp}"
    shutil.copytree(project_root, backup_dir)
    return backup_dir


def safe_delete_file(path: Path) -> None:
    if path.exists() and path.is_file():
        path.unlink()


def safe_delete_dir(path: Path) -> None:
    if path.exists() and path.is_dir():
        shutil.rmtree(path)


def safe_copytree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


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
        (f"mov_P{old3}", f"mov_P{new3}"),
        (f"iframe{old_num}", f"iframe{new_num}"),
        (f"_{old3}_", f"_{new3}_"),
        (f"/{old3}_", f"/{new3}_"),
    ]

    for old, new in replacements:
        text = text.replace(old, new)

    text = re.sub(rf"(?<!\d){old3}(?!\d)", new3, text)
    return text


def rename_file_or_dir_name_tokens(name: str, old_num: int, new_num: int) -> str:
    old3 = pad3(old_num)
    new3 = pad3(new_num)

    name = name.replace(f"page_{old3}", f"page_{new3}")
    name = name.replace(f"mov_part_{old3}", f"mov_part_{new3}")
    name = name.replace(f"k01_p{old3}", f"k01_p{new3}")
    name = name.replace(f"p{old3}", f"p{new3}")
    name = name.replace(old3, new3)
    return name


def shift_html_from_backup(
    backup_pages_dir: Path,
    pages_dir: Path,
    old_num: int,
    new_num: int
) -> None:
    src_html = backup_pages_dir / page_html_name(old_num)
    if not src_html.exists():
        return

    dst_html = pages_dir / page_html_name(new_num)
    text = read_text(src_html)
    if text is None:
        raise RuntimeError(f"HTML が読めません: {src_html}")

    new_text = replace_page_tokens_in_text(text, old_num, new_num)
    write_text(dst_html, new_text)


def shift_material_from_backup(
    backup_material_dir: Path,
    material_dir: Path,
    old_num: int,
    new_num: int
) -> None:
    src_dir = backup_material_dir / material_dir_name(old_num)
    if not src_dir.exists():
        return

    dst_dir = material_dir / material_dir_name(new_num)
    safe_copytree(src_dir, dst_dir)

    all_paths = sorted(dst_dir.rglob("*"), key=lambda x: len(x.parts), reverse=True)
    for p in all_paths:
        if not p.exists():
            continue
        new_name = rename_file_or_dir_name_tokens(p.name, old_num, new_num)
        new_path = p.with_name(new_name)
        if new_path != p:
            p.rename(new_path)

    for p in dst_dir.rglob("*"):
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

    corrected = material_dir / material_dir_name(new_num)
    if dst_dir.exists() and dst_dir != corrected:
        if corrected.exists():
            shutil.rmtree(corrected)
        dst_dir.rename(corrected)


def restore_spread_from_backup(
    backup_pages_dir: Path,
    backup_material_dir: Path,
    pages_dir: Path,
    material_dir: Path,
    source_start_page: int,
    insert_start_page: int
) -> None:
    for offset in range(INSERT_SPREAD_PAGES):
        src_num = source_start_page + offset
        dst_num = insert_start_page + offset

        print(f"  restore {pad3(src_num)} -> {pad3(dst_num)}")
        shift_html_from_backup(backup_pages_dir, pages_dir, src_num, dst_num)
        shift_material_from_backup(backup_material_dir, material_dir, src_num, dst_num)


def main() -> None:
    selected_file = choose_html_file()
    project_root, pages_dir, material_dir = detect_project_root_from_selected_file(selected_file)

    selected_page = extract_page_number_from_html_path(selected_file)
    spread_start = normalize_spread_start(selected_page)

    source_start_page = spread_start
    insert_start_page = spread_start

    last_page = find_last_page_number(pages_dir)

    print("=== PagingTale 見開き挿入 ===")
    print(f"プロジェクト: {project_root}")
    print(f"pages       : {pages_dir}")
    print(f"material    : {material_dir}")
    print(f"選択ページ  : {pad3(selected_page)}")
    print(f"複製元見開き: {pad3(source_start_page)}-{pad3(source_start_page + 1)}")
    print(f"挿入位置    : {pad3(insert_start_page)}-{pad3(insert_start_page + 1)}")
    print(f"最終ページ  : {pad3(last_page)}")
    print()

    if source_start_page < 0:
        raise RuntimeError("開始ページが不正です。")

    if source_start_page > last_page:
        raise RuntimeError("選択ページ番号が最終ページより後です。")

    if source_start_page + 1 > last_page:
        raise RuntimeError("複製対象の見開きの後半ページが存在しません。")

    backup_root = backup_project(project_root, "backup_before_insert")
    backup_pages_dir = backup_root / "pages"
    backup_material_dir = backup_root / "material"

    print(f"バックアップ作成: {backup_root}")
    print("後ろから +2 ずつずらします...")

    for old_num in range(last_page, insert_start_page - 1, -1):
        new_num = old_num + INSERT_SPREAD_PAGES
        print(f"  shift   {pad3(old_num)} -> {pad3(new_num)}")
        shift_html_from_backup(backup_pages_dir, pages_dir, old_num, new_num)
        shift_material_from_backup(backup_material_dir, material_dir, old_num, new_num)

    print("挿入位置をクリアします...")
    for n in range(insert_start_page, insert_start_page + INSERT_SPREAD_PAGES):
        safe_delete_file(pages_dir / page_html_name(n))
        safe_delete_dir(material_dir / material_dir_name(n))

    print("選択見開きを挿入します...")
    restore_spread_from_backup(
        backup_pages_dir,
        backup_material_dir,
        pages_dir,
        material_dir,
        source_start_page,
        insert_start_page
    )

    index_path = project_root / "index.html"
    update_total_pages(index_path, +INSERT_SPREAD_PAGES)

    print()
    print("完了しました。")
    print(f"複製元: {pad3(source_start_page)}-{pad3(source_start_page + 1)}")
    print(f"挿入先: {pad3(insert_start_page)}-{pad3(insert_start_page + 1)}")
    print(f"元の最終ページ {pad3(last_page)} は {pad3(last_page + 2)} になっています。")
    print(f"バックアップ: {backup_root}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)