import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin-auth";

export async function POST() {
  try {
    await clearAdminSession();

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("admin logout route error:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? `教師ログアウト処理エラー: ${error.message}`
            : "教師ログアウト処理で不明なエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}