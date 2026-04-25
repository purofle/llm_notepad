import axios from 'axios';

import type {
  ProblemRecordApi,
  StudyChatEvent,
  StudyChatRequest,
} from './types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://192.168.2.3:8000';
const PROBLEMS_ENDPOINT = `${API_BASE_URL}/problems`;
const STUDY_CHAT_ENDPOINT = `${API_BASE_URL}/study/chat`;

function isProblemRecord(value: unknown): value is ProblemRecordApi {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ProblemRecordApi).id === 'string' &&
    typeof (value as ProblemRecordApi).content === 'string' &&
    typeof (value as ProblemRecordApi).type === 'string' &&
    typeof (value as ProblemRecordApi).subject === 'string' &&
    typeof (value as ProblemRecordApi).answer === 'string' &&
    typeof (value as ProblemRecordApi).response_id === 'string' &&
    typeof (value as ProblemRecordApi).created_at === 'string' &&
    Array.isArray((value as ProblemRecordApi).tags)
  );
}

function isStudyChatEvent(value: unknown): value is StudyChatEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    ((value as StudyChatEvent).type === 'delta' ||
      (value as StudyChatEvent).type === 'done' ||
      (value as StudyChatEvent).type === 'error')
  );
}

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json();

    if (typeof data?.detail === 'string') {
      return data.detail;
    }
  } catch {
    // Fall through to the status-based message below.
  }

  return response.status ? `请求失败 (${response.status})` : '请求失败';
}

function parseSseEvent(rawEvent: string) {
  const data = rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s?/, ''))
    .join('\n')
    .trim();

  if (!data) {
    return null;
  }

  const parsed: unknown = JSON.parse(data);

  if (!isStudyChatEvent(parsed)) {
    throw new Error('后端返回的学习事件格式不正确');
  }

  return parsed;
}

export async function fetchStudyProblem(problemId: string) {
  const response = await axios.get<unknown>(`${PROBLEMS_ENDPOINT}/${problemId}`);

  if (!isProblemRecord(response.data)) {
    throw new Error('后端返回的题目格式不正确');
  }

  return response.data;
}

export async function streamStudyChat(
  payload: StudyChatRequest,
  onEvent: (event: StudyChatEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch(STUDY_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (!response.body) {
    throw new Error('浏览器无法读取流式回复');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const match = buffer.match(/\r?\n\r?\n/);

      if (!match || match.index === undefined) {
        break;
      }

      const rawEvent = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      const event = parseSseEvent(rawEvent);

      if (event) {
        onEvent(event);
      }
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    const event = parseSseEvent(buffer);

    if (event) {
      onEvent(event);
    }
  }
}
