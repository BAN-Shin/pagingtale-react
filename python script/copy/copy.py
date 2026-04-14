import re
import os
import tkinter as tk
from tkinter import filedialog
from bs4 import BeautifulSoup

def extract_page_number_from_filename(html_path):
    # Extract the page number from the filename using a regular expression
    filename = os.path.basename(html_path)
    match = re.search(r'mov_part_(\d+)', filename)
    if match:
        return match.group(1)
    return None

def extract_coordinates_and_size_from_html(html_path, rect_id):
    with open(html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')
        rect = soup.find('rect', {'id': rect_id})
        if rect:
            x = rect.get('x')
            y = rect.get('y')
            width = rect.get('width')
            height = rect.get('height')
            return x, y, width, height
        return None, None, None, None

def update_css_with_coordinates_and_size(html_path, rect_id, x, y, width, height):
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    def replace_css_properties(match):
        new_content = match.group(0)
        new_content = re.sub(r'left:\s*[\d.]+px;', f'left: {x}px;', new_content)
        new_content = re.sub(r'top:\s*[\d.]+px;', f'top: {y}px;', new_content)
        new_content = re.sub(r'width:\s*[\d.]+px;', f'width: {width}px;', new_content)
        new_content = re.sub(r'height:\s*[\d.]+px;', f'height: {height}px;', new_content)
        return new_content

    css_updated_content = re.sub(fr'#{rect_id}\s*\{{[^}}]*\}}', replace_css_properties, html_content, flags=re.DOTALL)

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(css_updated_content)

def process_button_click():
    html_path = html_path_entry.get().strip('"')  # Remove surrounding quotes if present
    if not html_path:
        status_label.config(text="ファイルパスを入力してください！")
        return

    page_number = extract_page_number_from_filename(html_path)
    if not page_number:
        status_label.config(text="ページ番号がファイル名から抽出できませんでした！")
        return

    rect_id_base = f"P{page_number}_K"
    css_id_base = f"mov_P{page_number}_K"

    index = 1
    updated_count = 0
    while True:
        rect_id = f"{rect_id_base}{index:02}"
        css_id = f"{css_id_base}{index:02}"

        x, y, width, height = extract_coordinates_and_size_from_html(html_path, rect_id)
        if x is not None and y is not None and width is not None and height is not None:
            update_css_with_coordinates_and_size(html_path, css_id, x, y, width, height)
            updated_count += 1
        else:
            break

        index += 1

    status_label.config(text=f"CSSの値を更新しました！{updated_count}個の要素が更新されました。")

# GUI setup
root = tk.Tk()
root.title("SVG CSS Generator")

# HTML file path entry
tk.Label(root, text="HTMLファイルのパス:").pack()
html_path_entry = tk.Entry(root, width=50)
html_path_entry.pack()

# Process button
process_button = tk.Button(root, text="CSSスタイルを更新", command=process_button_click)
process_button.pack(pady=10)

# Status label
status_label = tk.Label(root, text="")
status_label.pack()

root.mainloop()
