import os
from pydub import AudioSegment

def convert_wav_to_mp3(base_folder):
    # サブフォルダや孫フォルダを含む全ファイルを走査
    for root, _, files in os.walk(base_folder):
        for file in files:
            if file.endswith(".wav"):  # .wav ファイルを対象
                wav_path = os.path.join(root, file)
                mp3_path = os.path.splitext(wav_path)[0] + ".mp3"

                try:
                    # WAVファイルを読み込んでMP3形式に変換
                    audio = AudioSegment.from_wav(wav_path)
                    audio.export(mp3_path, format="mp3")
                    print(f"変換完了: {wav_path} → {mp3_path}")
                except Exception as e:
                    print(f"エラー: {wav_path} の変換中に問題が発生しました: {e}")

# 基本フォルダを指定
base_folder = r"D:\twitter\BeepBool\Re -Imagine the meaning of now, someday\dialogue satousan\selected"
convert_wav_to_mp3(base_folder)
