// app\book\page.tsx

import BookViewerWithQuiz from "@/components/book/BookViewerWithQuiz";

type BookPageProps = {
  searchParams?: Promise<{
    page?: string;
    bookId?: string;
    testId?: string;
  }>;
};

function parseNumber(value?: string, fallback = 1): number {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

export default async function BookPage(props: BookPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : {};

  const initialPage = parseNumber(searchParams.page, 1);
  const bookId = searchParams.bookId ?? "pagingtale-book-001";
  const testId = searchParams.testId ?? null;

  return (
    <BookViewerWithQuiz
      initialPage={initialPage}
      bookId={bookId}
      testId={testId}
    />
  );
}