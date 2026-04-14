import BookViewerWithQuiz from "@/components/book/BookViewerWithQuiz";

const FALLBACK_BOOK_ID = "pagingtale-book-001";

type ViewerPageProps = {
  searchParams?: Promise<{
    page?: string;
    bookId?: string;
    testId?: string;
  }>;
};

function parseInitialPage(value?: string): number {
  const page = Number(value ?? "1");

  if (!Number.isFinite(page)) {
    return 1;
  }

  return Math.max(1, Math.floor(page));
}

function normalizeBookId(value?: string): string {
  const bookId = (value ?? "").trim();
  return bookId || FALLBACK_BOOK_ID;
}

function normalizeTestId(value?: string): string | null {
  const testId = (value ?? "").trim();
  return testId || null;
}

export default async function ViewerPage(props: ViewerPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : {};

  const initialPage = parseInitialPage(searchParams.page);
  const bookId = normalizeBookId(searchParams.bookId);
  const testId = normalizeTestId(searchParams.testId);

  return (
    <BookViewerWithQuiz
      initialPage={initialPage}
      bookId={bookId}
      testId={testId}
    />
  );
}