import { NextResponse } from "next/server";
import { clearStudentSession } from "@/lib/student-auth";

export async function POST() {
  try {
    await clearStudentSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("student logout route error:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? `ログアウト処理エラー: ${error.message}`
            : "ログアウト処理で不明なエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}