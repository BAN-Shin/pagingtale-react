"use client";

type PageFrameProps = {
  page: number | null;
  bookId?: string;
  active?: boolean;
  keepMounted?: boolean;
  priority?: boolean;
  className?: string;
};

const FALLBACK_BOOK_ID = "pagingtale-book-001";

function normalizeBookId(bookId?: string): string {
  const value = (bookId ?? "").trim();
  return value || FALLBACK_BOOK_ID;
}

export default function PageFrame({
  page,
  bookId,
  active = true,
  keepMounted = true,
  priority = false,
  className = "",
}: PageFrameProps) {
  if (page === null) {
    return <div className={`h-full w-full bg-white ${className}`} />;
  }

  const safeBookId = normalizeBookId(bookId);
  const shouldMountIframe = active || keepMounted;
  const src = `/book-assets/${encodeURIComponent(
    safeBookId
  )}/pages/mov_part_${String(page).padStart(3, "0")}.html`;

  if (!shouldMountIframe) {
    return (
      <div className={`h-full w-full bg-white ${className}`}>
        <div className="h-full w-full bg-[linear-gradient(180deg,#ffffff,#f7f7f7)]" />
      </div>
    );
  }

  return (
    <iframe
      src={src}
      className={`h-full w-full border-0 bg-white ${className}`}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      loading={priority ? "eager" : "lazy"}
      title={`${safeBookId}-page-${page}`}
    />
  );
}