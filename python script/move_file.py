import os
import shutil

def move_files_by_extension(folder_path):
    # 確認対象の拡張子とフォルダ名の対応
    extensions_to_folders = {
        ".mp3": "mp3",
        ".mp4": "mp4",
    }

    # フォルダ内のファイルを取得
    files = os.listdir(folder_path)

    for file_name in files:
        # ファイルパスを取得
        file_path = os.path.join(folder_path, file_name)

        # ファイルのみ対象
        if os.path.isfile(file_path):
            # ファイルの拡張子を取得
            _, extension = os.path.splitext(file_name)

            # 指定した拡張子の場合
            if extension in extensions_to_folders:
                # 移動先フォルダを設定
                target_folder = os.path.join(folder_path, extensions_to_folders[extension])

                # フォルダが存在しない場合は作成
                if not os.path.exists(target_folder):
                    os.makedirs(target_folder)

                # 移動先パスを決定
                target_path = os.path.join(target_folder, file_name)

                # ファイルを移動
                shutil.move(file_path, target_path)
                print(f"Moved: {file_name} -> {target_folder}")
            else:
                print(f"Skipped: {file_name} (not a target extension)")

def main():
    # フォルダパスの入力待機
    folder_path = input("フォルダのパスを入力してください: ").strip()

    # 入力されたパスが有効か確認
    if not os.path.isdir(folder_path):
        print("有効なフォルダパスを入力してください。")
        return

    # ファイルを拡張子別に移動
    move_files_by_extension(folder_path)

if __name__ == "__main__":
    main()
