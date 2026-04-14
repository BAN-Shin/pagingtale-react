import os
import re
import tkinter as tk
from tkinter import filedialog
from bs4 import BeautifulSoup

def extract_page_number_from_filename(html_path):
    filename = os.path.basename(html_path)
    match = re.search(r'mov_part_(\d+)', filename)
    if match:
        return match.group(1)
    return None

def get_existing_ids(style_tag, page_number):
    ids = set()
    for rule in style_tag.string.split('}'):
        match = re.search(r'#mov_P' + page_number + r'_K(\d+)', rule)
        if match:
            ids.add(int(match.group(1)))
    return ids

def format_body_content(body_content):
    formatted_lines = []
    for line in body_content.split('\n'):
        formatted_lines.append(re.sub(r'^( *)', r'\1\1\1\1', line))  # Multiply leading spaces by 4
    return '\n'.join(formatted_lines)

def copy_css_and_html_sections(html_path, count):
    page_number = extract_page_number_from_filename(html_path)
    if not page_number:
        return None, "ページ番号がファイル名から抽出できませんでした！"

    with open(html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    style_tag = soup.find('style')
    if not style_tag:
        return None, "<style> タグが見つかりませんでした！"

    css_content = style_tag.string
    base_css = re.search(r'(#mov_P' + page_number + r'_K01\s*\{[^}]*\})', css_content, re.DOTALL)
    if not base_css:
        return None, "#mov_P{}_K01 の CSS セクションが見つかりませんでした！".format(page_number)

    base_css_text = base_css.group(0)
    existing_ids = get_existing_ids(style_tag, page_number)
    new_css_sections = []
    new_div_sections = []
    new_svg_sections = []

    for i in range(2, count + 1):  # count までに変更
        new_id = i
        new_css = re.sub(r'#mov_P' + page_number + r'_K01', '#mov_P' + page_number + '_K{:02}'.format(new_id), base_css_text)
        new_css_sections.append(" " * 8 + new_css)
        existing_ids.add(new_id)

        new_div = '''
    <div id="mov_P{0}_mask_{1:02}">
        <video id="mov_P{0}_K{1:02}"  class="video-element">
            <source src="../material/page_{0}/mov/k{1:02}_p{0}.mp4" type="video/mp4">
        </video>
    </div>'''.format(page_number, new_id)
        new_div_sections.append(new_div.replace('\n', '\n' + ' ' * 4))

        new_svg = '''
        <!-- External SVG as object -->
        <object type="image/svg+xml" data="../material/page_{0}/{0}_{1:02}_btn.svg" id="svgObject" width="558" height="820"></object>
        <rect class="clickablePath" id="P{0}_K{1:02}"/>'''.format(page_number, new_id)
        new_svg_sections.append(new_svg.replace('\n', '\n' + ' ' * 8))

    new_css_text = "\n\n".join(new_css_sections)
    new_div_text = "\n\n".join(new_div_sections)
    new_svg_text = "\n\n".join(new_svg_sections)

    # Insert new CSS sections right after the original CSS section
    original_css_end = css_content.index(base_css_text) + len(base_css_text)
    style_tag.string = css_content[:original_css_end] + "\n\n" + new_css_text + css_content[original_css_end:]

    # Insert new DIV sections right after the original DIV section
    original_div = soup.find('div', id=re.compile(r'mov_P{}_mask_01'.format(page_number)))
    if original_div:
        new_div_elements = BeautifulSoup(new_div_text, 'html.parser')
        for new_div in new_div_elements.find_all('div'):
            original_div.insert_after(new_div)
            original_div = new_div  # update original_div to the newly inserted div

    # Insert new SVG sections right after the original SVG section
    original_svg_object = soup.find('rect', id=re.compile(r'P{}_K01'.format(page_number)))
    if original_svg_object:
        new_svg_elements = BeautifulSoup(new_svg_text, 'html.parser')
        for new_svg in new_svg_elements.find_all(['object', 'rect']):
            original_svg_object.insert_after(new_svg)
            original_svg_object = new_svg  # update original_svg_object to the newly inserted svg element

    # Write updated HTML back to file before formatting
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(soup.prettify(formatter=None))

    # Read back the file and adjust the body indentation
    adjust_body_indentation(html_path)

    return new_css_text + "\n\n" + new_div_text + "\n\n" + new_svg_text, None

def format_body_indentation(html_content):
    body_match = re.search(r'(<body[^>]*>)(.*?)(</body>)', html_content, re.DOTALL)
    if not body_match:
        return html_content

    body_start = body_match.group(1)
    body_content = body_match.group(2)
    body_end = body_match.group(3)

    formatted_body_content = re.sub(r'^( +)', lambda match: ' ' * (len(match.group(1)) * 4), body_content, flags=re.MULTILINE)
    return html_content.replace(body_content, formatted_body_content)

def adjust_body_indentation(html_path):
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    formatted_html_content = format_body_indentation(html_content)

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(formatted_html_content)

def process_copy_button_click():
    html_path = html_path_entry.get().strip('"')
    copy_count = int(copy_count_entry.get().strip())

    if not html_path:
        status_label.config(text="ファイルパスを入力してください！")
        return

    new_content, error_message = copy_css_and_html_sections(html_path, copy_count)
    if error_message:
        status_label.config(text=error_message)
    else:
        status_label.config(text="CSSセクション、DIVセクション、SVGセクションがコピーされました！\n\n" + new_content)

# GUI setup
root = tk.Tk()
root.title("SVG CSS Copier")

# HTML file path entry
tk.Label(root, text="HTMLファイルのパス:").pack()
html_path_entry = tk.Entry(root, width=50)
html_path_entry.pack()

# Copy count entry
tk.Label(root, text="コピーするセクションの数:").pack()
copy_count_entry = tk.Entry(root, width=10)
copy_count_entry.pack()

# Process button
process_button = tk.Button(root, text="セクションをコピー", command=process_copy_button_click)
process_button.pack(pady=10)

# Status label
status_label = tk.Label(root, text="")
status_label.pack()

root.mainloop()
