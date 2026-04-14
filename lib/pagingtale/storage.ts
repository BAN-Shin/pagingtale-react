import type { StoredAnswerMap } from "@/lib/pagingtale/types";

function getStorageKey(bookId: string): string {
  return `pagingtale_answers_${bookId}`;
}

export function loadAnswers(bookId: string): StoredAnswerMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(bookId));
    if (!raw) return {};

    const parsed = JSON.parse(raw) as StoredAnswerMap;
    return parsed ?? {};
  } catch (error) {
    console.error("回答データの読み込みに失敗しました:", error);
    return {};
  }
}

export function saveAnswers(bookId: string, answers: StoredAnswerMap): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getStorageKey(bookId), JSON.stringify(answers));
  } catch (error) {
    console.error("回答データの保存に失敗しました:", error);
  }
}