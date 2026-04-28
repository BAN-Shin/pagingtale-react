import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "PagingTale",
    template: "%s | PagingTale",
  },
  description:
    "PagingTale は、教材・動画・問題をまとめて扱えるデジタル教材プラットフォームです。",
  applicationName: "PagingTale",
  keywords: ["PagingTale", "教材", "デジタル教材", "美術", "学習", "問題配信"],
  authors: [{ name: "PagingTale" }],
  creator: "PagingTale",
  metadataBase: new URL("https://pagingtale.vercel.app"),

  // 👇 ★追加（favicon対策）
  icons: {
    icon: "/favicon.ico?v=2",
    shortcut: "/favicon.ico?v=2",
    apple: "/favicon.ico?v=2",
  },

  openGraph: {
    title: "PagingTale",
    description:
      "教材・動画・問題をまとめて扱えるデジタル教材プラットフォーム。",
    siteName: "PagingTale",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PagingTale",
    description:
      "教材・動画・問題をまとめて扱えるデジタル教材プラットフォーム。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-slate-900 flex flex-col">
        {children}
      </body>
    </html>
  );
}