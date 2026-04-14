import os
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4

def convert_txt_to_pdf(folder_path):
    # Windowsの日本語フォント（MS明朝）を登録
    font_path = "C:/Windows/Fonts/msmincho.ttc" 
    font_name = "MS-Mincho"
    pdfmetrics.registerFont(TTFont(font_name, font_path))

    # フォルダ内のファイル一覧を取得
    files = [f for f in os.listdir(folder_path) if f.endswith('.txt')]

    if not files:
        print("テキストファイルが見つかりませんでした。")
        return

    for file_name in files:
        txt_path = os.path.join(folder_path, file_name)
        pdf_path = os.path.join(folder_path, file_name.replace('.txt', '.pdf'))

        # PDFの作成
        c = canvas.Canvas(pdf_path, pagesize=A4)
        c.setFont(font_name, 11)
        width, height = A4

        # テキストの書き込み（簡易的な行送り処理）
        try:
            with open(txt_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except UnicodeDecodeError:
            # UTF-8で開けない場合はShift-JISを試す
            with open(txt_path, 'r', encoding='shift_jis') as f:
                lines = f.readlines()

        y = height - 50  # 開始位置（上から50pt）
        for line in lines:
            if y < 50:  # ページの下端に来たら改ページ
                c.showPage()
                c.setFont(font_name, 11)
                y = height - 50
            
            c.drawString(50, y, line.strip())
            y -= 15  # 行間

        c.save()
        print(f"変換完了: {file_name} -> {os.path.basename(pdf_path)}")

# 実行
target_folder = r"C:\Users\bants\Downloads\Export"
convert_txt_to_pdf(target_folder)
