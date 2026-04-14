import os
import shutil
import tkinter as tk
from tkinter import filedialog

def copy_illustrator_files(source_file, copy_count):
    base_name = os.path.basename(source_file)
    base_dir = os.path.dirname(source_file)  # 元のファイルと同じディレクトリに設定
    base_number = base_name.split('_')[0]  # 元ファイル名の番号部分
    base_prefix = 'k'  # ファイル名のimg部分で使用
    base_suffix_img = 'img'
    base_suffix_btn = 'btn'

    for i in range(1, copy_count + 1):
        # 004_インデックス_btn形式のファイルを作成
        btn_file_name = f"{base_number}_{str(i).zfill(2)}_{base_suffix_btn}.ai"
        btn_file_path = os.path.join(base_dir, btn_file_name)
        shutil.copy2(source_file, btn_file_path)

        # kインデックス_p004_img形式のファイルを作成
        img_file_name = f"{base_prefix}{str(i).zfill(2)}_p{base_number}_{base_suffix_img}.ai"
        img_file_path = os.path.join(base_dir, img_file_name)
        shutil.copy2(source_file, img_file_path)

    print(f"{copy_count * 2} 個のファイルを複製しました。")

def select_file_and_copy():
    # ファイル選択ダイアログを表示
    root = tk.Tk()
    root.withdraw()  # メインウィンドウを隠す
    source_file = filedialog.askopenfilename(
        title="Illustratorファイルを選択してください",
        filetypes=[("Illustrator Files", "*.ai")]
    )

    if source_file:
        copy_count = int(input("コピーする数を入力してください: "))
        copy_illustrator_files(source_file, copy_count)
    else:
        print("ファイルが選択されませんでした。")

# 実行
select_file_and_copy()
