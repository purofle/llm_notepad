import type { SavedProblem } from './types';

const STORAGE_KEY = 'llm-notepad-problems';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function listSavedProblems() {
  if (!canUseStorage()) {
    return [] as SavedProblem[];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [] as SavedProblem[];
  }

  try {
    const parsed = JSON.parse(raw) as SavedProblem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as SavedProblem[];
  }
}

export function saveProblem(problem: SavedProblem) {
  const existing = listSavedProblems();
  const next = [problem, ...existing.filter((item) => item.id !== problem.id)];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteProblem(problemId: string) {
  const next = listSavedProblems().filter((item) => item.id !== problemId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
