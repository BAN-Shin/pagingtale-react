"use client";

import { useMemo } from "react";

type PageFrameProps = {
  page: number | null;
  bookId: string;
  bookVersion?: string;
  active?: boolean;
  keepMounted?: boolean;
  priority?: boolean;
};

function formatPageNumber(page: number): string {
  return String(page).padStart(3, "0");
}

export default function PageFrame({
  page,
  bookId,
  bookVersion = "1",
  active = true,
  keepMounted = true,
}: PageFrameProps) {
  const src = useMemo(() => {
    if (page === null) return null;

    const pageText = formatPageNumber(page);
    const versionText = encodeURIComponent(bookVersion || "1");

    return `https://media.pagingtale.com/${bookId}/pages/mov_part_${pageText}.html?v=${versionText}`;
  }, [page, bookId, bookVersion]);

  if (page === null) {
    return <div className="h-full w-full bg-white" />;
  }

  if (!keepMounted && !active) {
    return null;
  }

  return (
    <iframe
      src={src ?? ""}
      className="h-full w-full border-none"
      loading="lazy"
      allow="autoplay; fullscreen"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      title={`${bookId}-page-${page}`}
    />
  );
}