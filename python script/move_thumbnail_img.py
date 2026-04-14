import os
import shutil

# ソースとターゲットのベースパス
source_base = "C:\\pleiades\\xampp\\htdocs\\beepbool\\edit\\material"
target_base = "D:\\twitter\\3DCG\\comic\\Re - The mischief of being in today-s someday\\edit page"

# ソースディレクトリ内の全てのエントリをリストアップ
entries = os.listdir(source_base)

# 'page_XXX' 形式のフォルダ名を持つエントリのみをフィルタリングし、ページ番号を抽出
page_numbers = [int(entry.split('_')[1]) for entry in entries if entry.startswith('page_') and os.path.isdir(os.path.join(source_base, entry))]

# 最大のページ番号を取得
if page_numbers:
    end_page = max(page_numbers)
else:
    raise Exception("指定されたソースディレクトリ内に 'page_XXX' 形式のフォルダが見つかりません。")

# ページ範囲の開始
start_page = 4

# ページ範囲をループしてファイルコピー
for page in range(start_page, end_page + 1):
    source_dir = os.path.join(source_base, f"page_{page:03}")
    target_dir = os.path.join(target_base, f"p{page:03d}")
    
    # ソースディレクトリが存在する場合のみ処理を実行
    if os.path.exists(source_dir):
        # ソースディレクトリ内の全てのファイルを確認
        for file_name in os.listdir(source_dir):
            if file_name.endswith(".png"):
                # k番号を取得
                k_num = file_name.split('_')[0]  # 'k01_p004_img.png' -> 'k01'
                
                # 対応するターゲットサブフォルダを決定
                target_sub_dir = os.path.join(target_dir, k_num)
                
                # ターゲットサブフォルダが存在しなければ作成
                if not os.path.exists(target_sub_dir):
                    os.makedirs(target_sub_dir)
                
                # ファイルをコピー
                shutil.copy2(os.path.join(source_dir, file_name), os.path.join(target_sub_dir, file_name))
    
    else:
        print(f"ソースディレクトリ {source_dir} が存在しません。")

print("ファイルのコピーが完了しました。")
