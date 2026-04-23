"use client";

import { useMemo } from "react";

type PageFrameProps = {
  page: number | null;
  bookId: string;
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
  active = true,
  keepMounted = true,
}: PageFrameProps) {
  const src = useMemo(() => {
    if (page === null) return null;

    const pageText = formatPageNumber(page);

    // 🔥 ここが今回の本質修正
    return `https://media.pagingtale.com/${bookId}/pages/mov_part_${pageText}.html`;
  }, [page, bookId]);

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
    />
  );
}