import { ProblemListPage } from '@/components/problem-list-page';
import type { ProblemRecordApi } from '@/lib/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://192.168.2.3:8000';
const PROBLEMS_ENDPOINT = `${API_BASE_URL}/problems`;

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

async function loadProblems(): Promise<{
  problems: ProblemRecordApi[];
  errorMessage: string;
}> {
  try {
    const response = await fetch(PROBLEMS_ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        problems: [],
        errorMessage: `获取题目列表失败 (${response.status})`,
      };
    }

    const result: unknown = await response.json();

    if (!isProblemRecordArray(result)) {
      return {
        problems: [],
        errorMessage: '后端返回的题目列表格式不正确',
      };
    }

    return {
      problems: result,
      errorMessage: '',
    };
  } catch (error) {
    return {
      problems: [],
      errorMessage: error instanceof Error ? error.message : '获取题目列表失败',
    };
  }
}

export default async function ProblemsPage() {
  const { problems, errorMessage } = await loadProblems();
  return <ProblemListPage problems={problems} errorMessage={errorMessage} />;
}
