import { NextRequest, NextResponse } from "next/server";

const STUDENT_SESSION_COOKIE_NAME = "pagingtale_student_session";

function isBookDetailPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);

  return segments.length === 2 && segments[0] === "books";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 教材一覧は誰でも閲覧可
  if (pathname === "/books") {
    return NextResponse.next();
  }

  // 教材詳細 /books/[bookId] はゲスト閲覧可
  if (isBookDetailPath(pathname)) {
    return NextResponse.next();
  }

  // パスワード変更画面などはログイン必須
  if (pathname.startsWith("/books/")) {
    const token = request.cookies.get(STUDENT_SESSION_COOKIE_NAME)?.value;

    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/books";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/books/:path*"],
};