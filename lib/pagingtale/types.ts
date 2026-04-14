export type QuestionJudgeMode = "exact" | "includes" | "none";
export type QuestionMode = "practice" | "test";

export type QuestionItem = {
  id: string;
  page: number;
  prompt: string;
  placeholder?: string;
  correctAnswer?: string;
  judgeMode?: QuestionJudgeMode;
  explanation?: string;
  points: number;
  mode?: QuestionMode;
};

export type QuestionMaster = {
  bookId: string;
  bookVersion: string;
  questions: QuestionItem[];
};

export type BookPageMeta = {
  page: number;
  title: string;
  question?: QuestionItem;
};

export type BookDefinition = {
  id: string;
  title: string;
  totalPages: number;
  toc: BookPageMeta[];
};

export type AnswerResult = "unanswered" | "correct" | "incorrect";

export type StoredAnswer = {
  questionId: string;
  value: string;
  result: AnswerResult;
  answeredAt: string | null;
};

export type StoredAnswerMap = Record<string, StoredAnswer>;

export type StudentProfile = {
  studentNumber: string;
  studentName: string;
};