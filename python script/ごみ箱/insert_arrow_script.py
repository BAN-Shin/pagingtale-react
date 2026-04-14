import os
import re

TARGET_DIR = r"C:\pleiades\xampp\htdocs\HowToDraw\pages"

SCRIPT = r"""<script>
(function () {
    if (window.__pagingTaleArrowNavInserted) return;
    window.__pagingTaleArrowNavInserted = true;

    var arrowLock = false;
    var lastArrowAt = 0;

    function isEditableTargetForArrowKey(target) {
        if (!target) return false;

        var tagName = target.tagName ? target.tagName.toLowerCase() : "";

        if (target.isContentEditable) return true;
        if (tagName === "textarea") return true;
        if (tagName === "select") return true;
        if (tagName === "button") return true;

        if (tagName === "input") {
            var inputType = (target.type || "").toLowerCase();

            if (
                inputType === "text" ||
                inputType === "search" ||
                inputType === "url" ||
                inputType === "tel" ||
                inputType === "password" ||
                inputType === "email" ||
                inputType === "number" ||
                inputType === ""
            ) {
                return true;
            }
        }

        return false;
    }

    document.addEventListener("keydown", function (e) {
        var key = e.key || "";
        var keyCode = e.keyCode || 0;
        var target = e.target;
        var now = Date.now();

        if (e.repeat) return;
        if (arrowLock) return;
        if (now - lastArrowAt < 400) return;
        if (isEditableTargetForArrowKey(target)) return;

        if (target && target.tagName && target.tagName.toLowerCase() === "video") {
            return;
        }

        if (key === "ArrowLeft" || keyCode === 37) {
            e.preventDefault();
            e.stopPropagation();

            arrowLock = true;
            lastArrowAt = now;

            window.parent.postMessage({
                type: "turnByArrow",
                direction: "previous"
            }, "*");

            setTimeout(function () {
                arrowLock = false;
            }, 450);

            return;
        }

        if (key === "ArrowRight" || keyCode === 39) {
            e.preventDefault();
            e.stopPropagation();

            arrowLock = true;
            lastArrowAt = now;

            window.parent.postMessage({
                type: "turnByArrow",
                direction: "next"
            }, "*");

            setTimeout(function () {
                arrowLock = false;
            }, 450);

            return;
        }
    }, true);
})();
</script>"""

def read_text(path):
    for enc in ("utf-8", "utf-8-sig", "cp932"):
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read(), enc
        except UnicodeDecodeError:
            pass
    raise UnicodeDecodeError("unknown", b"", 0, 1, f"読み込み失敗: {path}")

def process_file(path):
    content, encoding = read_text(path)

    if "__pagingTaleArrowNavInserted" in content:
        print(f"[SKIP] 既に挿入済み: {path}")
        return

    match = re.search(r"</body\s*>", content, flags=re.IGNORECASE)
    if not match:
        print(f"[ERROR] </body> が見つからない: {path}")
        return

    idx = match.start()
    new_content = content[:idx].rstrip() + "\n\n" + SCRIPT + "\n\n" + content[idx:]

    with open(path, "w", encoding=encoding, newline="") as f:
        f.write(new_content)

    print(f"[OK] 挿入完了: {path}")

def main():
    if not os.path.isdir(TARGET_DIR):
        print(f"[ERROR] フォルダが見つかりません: {TARGET_DIR}")
        return

    for root, dirs, files in os.walk(TARGET_DIR):
        for file in files:
            if file.lower().endswith(".html"):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()