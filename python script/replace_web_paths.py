from pathlib import Path

ROOT = Path(r"C:\pleiades\xampp\htdocs\pagingtale-react\public\book")
TARGET_EXTS = {".html", ".css", ".js"}

for path in ROOT.rglob("*"):
    if path.is_file() and path.suffix.lower() in TARGET_EXTS:
        text = path.read_text(encoding="utf-8")
        new_text = text.replace("\\", "/")
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            print(f"UPDATED: {path}")