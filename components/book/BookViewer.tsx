"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PageFrame from "@/components/book/PageFrame";
import { TOC_ITEMS as DEFAULT_TOC_ITEMS } from "@/lib/pagingtale/toc";

const FALLBACK_BOOK_ID = "pagingtale-book-001";
const FLIP_DURATION_MS = 700;

type TocItem = {
  page: number;
  title: string;
};

type BindingDirection = "rtl" | "ltr";
type TurnSide = "left" | "right";

type BookViewerProps = {
  bookId?: string;
  tocItems?: TocItem[];
  totalPages?: number;
  onCurrentPageChange?: (page: number) => void;
  binding?: BindingDirection;
  initialPage?: number;
};

type SpreadPages = {
  left: number | null;
  right: number | null;
};

type FlipState = {
  fromSpreadIndex: number;
  toSpreadIndex: number;
  turnSide: TurnSide;
};

type PageRenderConfig = {
  activePages: Set<number>;
  keepMountedPages: Set<number>;
};

type TocJsonItem = {
  page?: unknown;
  title?: unknown;
};

function normalizeBookId(bookId?: string): string {
  const value = (bookId ?? "").trim();
  return value || FALLBACK_BOOK_ID;
}

function normalizeTocItems(value: unknown): TocItem[] | null {
  if (!Array.isArray(value)) return null;

  const normalized = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const page = Number((item as TocJsonItem).page);
      const title = String((item as TocJsonItem).title ?? "");

      if (!Number.isFinite(page)) return null;
      if (!title.trim()) return null;

      return {
        page: Math.max(1, Math.floor(page)),
        title: title.trim(),
      } satisfies TocItem;
    })
    .filter((item): item is TocItem => item !== null);

  return normalized.length > 0 ? normalized : null;
}

function getMaxSpreadIndex(totalPages: number): number {
  if (totalPages <= 1) return 0;
  return Math.ceil(totalPages / 2);
}

function pageToSpreadIndex(page: number): number {
  if (page <= 1) return 0;
  return Math.floor(page / 2);
}

function getSpreadPages(
  spreadIndex: number,
  totalPages: number,
  binding: BindingDirection
): SpreadPages {
  if (spreadIndex <= 0) {
    return binding === "rtl"
      ? { left: null, right: 1 }
      : { left: 1, right: null };
  }

  const firstPage = spreadIndex * 2;
  const secondPage = firstPage + 1;

  if (firstPage > totalPages) {
    return { left: null, right: null };
  }

  if (secondPage > totalPages) {
    return binding === "rtl"
      ? { left: firstPage, right: null }
      : { left: null, right: firstPage };
  }

  return binding === "rtl"
    ? { left: firstPage, right: secondPage }
    : { left: secondPage, right: firstPage };
}

function getPrimaryPage(
  pages: SpreadPages,
  binding: BindingDirection
): number {
  return binding === "rtl"
    ? pages.left ?? pages.right ?? 1
    : pages.right ?? pages.left ?? 1;
}

function addPageToSet(set: Set<number>, page: number | null) {
  if (page !== null) {
    set.add(page);
  }
}

function buildPageRenderConfig(params: {
  currentSpreadIndex: number;
  flipState: FlipState | null;
  totalPages: number;
  binding: BindingDirection;
}): PageRenderConfig {
  const activePages = new Set<number>();
  const keepMountedPages = new Set<number>();

  const currentPages = getSpreadPages(
    params.currentSpreadIndex,
    params.totalPages,
    params.binding
  );
  addPageToSet(keepMountedPages, currentPages.left);
  addPageToSet(keepMountedPages, currentPages.right);

  const prevPages = getSpreadPages(
    params.currentSpreadIndex - 1,
    params.totalPages,
    params.binding
  );
  const nextPages = getSpreadPages(
    params.currentSpreadIndex + 1,
    params.totalPages,
    params.binding
  );

  addPageToSet(keepMountedPages, prevPages.left);
  addPageToSet(keepMountedPages, prevPages.right);
  addPageToSet(keepMountedPages, nextPages.left);
  addPageToSet(keepMountedPages, nextPages.right);

  if (!params.flipState) {
    addPageToSet(activePages, currentPages.left);
    addPageToSet(activePages, currentPages.right);
    return { activePages, keepMountedPages };
  }

  const toPages = getSpreadPages(
    params.flipState.toSpreadIndex,
    params.totalPages,
    params.binding
  );

  addPageToSet(activePages, currentPages.left);
  addPageToSet(activePages, currentPages.right);
  addPageToSet(activePages, toPages.left);
  addPageToSet(activePages, toPages.right);

  addPageToSet(keepMountedPages, toPages.left);
  addPageToSet(keepMountedPages, toPages.right);

  return { activePages, keepMountedPages };
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;

  const tagName = el.tagName?.toLowerCase() ?? "";

  if (el.isContentEditable) return true;
  if (tagName === "textarea") return true;
  if (tagName === "select") return true;
  if (tagName === "button") return true;
  if (tagName === "input") return true;

  return false;
}

function getInitialSpreadIndexFromPage(
  page: number | undefined,
  totalPages: number
): number {
  const safePage = Number.isFinite(page)
    ? Math.max(1, Math.min(totalPages, Math.floor(page ?? 1)))
    : 1;

  return pageToSpreadIndex(safePage);
}

function SinglePage({
  page,
  bookId,
  side,
  isActive,
  keepMounted,
  priority = false,
}: {
  page: number | null;
  bookId: string;
  side: "left" | "right";
  isActive: boolean;
  keepMounted: boolean;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative h-full overflow-hidden bg-white ${
        side === "left" ? "origin-right" : "origin-left"
      }`}
    >
      <PageFrame
        page={page}
        bookId={bookId}
        active={isActive}
        keepMounted={keepMounted}
        priority={priority}
      />
    </div>
  );
}

function SpreadView({
  spreadIndex,
  activePages,
  keepMountedPages,
  priorityPages,
  binding,
  totalPages,
  bookId,
}: {
  spreadIndex: number;
  activePages: Set<number>;
  keepMountedPages: Set<number>;
  priorityPages?: Set<number>;
  binding: BindingDirection;
  totalPages: number;
  bookId: string;
}) {
  const pages = getSpreadPages(spreadIndex, totalPages, binding);

  return (
    <div className="grid h-full grid-cols-2 gap-px bg-black/10">
      <SinglePage
        page={pages.left}
        bookId={bookId}
        side="left"
        isActive={pages.left !== null && activePages.has(pages.left)}
        keepMounted={pages.left !== null && keepMountedPages.has(pages.left)}
        priority={!!(pages.left !== null && priorityPages?.has(pages.left))}
      />
      <SinglePage
        page={pages.right}
        bookId={bookId}
        side="right"
        isActive={pages.right !== null && activePages.has(pages.right)}
        keepMounted={pages.right !== null && keepMountedPages.has(pages.right)}
        priority={!!(pages.right !== null && priorityPages?.has(pages.right))}
      />
    </div>
  );
}

function MenuIcon() {
  return (
    <span className="flex h-8 w-8 flex-col items-center justify-center gap-1.5">
      <span className="block h-[2.5px] w-5 rounded-full bg-white" />
      <span className="block h-[2.5px] w-5 rounded-full bg-white" />
      <span className="block h-[2.5px] w-5 rounded-full bg-white" />
    </span>
  );
}

function FullscreenIcon({ isFullscreen }: { isFullscreen: boolean }) {
  if (isFullscreen) {
    return (
      <span className="relative block h-8 w-8">
        <span className="absolute left-1.5 top-1.5 h-2.5 w-2.5 border-l-[2.5px] border-t-[2.5px] border-white" />
        <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 border-r-[2.5px] border-t-[2.5px] border-white" />
        <span className="absolute bottom-1.5 left-1.5 h-2.5 w-2.5 border-b-[2.5px] border-l-[2.5px] border-white" />
        <span className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b-[2.5px] border-r-[2.5px] border-white" />
      </span>
    );
  }

  return (
    <span className="relative block h-8 w-8">
      <span className="absolute left-1 top-1 h-3 w-3 border-l-[2.5px] border-t-[2.5px] border-white" />
      <span className="absolute right-1 top-1 h-3 w-3 border-r-[2.5px] border-t-[2.5px] border-white" />
      <span className="absolute bottom-1 left-1 h-3 w-3 border-b-[2.5px] border-l-[2.5px] border-white" />
      <span className="absolute bottom-1 right-1 h-3 w-3 border-b-[2.5px] border-r-[2.5px] border-white" />
    </span>
  );
}

function ControlIconButton({
  onClick,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4a3f39] text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)] transition hover:bg-[#5a4d46] disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

export default function BookViewer({
  bookId,
  tocItems: tocItemsProp,
  totalPages: totalPagesProp,
  onCurrentPageChange,
  binding = "rtl",
  initialPage = 1,
}: BookViewerProps) {
  const safeBookId = useMemo(() => normalizeBookId(bookId), [bookId]);

  const [tocItems, setTocItems] = useState<TocItem[]>(() => {
    return DEFAULT_TOC_ITEMS.map(({ page, title }) => ({ page, title }));
  });

  const resolvedTocItems =
    tocItemsProp && tocItemsProp.length > 0 ? tocItemsProp : tocItems;

const derivedTotalPages = useMemo(() => {
  const propPages =
    typeof totalPagesProp === "number" &&
    Number.isFinite(totalPagesProp) &&
    totalPagesProp > 0
      ? Math.floor(totalPagesProp)
      : 0;

  const tocPages =
    resolvedTocItems.length > 0
      ? Math.max(...resolvedTocItems.map((item) => item.page))
      : 0;

  return Math.max(propPages, tocPages, 10);
}, [resolvedTocItems, totalPagesProp]);

  const maxSpreadIndex = useMemo(
    () => getMaxSpreadIndex(derivedTotalPages),
    [derivedTotalPages]
  );

  const [currentSpreadIndex, setCurrentSpreadIndex] = useState<number>(() =>
    getInitialSpreadIndexFromPage(initialPage, derivedTotalPages)
  );
  const [flipState, setFlipState] = useState<FlipState | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const viewerRootRef = useRef<HTMLDivElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const flipTimerRef = useRef<number | null>(null);

  const isFlipping = flipState !== null;
  const canGoPrev = currentSpreadIndex > 0 && !isFlipping;
  const canGoNext = currentSpreadIndex < maxSpreadIndex && !isFlipping;

  const clearFlipTimer = useCallback(() => {
    if (flipTimerRef.current !== null) {
      window.clearTimeout(flipTimerRef.current);
      flipTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearFlipTimer();
    };
  }, [clearFlipTimer]);

  useEffect(() => {
    setCurrentSpreadIndex(
      getInitialSpreadIndexFromPage(initialPage, derivedTotalPages)
    );
    setFlipState(null);
    clearFlipTimer();
  }, [clearFlipTimer, derivedTotalPages, initialPage, safeBookId]);

  useEffect(() => {
    if (tocItemsProp && tocItemsProp.length > 0) {
      setTocItems(tocItemsProp);
      return;
    }

    let cancelled = false;

    async function loadToc() {
      try {
        const response = await fetch(
          `/book-assets/${encodeURIComponent(safeBookId)}/data/toc.json`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`toc.json load failed: ${response.status}`);
        }

        const json = (await response.json()) as unknown;
        const loaded = normalizeTocItems(json);

        if (cancelled) return;

        if (loaded) {
          setTocItems(loaded);
        } else {
          setTocItems(
            DEFAULT_TOC_ITEMS.map(({ page, title }) => ({ page, title }))
          );
        }
      } catch {
        if (cancelled) return;
        setTocItems(
          DEFAULT_TOC_ITEMS.map(({ page, title }) => ({ page, title }))
        );
      }
    }

    void loadToc();

    return () => {
      cancelled = true;
    };
  }, [safeBookId, tocItemsProp]);

  const getTurnSide = useCallback(
    (fromSpreadIndex: number, toSpreadIndex: number): TurnSide => {
      const movingForward = toSpreadIndex > fromSpreadIndex;

      if (binding === "rtl") {
        return movingForward ? "right" : "left";
      }

      return movingForward ? "left" : "right";
    },
    [binding]
  );

  const jumpToSpread = useCallback(
    (nextSpreadIndex: number) => {
      const safeSpreadIndex = Math.max(
        0,
        Math.min(maxSpreadIndex, nextSpreadIndex)
      );

      clearFlipTimer();
      setFlipState(null);
      setCurrentSpreadIndex(safeSpreadIndex);
    },
    [clearFlipTimer, maxSpreadIndex]
  );

  const animateFlipToSpread = useCallback(
    (nextSpreadIndex: number) => {
      if (isFlipping) return;

      const safeSpreadIndex = Math.max(
        0,
        Math.min(maxSpreadIndex, nextSpreadIndex)
      );

      if (safeSpreadIndex === currentSpreadIndex) return;

      clearFlipTimer();

      setFlipState({
        fromSpreadIndex: currentSpreadIndex,
        toSpreadIndex: safeSpreadIndex,
        turnSide: getTurnSide(currentSpreadIndex, safeSpreadIndex),
      });

      flipTimerRef.current = window.setTimeout(() => {
        setCurrentSpreadIndex(safeSpreadIndex);
        setFlipState(null);
        flipTimerRef.current = null;
      }, FLIP_DURATION_MS);
    },
    [
      clearFlipTimer,
      currentSpreadIndex,
      getTurnSide,
      isFlipping,
      maxSpreadIndex,
    ]
  );

  const goPrev = useCallback(() => {
    animateFlipToSpread(currentSpreadIndex - 1);
  }, [animateFlipToSpread, currentSpreadIndex]);

  const goNext = useCallback(() => {
    animateFlipToSpread(currentSpreadIndex + 1);
  }, [animateFlipToSpread, currentSpreadIndex]);

  const goToPage = useCallback(
    (page: number) => {
      const safePage = Math.max(1, Math.min(derivedTotalPages, page));
      jumpToSpread(pageToSpreadIndex(safePage));
      setIsMenuOpen(false);
    },
    [derivedTotalPages, jumpToSpread]
  );

  const toggleFullscreen = useCallback(async () => {
    const root = viewerRootRef.current;
    if (!root) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await root.requestFullscreen();
      }
    } catch (error) {
      console.error("フルスクリーン切替に失敗しました:", error);
    }
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;

      if (e.key === "Escape" && isMenuOpen) {
        e.preventDefault();
        setIsMenuOpen(false);
        return;
      }

      if (isFlipping) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (binding === "rtl") {
          goNext();
        } else {
          goPrev();
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (binding === "rtl") {
          goPrev();
        } else {
          goNext();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [binding, goNext, goPrev, isFlipping, isMenuOpen]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object") {
        return;
      }

      const data = event.data as {
        type?: string;
        page?: number | string;
        direction?: string;
      };

      if (data.type === "gotoPage") {
        const page = Number(data.page);
        if (!Number.isNaN(page)) {
          goToPage(page);
        }
        return;
      }

      if (isFlipping) return;

      if (data.type === "turnByArrow") {
        if (data.direction === "previous") {
          goPrev();
          return;
        }

        if (data.direction === "next") {
          goNext();
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [goNext, goPrev, goToPage, isFlipping]);

  useEffect(() => {
    function handleFullscreenChange() {
      const root = viewerRootRef.current;
      setIsFullscreen(!!root && document.fullscreenElement === root);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!isMenuOpen) return;

      const target = event.target as Node | null;
      if (!target) return;

      const clickedInsidePanel =
        !!menuPanelRef.current && menuPanelRef.current.contains(target);
      const clickedMenuButton =
        !!menuButtonRef.current && menuButtonRef.current.contains(target);

      if (!clickedInsidePanel && !clickedMenuButton) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const pages = getSpreadPages(currentSpreadIndex, derivedTotalPages, binding);
    const currentPage = getPrimaryPage(pages, binding);
    onCurrentPageChange?.(currentPage);

    const url = new URL(window.location.href);
    url.searchParams.set("page", String(currentPage));
    url.searchParams.set("bookId", safeBookId);
    window.history.replaceState(null, "", url.toString());
  }, [
    binding,
    currentSpreadIndex,
    derivedTotalPages,
    onCurrentPageChange,
    safeBookId,
  ]);

  const pageRenderConfig = useMemo(() => {
    return buildPageRenderConfig({
      currentSpreadIndex,
      flipState,
      totalPages: derivedTotalPages,
      binding,
    });
  }, [binding, currentSpreadIndex, derivedTotalPages, flipState]);

  const priorityPages = useMemo(() => {
    const set = new Set<number>();
    const currentPages = getSpreadPages(
      currentSpreadIndex,
      derivedTotalPages,
      binding
    );

    if (currentPages.left !== null) set.add(currentPages.left);
    if (currentPages.right !== null) set.add(currentPages.right);

    if (flipState) {
      const toPages = getSpreadPages(
        flipState.toSpreadIndex,
        derivedTotalPages,
        binding
      );
      if (toPages.left !== null) set.add(toPages.left);
      if (toPages.right !== null) set.add(toPages.right);
    }

    return set;
  }, [binding, currentSpreadIndex, derivedTotalPages, flipState]);

  const fromPages = getSpreadPages(currentSpreadIndex, derivedTotalPages, binding);
  const spreadPageValues = [fromPages.left, fromPages.right].filter(
    (page): page is number => page !== null
  );
  const minVisiblePage =
    spreadPageValues.length > 0 ? Math.min(...spreadPageValues) : 1;
  const maxVisiblePage =
    spreadPageValues.length > 0 ? Math.max(...spreadPageValues) : 1;

  const nextIcon = binding === "rtl" ? "▶" : "◀";
  const prevIcon = binding === "rtl" ? "◀" : "▶";

  return (
    <main
      ref={viewerRootRef}
      className="h-screen overflow-hidden bg-white text-black"
    >
      <div className="relative flex h-screen w-full flex-col bg-white">
        <div className="pointer-events-none absolute left-4 top-4 z-40 flex flex-col gap-2 sm:left-5 sm:top-5">
          <div className="pointer-events-auto">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={toggleMenu}
              aria-label="メニュー"
              title="メニュー"
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#4a3f39] text-white shadow-[0_6px_16px_rgba(0,0,0,0.28)] transition hover:bg-[#5a4d46]"
            >
              <MenuIcon />
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute right-4 bottom-4 z-40 flex flex-col gap-2 sm:right-5 sm:bottom-5">
          <div className="pointer-events-auto">
            <ControlIconButton onClick={goPrev} disabled={!canGoPrev} title="前へ">
              <span className="text-xl leading-none">{prevIcon}</span>
            </ControlIconButton>
          </div>

          <div className="pointer-events-auto">
            <ControlIconButton onClick={goNext} disabled={!canGoNext} title="次へ">
              <span className="text-xl leading-none">{nextIcon}</span>
            </ControlIconButton>
          </div>

          <div className="pointer-events-auto">
            <ControlIconButton
              onClick={toggleFullscreen}
              title={isFullscreen ? "通常表示" : "フルスクリーン"}
            >
              <FullscreenIcon isFullscreen={isFullscreen} />
            </ControlIconButton>
          </div>
        </div>

        {isMenuOpen ? (
          <div
            ref={menuPanelRef}
            className="absolute left-0 top-0 z-30 h-full w-[320px] max-w-[92vw] overflow-hidden bg-[#4a3f39] text-white shadow-[10px_0_28px_rgba(0,0,0,0.32)]"
          >
            <div className="flex h-full flex-col">
              <div className="px-4 pb-4 pt-[72px]">
                <div className="max-h-[calc(100vh-96px)] overflow-y-auto pr-1">
                  <ul className="space-y-0">
                    {resolvedTocItems.map((item) => {
                      const isActive =
                        item.page >= minVisiblePage && item.page <= maxVisiblePage;

                      return (
                        <li
                          key={item.page}
                          className="border-b border-white/10 last:border-b-0"
                        >
                          <button
                            type="button"
                            onClick={() => goToPage(item.page)}
                            className={`flex w-full items-center rounded-lg px-3 py-4 text-left text-[15px] font-semibold leading-[1.35] transition ${
                              isActive
                                ? "bg-white/16 text-white"
                                : "text-white hover:bg-white/8"
                            }`}
                          >
                            <span className="break-words">
                              {item.title} (p.{item.page})
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 items-stretch justify-center overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
          <div
            className="relative h-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_18px_44px_rgba(0,0,0,0.2)]"
            style={{
              width: "min(calc(100vw - 24px), calc((100vh - 24px) * 1116 / 820))",
              aspectRatio: "1116 / 820",
              perspective: "2200px",
            }}
          >
            {!flipState ? (
              <>
                <SpreadView
                  spreadIndex={currentSpreadIndex}
                  activePages={pageRenderConfig.activePages}
                  keepMountedPages={pageRenderConfig.keepMountedPages}
                  priorityPages={priorityPages}
                  binding={binding}
                  totalPages={derivedTotalPages}
                  bookId={safeBookId}
                />
                <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[18px] -translate-x-1/2 bg-gradient-to-r from-black/10 via-black/5 to-black/10" />
              </>
            ) : (
              <>
                <SpreadView
                  spreadIndex={flipState.toSpreadIndex}
                  activePages={pageRenderConfig.activePages}
                  keepMountedPages={pageRenderConfig.keepMountedPages}
                  priorityPages={priorityPages}
                  binding={binding}
                  totalPages={derivedTotalPages}
                  bookId={safeBookId}
                />

                <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[24px] -translate-x-1/2 bg-gradient-to-r from-black/15 via-black/5 to-black/15" />

                {flipState.turnSide === "right" ? (
                  <>
                    <div className="absolute inset-y-0 left-0 z-20 w-1/2 overflow-hidden bg-white">
                      <PageFrame
                        page={fromPages.left}
                        bookId={safeBookId}
                        active={
                          fromPages.left !== null &&
                          pageRenderConfig.activePages.has(fromPages.left)
                        }
                        keepMounted={
                          fromPages.left !== null &&
                          pageRenderConfig.keepMountedPages.has(fromPages.left)
                        }
                        priority={
                          fromPages.left !== null &&
                          priorityPages.has(fromPages.left)
                        }
                      />
                    </div>

                    <div className="absolute inset-y-0 right-0 z-30 w-1/2 overflow-visible [transform-style:preserve-3d]">
                      <div
                        className="absolute inset-0 origin-left animate-[flip-next_700ms_ease-in-out_forwards] [transform-style:preserve-3d]"
                        style={{
                          animationDuration: `${FLIP_DURATION_MS}ms`,
                        }}
                      >
                        <div className="absolute inset-0 overflow-hidden bg-white [backface-visibility:hidden]">
                          <PageFrame
                            page={fromPages.right}
                            bookId={safeBookId}
                            active={
                              fromPages.right !== null &&
                              pageRenderConfig.activePages.has(fromPages.right)
                            }
                            keepMounted={
                              fromPages.right !== null &&
                              pageRenderConfig.keepMountedPages.has(fromPages.right)
                            }
                            priority={
                              fromPages.right !== null &&
                              priorityPages.has(fromPages.right)
                            }
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/18 via-transparent to-transparent" />
                          <div className="pointer-events-none absolute inset-y-0 left-0 w-[26px] bg-gradient-to-r from-black/20 to-transparent" />
                        </div>

                        <div className="absolute inset-0 overflow-hidden bg-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
                          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,240,240,0.96))]" />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/6" />
                          <div className="pointer-events-none absolute inset-y-0 right-0 w-[20px] bg-gradient-to-l from-black/12 to-transparent" />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-y-0 right-0 z-20 w-1/2 overflow-hidden bg-white">
                      <PageFrame
                        page={fromPages.right}
                        bookId={safeBookId}
                        active={
                          fromPages.right !== null &&
                          pageRenderConfig.activePages.has(fromPages.right)
                        }
                        keepMounted={
                          fromPages.right !== null &&
                          pageRenderConfig.keepMountedPages.has(fromPages.right)
                        }
                        priority={
                          fromPages.right !== null &&
                          priorityPages.has(fromPages.right)
                        }
                      />
                    </div>

                    <div className="absolute inset-y-0 left-0 z-30 w-1/2 overflow-visible [transform-style:preserve-3d]">
                      <div
                        className="absolute inset-0 origin-right animate-[flip-prev_700ms_ease-in-out_forwards] [transform-style:preserve-3d]"
                        style={{
                          animationDuration: `${FLIP_DURATION_MS}ms`,
                        }}
                      >
                        <div className="absolute inset-0 overflow-hidden bg-white [backface-visibility:hidden]">
                          <PageFrame
                            page={fromPages.left}
                            bookId={safeBookId}
                            active={
                              fromPages.left !== null &&
                              pageRenderConfig.activePages.has(fromPages.left)
                            }
                            keepMounted={
                              fromPages.left !== null &&
                              pageRenderConfig.keepMountedPages.has(fromPages.left)
                            }
                            priority={
                              fromPages.left !== null &&
                              priorityPages.has(fromPages.left)
                            }
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/18 via-transparent to-transparent" />
                          <div className="pointer-events-none absolute inset-y-0 right-0 w-[26px] bg-gradient-to-l from-black/20 to-transparent" />
                        </div>

                        <div className="absolute inset-0 overflow-hidden bg-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
                          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,240,240,0.96))]" />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/10 via-transparent to-black/6" />
                          <div className="pointer-events-none absolute inset-y-0 left-0 w-[20px] bg-gradient-to-r from-black/12 to-transparent" />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes flip-next {
          0% {
            transform: rotateY(0deg);
          }
          100% {
            transform: rotateY(-180deg);
          }
        }

        @keyframes flip-prev {
          0% {
            transform: rotateY(0deg);
          }
          100% {
            transform: rotateY(180deg);
          }
        }

        html,
        body {
          overflow: hidden;
        }
      `}</style>
    </main>
  );
}