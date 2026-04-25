import axios from 'axios';

import type { ProblemRecordApi } from './types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://192.168.2.3:8000';
const PROBLEMS_ENDPOINT = `${API_BASE_URL}/problems`;

let problemsCache: ProblemRecordApi[] | null = null;
let problemsRequest: Promise<ProblemRecordApi[]> | null = null;

function isProblemRecordArray(value: unknown): value is ProblemRecordApi[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.content === 'string' &&
        typeof item.type === 'string' &&
        typeof item.subject === 'string' &&
        typeof item.answer === 'string' &&
        typeof item.response_id === 'string' &&
        typeof item.created_at === 'string' &&
        Array.isArray(item.tags),
    )
  );
}

export async function fetchProblems() {
  if (problemsCache) {
    return problemsCache;
  }

  if (!problemsRequest) {
    problemsRequest = axios.get<unknown>(PROBLEMS_ENDPOINT).then((response) => {
      if (!isProblemRecordArray(response.data)) {
        throw new Error('后端返回的题目列表格式不正确');
      }

      problemsCache = response.data;
      return response.data;
    });
  }

  try {
    return await problemsRequest;
  } finally {
    problemsRequest = null;
  }
}

export function getProblemsCache() {
  return problemsCache;
}

export function setProblemsCache(nextProblems: ProblemRecordApi[]) {
  problemsCache = nextProblems;
}

export function invalidateProblemsCache() {
  problemsCache = null;
  problemsRequest = null;
}

export { PROBLEMS_ENDPOINT };
