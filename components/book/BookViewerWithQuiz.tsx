"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BookViewer from "@/components/book/BookViewer";
import QuestionPanel from "@/components/book/QuestionPanel";
import { loadAnswers, saveAnswers } from "@/lib/pagingtale/storage";
import type {
  AnswerResult,
  QuestionItem,
  QuestionMaster,
  QuestionMode,
  StoredAnswerMap,
} from "@/lib/pagingtale/types";

async function safeFetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    console.warn("missing:", url, res.status);
    return null;
  }

  try {
    return await res.json();
  } catch (e) {
    console.error("JSON parse error:", url, e);
    return null;
  }
}

const FALLBACK_BOOK_ID = "pagingtale-book-001";
const STUDENT_PROFILE_STORAGE_KEY = "pagingtale-student-profile";
const STUDENT_INFO_PAGE = 1;
const TIMER_STORAGE_PREFIX = "pagingtale_test_timer_";

type TocItem = {
  page: number;
  title: string;
  desc: string;
  section: string;
};

type BookMeta = {
  bookId: string;
  title?: string;
  totalPages?: number;
  binding?: "rtl" | "ltr";
  startPage?: number;
};

type LessonItem = {
  lessonId: string;
  bookId: string;
  lessonNo: number;
  lessonTitle: string;
  startPage: number;
  endPage: number;
  testId?: string;
};

type LessonsMaster = {
  bookId: string;
  lessons: LessonItem[];
};

type TestDefinition = {
  testId: string;
  bookId: string;
  testTitle: string;
  targetLessonFrom: number;
  targetLessonTo: number;
  mode?: string;
  publishedAt?: string;
  notes?: string;
  timeLimitMinutes?: number;
};

type TestsMaster = {
  bookId: string;
  tests: TestDefinition[];
};

type TimerSnapshot = {
  startedAt: string;
  expiresAt: string;
};

type SubmitReason = "manual" | "auto";

type LocalStudentProfile = {
  classId: string;
  studentNumber: string;
  studentName: string;
};

type AuthenticatedStudentProfile = {
  classId: number;
  studentNumber: string;
  studentName: string;
};

type ClassOption = {
  id: number;
  name: string;
};

type LookupStudent = {
  id: number;
  classId: number;
  studentNumber: string;
  studentName: string;
};

type SubmitAnswerRow = {
  questionId: string;
  page: number;
  prompt: string;
  correctAnswer: string;
  judgeMode: string;
  mark: "○" | "×" | "□";
  value: string;
  answeredAt: string | null;
  points: number;
};

type SubmitPayload = {
  bookId: string;
  testId: string | null;
  testTitle: string | null;
  submittedAt: string;
  submittedPage: number;
  submitReason: SubmitReason;
  timeLimitMinutes: number | null;
  student: {
    classId: number;
    studentNumber: string;
    studentName: string;
  };
  answers: SubmitAnswerRow[];
};

type BookViewerWithQuizProps = {
  initialPage?: number;
  bookId?: string;
  testId?: string | null;
  authenticatedStudentProfile?: AuthenticatedStudentProfile | null;
  lockStudentProfile?: boolean;
  showQuestionUi?: boolean;
  teacherCanSwitchMode?: boolean;
};

function normalizeBookId(bookId?: string): string {
  const value = (bookId ?? "").trim();
  return value || FALLBACK_BOOK_ID;
}

function getQuestionMode(question: QuestionItem): QuestionMode {
  return question.mode === "test" ? "test" : "practice";
}

function getTestMode(mode?: string): QuestionMode | null {
  const normalized = (mode ?? "").trim().toLowerCase();

  if (normalized === "test") return "test";
  if (normalized === "practice") return "practice";
  return null;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeAnswerValue(value: string): string {
  return normalizeText(value).replace(/，/g, ",");
}

function splitCorrectAnswers(value: string): string[] {
  return normalizeAnswerValue(value)
    .split(",")
    .map((item) => normalizeText(item))
    .filter((item) => item.length > 0);
}

function judgeForCsv(question: QuestionItem, value: string): "○" | "×" | "□" {
  const judgeMode = question.judgeMode ?? "none";
  const input = normalizeAnswerValue(value);
  const answers = splitCorrectAnswers(question.correctAnswer ?? "");

  if (judgeMode === "none" || answers.length === 0) {
    return "□";
  }

  if (!input) {
    return "×";
  }

  if (judgeMode === "includes") {
    return answers.some(
      (answer) => input.includes(answer) || answer.includes(input)
    )
      ? "○"
      : "×";
  }

  if (judgeMode === "exact") {
    return answers.includes(input) ? "○" : "×";
  }

  return "□";
}

function loadStudentProfile(): LocalStudentProfile {
  if (typeof window === "undefined") {
    return {
      classId: "",
      studentNumber: "",
      studentName: "",
    };
  }

  try {
    const raw = window.localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY);
    if (!raw) {
      return {
        classId: "",
        studentNumber: "",
        studentName: "",
      };
    }

    const parsed = JSON.parse(raw) as Partial<LocalStudentProfile>;

    return {
      classId: typeof parsed.classId === "string" ? parsed.classId : "",
      studentNumber:
        typeof parsed.studentNumber === "string" ? parsed.studentNumber : "",
      studentName:
        typeof parsed.studentName === "string" ? parsed.studentName : "",
    };
  } catch {
    return {
      classId: "",
      studentNumber: "",
      studentName: "",
    };
  }
}

function buildInitialStudentProfile(
  authenticatedStudentProfile?: AuthenticatedStudentProfile | null
): LocalStudentProfile {
  if (authenticatedStudentProfile) {
    return {
      classId: String(authenticatedStudentProfile.classId),
      studentNumber: authenticatedStudentProfile.studentNumber,
      studentName: authenticatedStudentProfile.studentName,
    };
  }

  return loadStudentProfile();
}

function saveStudentProfile(profile: LocalStudentProfile) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    STUDENT_PROFILE_STORAGE_KEY,
    JSON.stringify(profile)
  );
}

function buildTimerStorageKey(bookId: string, testId: string): string {
  return `${TIMER_STORAGE_PREFIX}${bookId}_${testId}`;
}

function loadTimerSnapshot(
  bookId: string,
  testId: string
): TimerSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(
      buildTimerStorageKey(bookId, testId)
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<TimerSnapshot>;
    if (
      typeof parsed.startedAt !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return null;
    }

    return {
      startedAt: parsed.startedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

function saveTimerSnapshot(
  bookId: string,
  testId: string,
  snapshot: TimerSnapshot
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    buildTimerStorageKey(bookId, testId),
    JSON.stringify(snapshot)
  );
}

function clearTimerSnapshot(bookId: string, testId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(buildTimerStorageKey(bookId, testId));
}

function formatRemainingTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function downloadJsonFile(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function downloadTextFile(
  fileName: string,
  text: string,
  mimeType: string,
  withBom: boolean = false
) {
  const content = withBom ? `\uFEFF${text}` : text;
  const blob = new Blob([content], { type: mimeType });

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function sanitizeFileNamePart(value: string): string {
  return value.trim().replace(/[\\/:*?"<>| ]+/g, "_");
}

function escapeCsvValue(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildSubmitCsv(payload: SubmitPayload): string {
  const header = [
    "submittedAt",
    "submitReason",
    "bookId",
    "classId",
    "testId",
    "testTitle",
    "timeLimitMinutes",
    "studentNumber",
    "studentName",
    "questionId",
    "page",
    "points",
    "prompt",
    "correctAnswer",
    "judgeMode",
    "mark",
    "answer",
    "answeredAt",
  ];

  const rows = payload.answers.map((answer) =>
    [
      payload.submittedAt,
      payload.submitReason,
      payload.bookId,
      payload.student.classId,
      payload.testId,
      payload.testTitle,
      payload.timeLimitMinutes,
      payload.student.studentNumber,
      payload.student.studentName,
      answer.questionId,
      answer.page,
      answer.points,
      answer.prompt,
      answer.correctAnswer,
      answer.judgeMode,
      answer.mark,
      answer.value,
      answer.answeredAt,
    ]
      .map((cell) => escapeCsvValue(cell))
      .join(",")
  );

  return [header.join(","), ...rows].join("\r\n");
}

function pickActiveTest(
  testsMaster: TestsMaster | null,
  lessonsMaster: LessonsMaster | null,
  questions: QuestionItem[]
): TestDefinition | null {
  if (!testsMaster || !Array.isArray(testsMaster.tests)) return null;
  if (testsMaster.tests.length === 0) return null;

  const lessonList = lessonsMaster?.lessons ?? [];
  let bestTest: TestDefinition | null = null;
  let bestScore = -1;

  for (const test of testsMaster.tests) {
    const coveredLessons = lessonList.filter((lesson) => {
      return (
        lesson.bookId === test.bookId &&
        lesson.lessonNo >= test.targetLessonFrom &&
        lesson.lessonNo <= test.targetLessonTo
      );
    });

    let score = 0;

    for (const question of questions) {
      const matched = coveredLessons.some((lesson) => {
        return (
          question.page >= lesson.startPage && question.page <= lesson.endPage
        );
      });

      if (matched) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTest = test;
    }
  }

  return bestTest ?? testsMaster.tests[0] ?? null;
}

function normalizeTocItems(value: unknown): TocItem[] {
  if (!Array.isArray(value)) return [];

  const normalized: TocItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const rawPage = (item as { page?: unknown }).page;
    const rawTitle = (item as { title?: unknown }).title;
    const rawDesc = (item as { desc?: unknown }).desc;
    const rawSection = (item as { section?: unknown }).section;

    const page = Number(rawPage);
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";

    if (!Number.isFinite(page) || page <= 0 || !title) {
      continue;
    }

    normalized.push({
      page: Math.floor(page),
      title,
      desc: typeof rawDesc === "string" ? rawDesc : "",
      section: typeof rawSection === "string" ? rawSection : "",
    });
  }

  return normalized;
}

function normalizeBookMeta(value: unknown, fallbackBookId: string): BookMeta {
  if (!value || typeof value !== "object") {
    return {
      bookId: fallbackBookId,
    };
  }

  const raw = value as Record<string, unknown>;
  const totalPages =
    typeof raw.totalPages === "number" &&
    Number.isFinite(raw.totalPages) &&
    raw.totalPages > 0
      ? Math.floor(raw.totalPages)
      : undefined;

  const binding =
    raw.binding === "rtl" || raw.binding === "ltr" ? raw.binding : undefined;

  const startPage =
    typeof raw.startPage === "number" &&
    Number.isFinite(raw.startPage) &&
    raw.startPage > 0
      ? Math.floor(raw.startPage)
      : undefined;

  return {
    bookId:
      typeof raw.bookId === "string" && raw.bookId.trim()
        ? raw.bookId.trim()
        : fallbackBookId,
    title: typeof raw.title === "string" ? raw.title : undefined,
    totalPages,
    binding,
    startPage,
  };
}

export default function BookViewerWithQuiz({
  initialPage = 1,
  bookId: bookIdProp = FALLBACK_BOOK_ID,
  testId: testIdProp = null,
  authenticatedStudentProfile = null,
  lockStudentProfile = false,
  showQuestionUi = true,
  teacherCanSwitchMode = false,
}: BookViewerWithQuizProps) {
  const requestedBookId = useMemo(() => normalizeBookId(bookIdProp), [bookIdProp]);

  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [questionMaster, setQuestionMaster] = useState<QuestionMaster | null>(
    null
  );
  const [testsMaster, setTestsMaster] = useState<TestsMaster | null>(null);
  const [lessonsMaster, setLessonsMaster] = useState<LessonsMaster | null>(
    null
  );
  const [bookMeta, setBookMeta] = useState<BookMeta | null>(null);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [isQuestionLoading, setIsQuestionLoading] = useState<boolean>(false);
  const [questionLoadError, setQuestionLoadError] = useState<string | null>(
    null
  );
  const [isQuestionPanelOpen, setIsQuestionPanelOpen] =
    useState<boolean>(false);
  const [isStudentInfoOpen, setIsStudentInfoOpen] = useState<boolean>(true);
  const [studentProfile, setStudentProfile] = useState<LocalStudentProfile>(() =>
    buildInitialStudentProfile(authenticatedStudentProfile)
  );
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [isClassOptionsLoading, setIsClassOptionsLoading] =
    useState<boolean>(false);
  const [classOptionsError, setClassOptionsError] = useState<string | null>(
    null
  );
  const [timerSnapshot, setTimerSnapshot] = useState<TimerSnapshot | null>(
    null
  );
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [overrideMode, setOverrideMode] = useState<QuestionMode | null>(null);

  const submitLockRef = useRef<boolean>(false);
  const previousRemainingMsRef = useRef<number | null>(null);
  const lastAutoFilledStudentNumberRef = useRef<string>("");
  const initializedTestSessionKeyRef = useRef<string>("");

  const bookId = (questionMaster?.bookId ?? bookMeta?.bookId ?? requestedBookId).trim();

  const [answers, setAnswers] = useState<StoredAnswerMap>(() =>
    loadAnswers(requestedBookId)
  );
  const forcedTestId = (testIdProp ?? "").trim();

  useEffect(() => {
    if (!authenticatedStudentProfile) return;

    setStudentProfile({
      classId: String(authenticatedStudentProfile.classId),
      studentNumber: authenticatedStudentProfile.studentNumber,
      studentName: authenticatedStudentProfile.studentName,
    });
  }, [authenticatedStudentProfile]);

  const finalPage = useMemo(() => {
    const metaPage =
      typeof bookMeta?.totalPages === "number" &&
      Number.isFinite(bookMeta.totalPages) &&
      bookMeta.totalPages > 0
        ? bookMeta.totalPages
        : 1;

    const tocMaxPage =
      tocItems.length > 0 ? Math.max(...tocItems.map((item) => item.page)) : 1;

    const questionMaxPage =
      questionMaster?.questions && questionMaster.questions.length > 0
        ? Math.max(...questionMaster.questions.map((question) => question.page))
        : 1;

    return Math.max(metaPage, tocMaxPage, questionMaxPage, 1);
  }, [bookMeta, questionMaster, tocItems]);

  const resolvedBinding = bookMeta?.binding === "ltr" ? "ltr" : "rtl";

  useEffect(() => {
    saveStudentProfile(studentProfile);
  }, [studentProfile]);

  useEffect(() => {
    let cancelled = false;

    async function loadMasters() {
      try {
        setIsQuestionLoading(showQuestionUi);
        setQuestionLoadError(null);

        const encodedBookId = encodeURIComponent(requestedBookId);

        const [questionsData, testsData, lessonsData, tocData, bookData] =
          await Promise.all([
            showQuestionUi
              ? safeFetchJson(`/book-assets/${encodedBookId}/data/questions.json`)
              : Promise.resolve(null),
            showQuestionUi
              ? safeFetchJson(`/book-assets/${encodedBookId}/data/tests.json`)
              : Promise.resolve(null),
            showQuestionUi
              ? safeFetchJson(`/book-assets/${encodedBookId}/data/lessons.json`)
              : Promise.resolve(null),
            safeFetchJson(`/book-assets/${encodedBookId}/data/toc.json`),
            safeFetchJson(`/book-assets/${encodedBookId}/data/book.json`),
          ]);

        if (!bookData) {
          throw new Error("book.json が見つかりません。");
        }

        const safeBookMeta = normalizeBookMeta(bookData, requestedBookId);
        const safeTocItems = normalizeTocItems(tocData);

        if (!showQuestionUi) {
          if (cancelled) return;

          setQuestionMaster(null);
          setTestsMaster(null);
          setLessonsMaster(null);
          setBookMeta(safeBookMeta);
          setTocItems(safeTocItems);
          setAnswers({});
          return;
        }

        if (!questionsData) {
          throw new Error("questions.json が見つかりません。");
        }

        const questionData = questionsData as QuestionMaster;

        if (
          !questionData ||
          typeof questionData !== "object" ||
          !questionData.bookId ||
          !questionData.bookVersion ||
          !Array.isArray(questionData.questions)
        ) {
          throw new Error("questions.json の形式が不正です。");
        }

        const normalizedQuestions = questionData.questions.filter(
          (question): question is QuestionItem => {
            return (
              !!question &&
              typeof question === "object" &&
              typeof question.id === "string" &&
              question.id.trim().length > 0 &&
              typeof question.page === "number" &&
              Number.isFinite(question.page) &&
              typeof question.prompt === "string" &&
              question.prompt.trim().length > 0 &&
              typeof question.points === "number" &&
              Number.isFinite(question.points)
            );
          }
        );

        const safeQuestionData: QuestionMaster = {
          bookId: questionData.bookId,
          bookVersion: questionData.bookVersion,
          questions: normalizedQuestions,
        };

        let safeTestsMaster: TestsMaster | null = null;
        if (testsData && typeof testsData === "object") {
          const parsedTests = testsData as Partial<TestsMaster>;
          safeTestsMaster = {
            bookId:
              typeof parsedTests.bookId === "string"
                ? parsedTests.bookId
                : safeQuestionData.bookId,
            tests: Array.isArray(parsedTests.tests)
              ? parsedTests.tests
                  .filter((item): item is TestDefinition => {
                    return (
                      !!item &&
                      typeof item === "object" &&
                      typeof item.testId === "string" &&
                      item.testId.trim().length > 0 &&
                      typeof item.bookId === "string" &&
                      typeof item.testTitle === "string" &&
                      typeof item.targetLessonFrom === "number" &&
                      Number.isFinite(item.targetLessonFrom) &&
                      typeof item.targetLessonTo === "number" &&
                      Number.isFinite(item.targetLessonTo)
                    );
                  })
                  .map((item) => ({
                    ...item,
                    timeLimitMinutes:
                      typeof item.timeLimitMinutes === "number" &&
                      Number.isFinite(item.timeLimitMinutes) &&
                      item.timeLimitMinutes > 0
                        ? item.timeLimitMinutes
                        : undefined,
                  }))
              : [],
          };
        }

        let safeLessonsMaster: LessonsMaster | null = null;
        if (lessonsData && typeof lessonsData === "object") {
          const parsedLessons = lessonsData as Partial<LessonsMaster>;
          safeLessonsMaster = {
            bookId:
              typeof parsedLessons.bookId === "string"
                ? parsedLessons.bookId
                : safeQuestionData.bookId,
            lessons: Array.isArray(parsedLessons.lessons)
              ? parsedLessons.lessons.filter((item): item is LessonItem => {
                  return (
                    !!item &&
                    typeof item === "object" &&
                    typeof item.lessonId === "string" &&
                    typeof item.bookId === "string" &&
                    typeof item.lessonNo === "number" &&
                    Number.isFinite(item.lessonNo) &&
                    typeof item.startPage === "number" &&
                    Number.isFinite(item.startPage) &&
                    typeof item.endPage === "number" &&
                    Number.isFinite(item.endPage)
                  );
                })
              : [],
          };
        }

        if (cancelled) return;

        setQuestionMaster(safeQuestionData);
        setTestsMaster(safeTestsMaster);
        setLessonsMaster(safeLessonsMaster);
        setBookMeta(safeBookMeta);
        setTocItems(safeTocItems);
        setAnswers(loadAnswers(safeQuestionData.bookId));
      } catch (error) {
        if (cancelled) return;

        console.error(error);
        setQuestionLoadError(
          error instanceof Error
            ? error.message
            : "問題データの読み込みに失敗しました。"
        );
      } finally {
        if (!cancelled) {
          setIsQuestionLoading(false);
        }
      }
    }

    void loadMasters();

    return () => {
      cancelled = true;
    };
  }, [requestedBookId, showQuestionUi]);

  useEffect(() => {
    if (!showQuestionUi) {
      setClassOptions([]);
      setIsClassOptionsLoading(false);
      setClassOptionsError(null);
      return;
    }

    let cancelled = false;

    async function loadClassOptions() {
      try {
        setIsClassOptionsLoading(true);
        setClassOptionsError(null);

        const response = await fetch("/api/classes", { cache: "no-store" });
        const text = await response.text();

        let payload:
          | {
              ok?: boolean;
              classes?: Array<{ id?: number; name?: string }>;
              message?: string;
            }
          | null = null;

        try {
          payload = JSON.parse(text) as {
            ok?: boolean;
            classes?: Array<{ id?: number; name?: string }>;
            message?: string;
          };
        } catch {
          payload = null;
        }

        if (!response.ok || !payload?.ok || !Array.isArray(payload.classes)) {
          throw new Error(
            payload?.message || "クラス一覧の取得に失敗しました。"
          );
        }

        const safeOptions = payload.classes
          .filter(
            (item): item is { id: number; name: string } =>
              typeof item?.id === "number" &&
              Number.isFinite(item.id) &&
              item.id > 0 &&
              typeof item?.name === "string" &&
              item.name.trim().length > 0
          )
          .map((item) => ({
            id: item.id,
            name: item.name.trim(),
          }));

        if (cancelled) return;

        setClassOptions(safeOptions);
      } catch (error) {
        if (cancelled) return;

        console.error(error);
        setClassOptions([]);
        setClassOptionsError(
          error instanceof Error
            ? error.message
            : "クラス一覧の取得に失敗しました。"
        );
      } finally {
        if (!cancelled) {
          setIsClassOptionsLoading(false);
        }
      }
    }

    void loadClassOptions();

    return () => {
      cancelled = true;
    };
  }, [showQuestionUi]);

  useEffect(() => {
    if (!showQuestionUi || lockStudentProfile) {
      return;
    }

    const classId = Number(studentProfile.classId);
    const studentNumber = studentProfile.studentNumber.trim();

    if (!Number.isInteger(classId) || classId <= 0 || !studentNumber) {
      return;
    }

    const timerId = window.setTimeout(async () => {
      try {
        const search = new URLSearchParams({
          classId: String(classId),
          studentNumber,
        });

        const response = await fetch(
          `/api/students/lookup?${search.toString()}`,
          { cache: "no-store" }
        );

        const text = await response.text();

        let payload:
          | {
              ok?: boolean;
              student?: Partial<LookupStudent> | null;
              message?: string;
            }
          | null = null;

        try {
          payload = JSON.parse(text) as {
            ok?: boolean;
            student?: Partial<LookupStudent> | null;
            message?: string;
          };
        } catch {
          payload = null;
        }

        if (!response.ok || !payload?.ok) {
          return;
        }

        const student =
          payload.student &&
          typeof payload.student.id === "number" &&
          typeof payload.student.classId === "number" &&
          typeof payload.student.studentNumber === "string" &&
          typeof payload.student.studentName === "string"
            ? {
                id: payload.student.id,
                classId: payload.student.classId,
                studentNumber: payload.student.studentNumber,
                studentName: payload.student.studentName,
              }
            : null;

        if (student) {
          setStudentProfile((prev) => {
            const shouldAutofillName =
              !prev.studentName.trim() ||
              lastAutoFilledStudentNumberRef.current ===
                prev.studentNumber.trim();

            if (!shouldAutofillName) {
              return prev;
            }

            lastAutoFilledStudentNumberRef.current = student.studentNumber;

            return {
              ...prev,
              studentName: student.studentName,
            };
          });
        }
      } catch {}
    }, 300);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    lockStudentProfile,
    showQuestionUi,
    studentProfile.classId,
    studentProfile.studentNumber,
  ]);

  const currentQuestions = useMemo(() => {
    if (!questionMaster || !showQuestionUi) return [];

    return questionMaster.questions.filter(
      (question) => question.page === currentPage
    );
  }, [currentPage, questionMaster, showQuestionUi]);

  const activeTest = useMemo(() => {
    if (!showQuestionUi) return null;

    if (forcedTestId && testsMaster?.tests?.length) {
      const forced = testsMaster.tests.find(
        (test) => test.testId === forcedTestId
      );

      if (forced) {
        return forced;
      }
    }

    return pickActiveTest(
      testsMaster,
      lessonsMaster,
      questionMaster?.questions ?? []
    );
  }, [forcedTestId, testsMaster, lessonsMaster, questionMaster, showQuestionUi]);

  const currentPageMode = useMemo<QuestionMode>(() => {
    if (!showQuestionUi) {
      return "practice";
    }

    const testMode = getTestMode(activeTest?.mode);

    if (testMode) {
      return testMode;
    }

    if (
      currentQuestions.some((question) => getQuestionMode(question) === "test")
    ) {
      return "test";
    }

    return "practice";
  }, [activeTest, currentQuestions, showQuestionUi]);

  const displayMode: QuestionMode =
    teacherCanSwitchMode && overrideMode ? overrideMode : currentPageMode;

  const allTestQuestions = useMemo(() => {
    const allQuestions = questionMaster?.questions ?? [];

    if (!showQuestionUi || !activeTest || displayMode !== "test") {
      return [] as QuestionItem[];
    }

    const coveredLessons = (lessonsMaster?.lessons ?? []).filter((lesson) => {
      return (
        lesson.bookId === activeTest.bookId &&
        lesson.lessonNo >= activeTest.targetLessonFrom &&
        lesson.lessonNo <= activeTest.targetLessonTo
      );
    });

    if (coveredLessons.length === 0) {
      return allQuestions;
    }

    return allQuestions.filter((question) =>
      coveredLessons.some(
        (lesson) =>
          question.page >= lesson.startPage && question.page <= lesson.endPage
      )
    );
  }, [activeTest, displayMode, lessonsMaster, questionMaster, showQuestionUi]);

  useEffect(() => {
    if (!showQuestionUi || displayMode !== "test" || !activeTest?.testId) {
      initializedTestSessionKeyRef.current = "";
      return;
    }

    const sessionKey = `${bookId}::${activeTest.testId}`;

    if (initializedTestSessionKeyRef.current === sessionKey) {
      return;
    }

    initializedTestSessionKeyRef.current = sessionKey;
    setIsSubmitted(false);

    if (allTestQuestions.length === 0) {
      return;
    }

    setAnswers((prev) => {
      let changed = false;
      const next: StoredAnswerMap = { ...prev };

      for (const question of allTestQuestions) {
        if (next[question.id]) {
          delete next[question.id];
          changed = true;
        }
      }

      if (changed) {
        saveAnswers(bookId, next);
        return next;
      }

      return prev;
    });
  }, [activeTest, allTestQuestions, bookId, displayMode, showQuestionUi]);

  const timeLimitMinutes =
    typeof activeTest?.timeLimitMinutes === "number"
      ? activeTest.timeLimitMinutes
      : null;

  const selectedClassName = useMemo(() => {
    const selectedId = Number(studentProfile.classId);
    if (!Number.isInteger(selectedId) || selectedId <= 0) return "";
    return classOptions.find((item) => item.id === selectedId)?.name ?? "";
  }, [classOptions, studentProfile.classId]);

  useEffect(() => {
    if (
      !showQuestionUi ||
      !activeTest ||
      displayMode !== "test" ||
      !timeLimitMinutes ||
      timeLimitMinutes <= 0
    ) {
      setTimerSnapshot(null);
      setRemainingMs(null);
      previousRemainingMsRef.current = null;
      return;
    }

    const existing = loadTimerSnapshot(bookId, activeTest.testId);
    if (existing) {
      setTimerSnapshot(existing);
      return;
    }

    const now = Date.now();
    const snapshot: TimerSnapshot = {
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + timeLimitMinutes * 60 * 1000).toISOString(),
    };

    saveTimerSnapshot(bookId, activeTest.testId, snapshot);
    setTimerSnapshot(snapshot);
  }, [activeTest, bookId, displayMode, timeLimitMinutes, showQuestionUi]);

  useEffect(() => {
    if (!timerSnapshot) {
      setRemainingMs(null);
      return;
    }

    const expiresAt = timerSnapshot.expiresAt;

    function updateRemaining() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      setRemainingMs(diff);
    }

    updateRemaining();

    const timerId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timerId);
  }, [timerSnapshot]);

  useEffect(() => {
    const initialFromMeta =
      typeof bookMeta?.startPage === "number" &&
      Number.isFinite(bookMeta.startPage) &&
      bookMeta.startPage > 0
        ? Math.floor(bookMeta.startPage)
        : 1;

    const safeInitialPage =
      typeof initialPage === "number" &&
      Number.isFinite(initialPage) &&
      initialPage > 0
        ? Math.floor(initialPage)
        : initialFromMeta;

    setCurrentPage(Math.max(1, Math.min(finalPage, safeInitialPage)));
  }, [bookMeta, finalPage, initialPage, requestedBookId]);

  useEffect(() => {
    setOverrideMode(null);
  }, [requestedBookId, testIdProp]);

  const isTimedTest =
    !!activeTest && displayMode === "test" && !!timeLimitMinutes;
  const isStudentInfoPage = currentPage === STUDENT_INFO_PAGE;
  const isSubmitPage = currentPage === finalPage;
  const shouldShowQuestionPanelArea = showQuestionUi && !isStudentInfoPage;

  const questionStatusText =
    showQuestionUi && isQuestionLoading
      ? "問題データを読み込み中です..."
      : showQuestionUi && questionLoadError
        ? `問題データの読み込みに失敗しました: ${questionLoadError}`
        : null;

  const currentPageQuestionCount = currentQuestions.length;

  const answeredQuestionCount = currentQuestions.filter(
    (question) => answers[question.id]?.answeredAt
  ).length;

  const questionToggleLabel =
    currentPageQuestionCount > 0
      ? `問題 ${answeredQuestionCount}/${currentPageQuestionCount}`
      : "問題";

  function handleSubmitAnswer(
    questionId: string,
    value: string,
    result: AnswerResult
  ) {
    const nextAnswers: StoredAnswerMap = {
      ...answers,
      [questionId]: {
        questionId,
        value,
        result,
        answeredAt: new Date().toISOString(),
      },
    };

    setAnswers(nextAnswers);
    saveAnswers(bookId, nextAnswers);
  }

  function toggleQuestionPanel() {
    setIsQuestionPanelOpen((prev) => !prev);
  }

  function toggleStudentInfoPanel() {
    setIsStudentInfoOpen((prev) => !prev);
  }

  function handleStudentProfileChange(
    key: keyof LocalStudentProfile,
    value: string
  ) {
    if (lockStudentProfile) {
      return;
    }

    if (key === "studentNumber") {
      lastAutoFilledStudentNumberRef.current = "";
    }

    if (key === "studentName") {
      lastAutoFilledStudentNumberRef.current = "";
    }

    if (key === "classId") {
      lastAutoFilledStudentNumberRef.current = "";
    }

    setStudentProfile((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  const buildSubmitPayload = useCallback(
    (reason: SubmitReason): SubmitPayload => {
      return {
        bookId,
        testId: activeTest?.testId ?? null,
        testTitle: activeTest?.testTitle ?? null,
        submittedAt: new Date().toISOString(),
        submittedPage: currentPage,
        submitReason: reason,
        timeLimitMinutes,
        student: {
          classId: Number(studentProfile.classId),
          studentNumber: studentProfile.studentNumber.trim(),
          studentName: studentProfile.studentName.trim(),
        },
        answers: allTestQuestions.map((question) => ({
          questionId: question.id,
          page: question.page,
          prompt: question.prompt ?? "",
          correctAnswer: question.correctAnswer ?? "",
          judgeMode: question.judgeMode ?? "none",
          mark: judgeForCsv(question, answers[question.id]?.value ?? ""),
          value: answers[question.id]?.value ?? "",
          answeredAt: answers[question.id]?.answeredAt ?? null,
          points:
            typeof question.points === "number" && Number.isFinite(question.points)
              ? question.points
              : 0,
        })),
      };
    },
    [
      activeTest,
      allTestQuestions,
      answers,
      bookId,
      currentPage,
      studentProfile,
      timeLimitMinutes,
    ]
  );

  const handleSubmitTest = useCallback(
    async (reason: SubmitReason = "manual") => {
      if (submitLockRef.current || isSubmitting) return;
      submitLockRef.current = true;
      setIsSubmitting(true);

      try {
        const numericClassId = Number(studentProfile.classId);

        if (!Number.isInteger(numericClassId) || numericClassId <= 0) {
          window.alert("クラスを選択してください。");
          return;
        }

        const studentNumber = studentProfile.studentNumber.trim();
        const studentName = studentProfile.studentName.trim();

        if (!studentNumber || !studentName) {
          window.alert("学籍番号と氏名を入力してください。");
          return;
        }

        const payload = buildSubmitPayload(reason);

        if (process.env.NODE_ENV === "development") {
          console.log("[submit payload]", payload);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

        const baseName = [
          sanitizeFileNamePart(payload.testId ?? "test"),
          sanitizeFileNamePart(
            selectedClassName || String(payload.student.classId)
          ),
          sanitizeFileNamePart(payload.student.studentNumber || "no-number"),
          sanitizeFileNamePart(payload.student.studentName || "no-name"),
          timestamp,
        ].join("_");

        const response = await fetch("/api/test-submissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (process.env.NODE_ENV === "development") {
          console.log("[submit status]", response.status);
        }

        if (!response.ok) {
          const errorText = await response.text();

          console.error("[submit API failed]", {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get("content-type"),
            body: errorText,
          });

          let message =
            "サーバへの提出保存に失敗しました。通信状況を確認して、もう一度提出してください。";

          if (errorText.trim()) {
            try {
              const parsed = JSON.parse(errorText) as {
                ok?: boolean;
                error?: string;
                message?: string;
              };

              if (typeof parsed.message === "string" && parsed.message.trim()) {
                message = parsed.message.trim();
              }
            } catch (parseError) {
              console.error("[submit parse error]", parseError);
            }
          }

          window.alert(message);
          return;
        }

        downloadJsonFile(`${baseName}.json`, payload);

        const csvText = buildSubmitCsv(payload);
        downloadTextFile(
          `${baseName}.csv`,
          csvText,
          "text/csv;charset=utf-8",
          true
        );

        if (activeTest?.testId) {
          clearTimerSnapshot(bookId, activeTest.testId);
        }

        setIsSubmitted(true);

        window.alert(
          reason === "auto"
            ? "時間切れのため、自動提出しました。サーバ保存と JSON / CSV ダウンロードが完了しました。"
            : "テストを提出しました。サーバ保存と JSON / CSV ダウンロードが完了しました。"
        );
      } catch (err) {
        console.error("[submit exception]", {
          error: err,
          studentProfile,
          bookId,
          testId: activeTest?.testId ?? null,
          currentPage,
        });

        window.alert(
          "提出中にエラーが発生しました。通信状況を確認して、もう一度提出してください。"
        );
      } finally {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    },
    [
      activeTest,
      bookId,
      buildSubmitPayload,
      currentPage,
      isSubmitting,
      selectedClassName,
      studentProfile,
    ]
  );

  useEffect(() => {
    if (!isTimedTest || remainingMs === null || isSubmitted) {
      previousRemainingMsRef.current = remainingMs;
      return;
    }

    const previous = previousRemainingMsRef.current;

    if (previous !== null && previous > 0 && remainingMs <= 0) {
      handleSubmitTest("auto");
    }

    previousRemainingMsRef.current = remainingMs;
  }, [handleSubmitTest, isSubmitted, isTimedTest, remainingMs]);

  useEffect(() => {
    setIsQuestionPanelOpen(false);
  }, [currentPage]);

  useEffect(() => {
    if (isStudentInfoPage) {
      setIsStudentInfoOpen(true);
    }
  }, [isStudentInfoPage]);

  return (
    <div className="relative h-screen w-full bg-[#f7f4ef]">
      <BookViewer
        bookId={bookId}
        tocItems={tocItems}
        totalPages={finalPage}
        binding={resolvedBinding}
        onCurrentPageChange={setCurrentPage}
        initialPage={currentPage}
      />

      {showQuestionUi && (teacherCanSwitchMode || (isTimedTest && remainingMs !== null && !isSubmitted)) ? (
        <div className="pointer-events-none absolute right-4 top-32 z-40 flex flex-col gap-2 sm:right-5 sm:top-20">
          {teacherCanSwitchMode ? (
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur">
              <span className="px-1 text-xs font-bold tracking-wide text-slate-500">
                MODE
              </span>

              <button
                type="button"
                onClick={() => setOverrideMode("practice")}
                className={`rounded-lg px-3 py-1 text-sm font-bold transition ${
                  displayMode === "practice"
                    ? "bg-sky-600 text-white"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                practice
              </button>

              <button
                type="button"
                onClick={() => setOverrideMode("test")}
                className={`rounded-lg px-3 py-1 text-sm font-bold transition ${
                  displayMode === "test"
                    ? "bg-rose-600 text-white"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                test
              </button>

              <button
                type="button"
                onClick={() => setOverrideMode(null)}
                className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
              >
                自動
              </button>
            </div>
          ) : null}

          {isTimedTest && remainingMs !== null && !isSubmitted ? (
            <div className="pointer-events-auto rounded-2xl border border-rose-200 bg-white/95 px-4 py-3 text-sm font-bold text-rose-700 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur">
              残り時間: {formatRemainingTime(remainingMs)}
            </div>
          ) : null}
        </div>
      ) : null}

      {questionStatusText ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-50 w-[380px] max-w-[calc(100vw-32px)] sm:bottom-5 sm:left-5">
          <div className="pointer-events-auto rounded-2xl border border-black/10 bg-white/95 p-4 text-sm font-semibold text-slate-700 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur">
            {questionStatusText}
          </div>
        </div>
      ) : showQuestionUi && (isStudentInfoPage || shouldShowQuestionPanelArea || isSubmitPage) ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-50 w-[380px] max-w-[calc(100vw-32px)] sm:bottom-5 sm:left-5">
          <div className="pointer-events-auto space-y-3">
            {isStudentInfoPage ? (
              <div>
                <button
                  type="button"
                  onClick={toggleStudentInfoPanel}
                  className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white/95 px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur transition hover:bg-white"
                >
                  <span>受験者情報</span>
                  <span className="text-xs text-slate-500">
                    {isStudentInfoOpen ? "閉じる" : "開く"}
                  </span>
                </button>

                {isStudentInfoOpen ? (
                  <div className="mt-3 rounded-2xl border border-black/10 bg-white/95 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur">
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-600">
                          クラス
                        </label>
                        <select
                          value={studentProfile.classId}
                          onChange={(e) =>
                            handleStudentProfileChange("classId", e.target.value)
                          }
                          disabled={lockStudentProfile || isClassOptionsLoading}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="">
                            {isClassOptionsLoading
                              ? "クラス一覧を読み込み中..."
                              : "クラスを選択してください"}
                          </option>
                          {classOptions.map((item) => (
                            <option key={item.id} value={String(item.id)}>
                              {item.name}
                            </option>
                          ))}
                        </select>

                        {classOptionsError ? (
                          <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                            {classOptionsError}
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-600">
                          学籍番号
                        </label>
                        <input
                          type="text"
                          value={studentProfile.studentNumber}
                          onChange={(e) =>
                            handleStudentProfileChange(
                              "studentNumber",
                              e.target.value
                            )
                          }
                          readOnly={lockStudentProfile}
                          placeholder="例: 240001"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500 read-only:bg-slate-100 read-only:text-slate-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-600">
                          氏名
                        </label>
                        <input
                          type="text"
                          value={studentProfile.studentName}
                          onChange={(e) =>
                            handleStudentProfileChange(
                              "studentName",
                              e.target.value
                            )
                          }
                          readOnly={lockStudentProfile}
                          placeholder="例: 山田 太郎"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500 read-only:bg-slate-100 read-only:text-slate-500"
                        />
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600">
                        {lockStudentProfile
                          ? "この教材はログイン済みの受験者情報を使用します。学籍番号と氏名は教材側で変更できません。提出は最終ページで行います。"
                          : "クラス・学籍番号・氏名は 1 ページ目で入力します。学籍番号が一致した場合、氏名は自動補完されます。提出は最終ページで行います。"}
                        {isTimedTest && timeLimitMinutes ? (
                          <>
                            <br />
                            制限時間: {timeLimitMinutes}分
                          </>
                        ) : (
                          <>
                            <br />
                            制限時間: なし
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {shouldShowQuestionPanelArea ? (
              <div>
                <button
                  type="button"
                  onClick={toggleQuestionPanel}
                  className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white/95 px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur transition hover:bg-white"
                >
                  <span>
                    {currentPageQuestionCount > 0
                      ? `${questionToggleLabel}${
                          displayMode === "test" ? " / test" : " / practice"
                        }`
                      : isSubmitPage
                        ? "提出"
                        : "問題"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {isQuestionPanelOpen ? "閉じる" : "開く"}
                  </span>
                </button>

                {isQuestionPanelOpen ? (
                  <div className="mt-3 max-h-[calc(100vh-140px)] overflow-y-auto rounded-2xl">
                    <div className="space-y-3">
                      {currentQuestions.length > 0 ? (
                        <div className="rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
                          このページの問題：{currentPageQuestionCount}問 / 回答済み：
                          {answeredQuestionCount}問 / モード：
                          {displayMode === "test" ? "test" : "practice"}
                        </div>
                      ) : null}

                      {currentQuestions.map((question, index) => {
                        return (
                          <div key={question.id} className="space-y-2">
                            <div className="rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-xs font-bold tracking-wide text-slate-500 shadow-[0_6px_16px_rgba(0,0,0,0.06)]">
                              問題 {index + 1} / {displayMode}
                            </div>

                            <QuestionPanel
                              question={question}
                              mode={displayMode}
                              storedAnswer={answers[question.id]}
                              onSubmit={(value, result) =>
                                handleSubmitAnswer(question.id, value, result)
                              }
                            />
                          </div>
                        );
                      })}

                      {isSubmitPage && displayMode === "test" ? (
                        <div className="rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-4 text-sm text-sky-900 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
                          <div className="font-bold">提出ページ</div>
                          <div className="mt-1 leading-6">
                            最終ページです。クラス・学籍番号・氏名を確認して、テストを提出してください。
                          </div>

                          <div className="mt-3 rounded-xl border border-sky-200 bg-white/80 px-3 py-2 text-xs leading-6 text-sky-900">
                            クラス: {selectedClassName || "(未選択)"}
                            <br />
                            学籍番号: {studentProfile.studentNumber || "(未入力)"}
                            <br />
                            氏名: {studentProfile.studentName || "(未入力)"}
                            <br />
                            test 問題数: {allTestQuestions.length}問
                            <br />
                            制限時間:{" "}
                            {timeLimitMinutes ? `${timeLimitMinutes}分` : "なし"}
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleSubmitTest("manual")}
                            disabled={isSubmitted || isSubmitting}
                            className="mt-3 rounded-xl bg-[#4a3f39] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#5a4d46] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSubmitted
                              ? "提出済み"
                              : isSubmitting
                                ? "提出中..."
                                : "テストを提出"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}