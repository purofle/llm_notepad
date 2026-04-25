'use client';

import axios from 'axios';
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import { AppShell } from './app-shell';
import { MathText } from './math-text';
import { fetchStudyProblem, streamStudyChat } from '@/lib/study-api';
import type { ProblemRecordApi, StudyChatMessage } from '@/lib/types';

type ChatMessage = StudyChatMessage & {
  id: string;
};

const OPENING_MESSAGE =
  '我会先帮你拆开这道题，但不会直接把完整答案摊开。你现在的年级/水平，或最想先搞懂哪一点？';

function createMessageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createOpeningMessage(): ChatMessage {
  return {
    id: createMessageId(),
    role: 'assistant',
    content: OPENING_MESSAGE,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    if (typeof error.response?.data?.detail === 'string') {
      return error.response.data.detail;
    }

    return error.response?.status
      ? `${fallback} (${error.response.status})`
      : error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

function toStudyMessages(messages: ChatMessage[]): StudyChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export function StudyGuidePage() {
  return (
    <AppShell
      title="AI 学习"
      description="选择一道错题后，AI 会围绕这道题一步步引导你复盘。"
    >
      <section
        className="rounded-[2rem] p-8 text-center"
        style={{
          border: '1px solid var(--line)',
          backgroundColor: 'var(--surface)',
          boxShadow: '0 20px 60px rgba(164, 108, 108, 0.14)',
        }}
      >
        <h2 className="text-2xl font-semibold">先选择一道题</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7" style={{ color: 'var(--muted)' }}>
          从本次识别结果或错题列表进入学习页，这里会加载对应题目并开始对话。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-full px-5 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-ink)',
            }}
          >
            上传识别
          </Link>
          <Link
            href="/problems"
            className="rounded-full px-5 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--surface-strong)',
              color: 'var(--primary-ink)',
            }}
          >
            错题列表
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

export function StudyPage({ problemId }: { problemId: string }) {
  return <StudyPageContent key={problemId} problemId={problemId} />;
}

function StudyPageContent({ problemId }: { problemId: string }) {
  const [problem, setProblem] = useState<ProblemRecordApi | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createOpeningMessage(),
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState('');
  const [sendErrorMessage, setSendErrorMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadProblem() {
      try {
        const nextProblem = await fetchStudyProblem(problemId);

        if (!ignore) {
          setProblem(nextProblem);
        }
      } catch (error) {
        if (!ignore) {
          setLoadErrorMessage(getErrorMessage(error, '获取题目失败'));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadProblem();

    return () => {
      ignore = true;
      abortControllerRef.current?.abort();
    };
  }, [problemId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, isSending]);

  const lastUserMessageIndex = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'user') {
        return index;
      }
    }

    return -1;
  }, [messages]);

  async function requestAssistantResponse(history: ChatMessage[]) {
    if (!problem || history.length === 0) {
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const assistantId = createMessageId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    };
    let assistantContent = '';

    setIsSending(true);
    setSendErrorMessage('');
    setMessages([...history, assistantMessage]);

    try {
      await streamStudyChat(
        {
          problem_id: problem.id,
          messages: toStudyMessages(history),
        },
        (event) => {
          if (event.type === 'error') {
            throw new Error(event.error || '学习对话失败');
          }

          if (event.type !== 'delta' || !event.delta) {
            return;
          }

          assistantContent += event.delta;
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + event.delta }
                : message,
            ),
          );
        },
        abortController.signal,
      );

      if (!assistantContent.trim()) {
        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === assistantId
              ? { ...message, content: '我没有收到可用回复，请再试一次。' }
              : message,
          ),
        );
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        if (!assistantContent.trim()) {
          setMessages((currentMessages) =>
            currentMessages.filter((message) => message.id !== assistantId),
          );
        }

        setSendErrorMessage(getErrorMessage(error, '学习对话失败'));
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsSending(false);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = input.trim();

    if (!content || !problem || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content,
    };
    const nextHistory = [...messages, userMessage];

    setInput('');
    void requestAssistantResponse(nextHistory);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function handleRetry() {
    if (lastUserMessageIndex < 0 || isSending) {
      return;
    }

    const history = messages.slice(0, lastUserMessageIndex + 1);

    void requestAssistantResponse(history);
  }

  return (
    <AppShell
      title="AI 学习"
      description="围绕当前错题提问、拆步骤、查卡点，先理解再看答案。"
    >
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <aside
          className="rounded-[2rem] p-5 md:p-6"
          style={{
            border: '1px solid var(--line)',
            backgroundColor: 'var(--surface-soft)',
            boxShadow: '0 20px 60px rgba(164, 108, 108, 0.14)',
          }}
        >
          {isLoading ? (
            <div className="min-h-80 rounded-[1.75rem] border border-dashed p-8 text-center text-sm leading-7" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
              正在加载题目。
            </div>
          ) : loadErrorMessage ? (
            <div className="min-h-80 rounded-[1.75rem] border border-dashed p-8 text-center text-sm leading-7" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
              {loadErrorMessage}
            </div>
          ) : problem ? (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] uppercase" style={{ color: 'var(--muted)' }}>
                  Study Context
                </p>
                <h2 className="mt-2 text-2xl font-semibold">当前错题</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'var(--primary-ink)',
                  }}
                >
                  {problem.subject || '未分类'}
                </span>
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--surface-strong)',
                    color: 'var(--primary-ink)',
                  }}
                >
                  {problem.type || '未知题型'}
                </span>
              </div>

              <div
                className="rounded-[1.5rem] p-4"
                style={{ backgroundColor: 'var(--surface)' }}
              >
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  题目
                </p>
                <MathText text={problem.content} className="mt-2 text-sm leading-7" />
              </div>

              <div className="flex flex-wrap gap-2">
                {problem.tags.length > 0 ? (
                  problem.tags.map((tag) => (
                    <span
                      key={`${problem.id}-${tag}`}
                      className="rounded-full px-3 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: 'var(--surface)',
                        color: 'var(--primary-ink)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>
                    暂无知识点标签
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </aside>

        <div
          className="flex min-h-[38rem] flex-col rounded-[2rem] p-5 md:p-6"
          style={{
            border: '1px solid var(--line)',
            backgroundColor: 'var(--surface)',
            boxShadow: '0 20px 60px rgba(164, 108, 108, 0.14)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] uppercase" style={{ color: 'var(--muted)' }}>
                Study Mode
              </p>
              <h2 className="mt-2 text-2xl font-semibold">对话学习</h2>
            </div>
            <Link
              href="/problems"
              className="shrink-0 rounded-full px-4 py-2 text-sm font-medium"
              style={{
                backgroundColor: 'var(--surface-strong)',
                color: 'var(--primary-ink)',
              }}
            >
              换题
            </Link>
          </div>

          <div
            className="mt-5 flex-1 space-y-4 overflow-y-auto rounded-[1.5rem] p-4"
            style={{ backgroundColor: 'var(--surface-soft)' }}
          >
            {messages.map((message) => {
              const isUser = message.role === 'user';

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[88%] rounded-[1.25rem] px-4 py-3 text-sm leading-7"
                    style={{
                      backgroundColor: isUser ? 'var(--primary)' : 'var(--surface)',
                      color: isUser ? 'var(--primary-ink)' : 'var(--foreground)',
                      border: isUser ? 'none' : '1px solid var(--line)',
                    }}
                  >
                    {message.content ? (
                      <MathText text={message.content} />
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>正在思考...</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {sendErrorMessage ? (
            <div
              className="mt-4 flex flex-col gap-3 rounded-[1.25rem] p-4 text-sm leading-6 sm:flex-row sm:items-center sm:justify-between"
              style={{
                border: '1px solid var(--line)',
                backgroundColor: 'var(--surface-soft)',
                color: 'var(--muted)',
              }}
            >
              <span>{sendErrorMessage}</span>
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--surface-strong)',
                  color: 'var(--primary-ink)',
                }}
                disabled={lastUserMessageIndex < 0 || isSending || !problem}
                onClick={handleRetry}
              >
                重试上一句
              </button>
            </div>
          ) : null}

          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
            <textarea
              className="min-h-24 flex-1 resize-none rounded-[1.25rem] px-4 py-3 text-sm leading-6 outline-none disabled:cursor-not-allowed"
              style={{
                border: '1px solid var(--line)',
                backgroundColor: 'var(--surface-soft)',
                color: 'var(--foreground)',
              }}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的想法、卡住的步骤或追问"
              disabled={!problem || isLoading || isSending}
            />
            <button
              type="submit"
              className="rounded-[1.25rem] px-6 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed sm:self-stretch"
              style={{
                backgroundColor:
                  !problem || isLoading || isSending || !input.trim()
                    ? 'var(--surface-strong)'
                    : 'var(--primary-deep)',
                color:
                  !problem || isLoading || isSending || !input.trim()
                    ? 'var(--muted)'
                    : '#fff8f8',
              }}
              disabled={!problem || isLoading || isSending || !input.trim()}
            >
              {isSending ? '发送中...' : '发送'}
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
