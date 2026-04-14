import os

# 置換を行うディレクトリのパス
directory_path = 'C:\pleiades\xampp\htdocs\HowToDraw\pages'

# 置換対象のテキストと置換後のテキスト
search_text = "controlAllVideosInIframes"
replace_text = "controlSpecificVideosInIframes"

# 指定ディレクトリ内の全ファイルを探索
for root, dirs, files in os.walk(directory_path):
    for file in files:
        if file.endswith('.html'):
            file_path = os.path.join(root, file)
            # ファイルを読み込み、テキストを置換
            with open(file_path, 'r', encoding='utf-8') as file:
                file_contents = file.read()
            file_contents = file_contents.replace(search_text, replace_text)
            # 置換後のテキストでファイルを上書き保存
            with open(file_path, 'w', encoding='utf-8') as file:
                file.write(file_contents)
            print(f'Updated: {file_path}')
