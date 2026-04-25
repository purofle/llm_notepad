'use client';

import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';

import { AppShell } from './app-shell';
import { MathText } from './math-text';
import {
  fetchProblems,
  getProblemsCache,
  PROBLEMS_ENDPOINT,
  setProblemsCache,
} from '@/lib/problems-api';
import { invalidateReviewRecommendationCache } from '@/lib/review-api';
import type { ProblemRecordApi } from '@/lib/types';

export function ProblemListPage() {
  const [problems, setProblems] = useState<ProblemRecordApi[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deletingProblemId, setDeletingProblemId] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('全部');

  useEffect(() => {
    let ignore = false;

    async function loadProblems() {
      const cachedProblems = getProblemsCache();

      if (cachedProblems) {
        setProblems(cachedProblems);
        setErrorMessage('');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const nextProblems = await fetchProblems();

        if (!ignore) {
          setProblems(nextProblems);
        }
      } catch (error) {
        if (!ignore) {
          setProblems([]);
          if (axios.isAxiosError(error)) {
            setErrorMessage(
              error.response?.status
                ? `获取题目列表失败 (${error.response.status})`
                : error.message || '获取题目列表失败',
            );
            return;
          }

          setErrorMessage(error instanceof Error ? error.message : '获取题目列表失败');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadProblems();

    return () => {
      ignore = true;
    };
  }, []);

  const subjects = useMemo(() => {
    return ['全部', ...new Set(problems.map((item) => item.subject).filter(Boolean))];
  }, [problems]);

  const filteredProblems = useMemo(() => {
    if (subjectFilter === '全部') {
      return problems;
    }

    return problems.filter((item) => item.subject === subjectFilter);
  }, [problems, subjectFilter]);

  async function handleDelete(problemId: string) {
    setDeletingProblemId(problemId);
    setErrorMessage('');

    try {
      await axios.delete(`${PROBLEMS_ENDPOINT}/${problemId}`);
      const nextProblems = problems.filter((item) => item.id !== problemId);
      invalidateReviewRecommendationCache();
      setProblemsCache(nextProblems);
      setProblems(nextProblems);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(
          error.response?.status
            ? `删除失败 (${error.response.status})`
            : error.message || '删除失败',
        );
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeletingProblemId('');
    }
  }

  return (
    <AppShell title="错题列表" description="这里放已经录进去的错题。">
      <section
        className="rounded-[2rem] p-5 md:p-6"
        style={{
          border: '1px solid var(--line)',
          backgroundColor: 'var(--surface)',
          boxShadow: '0 20px 60px rgba(164, 108, 108, 0.14)',
        }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-wrap gap-2">
            {subjects.map((subject) => (
              <button
                key={subject}
                type="button"
                className="rounded-full px-4 py-2 text-sm transition-colors"
                style={{
                  backgroundColor:
                    subjectFilter === subject ? 'var(--primary)' : 'var(--surface-soft)',
                  color: 'var(--primary-ink)',
                }}
                onClick={() => setSubjectFilter(subject)}
              >
                {subject}
              </button>
            ))}
          </div>

          <p className="min-w-20 text-sm md:text-right" style={{ color: 'var(--muted)' }}>
            {isLoading ? '加载中...' : `共 ${filteredProblems.length} 题`}
          </p>
        </div>

        {errorMessage ? (
          <div
            className="mt-6 rounded-[1.75rem] border border-dashed p-10 text-center text-sm leading-7"
            style={{
              borderColor: 'var(--line)',
              backgroundColor: 'var(--surface-soft)',
              color: 'var(--muted)',
            }}
          >
            {errorMessage}
          </div>
        ) : isLoading ? (
          <div
            className="mt-6 rounded-[1.75rem] border border-dashed p-10 text-center text-sm leading-7"
            style={{
              borderColor: 'var(--line)',
              backgroundColor: 'var(--surface-soft)',
              color: 'var(--muted)',
            }}
          >
            正在从后端加载错题列表。
          </div>
        ) : filteredProblems.length > 0 ? (
          <div className="mt-6 grid gap-4">
            {filteredProblems.map((problem) => (
              <article
                key={problem.id}
                className="grid gap-4 rounded-[1.75rem] p-4 md:grid-cols-[1.15fr_0.85fr]"
                style={{
                  border: '1px solid var(--line)',
                  backgroundColor: 'var(--surface-soft)',
                }}
              >
                <div className="space-y-4">
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
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {new Date(problem.created_at).toLocaleString('zh-CN')}
                    </span>
                  </div>

                  <div>
                    <p
                      className="text-xs font-semibold tracking-[0.18em] uppercase"
                      style={{ color: 'var(--muted)' }}
                    >
                      Problem
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
                        暂无标签
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="space-y-4 rounded-[1.5rem] p-4"
                  style={{ backgroundColor: 'var(--surface)' }}
                >
                  <div>
                    <p
                      className="text-xs font-semibold tracking-[0.18em] uppercase"
                      style={{ color: 'var(--muted)' }}
                    >
                      Answer
                    </p>
                    <MathText text={problem.answer} className="mt-2 text-sm leading-7" />
                  </div>

                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    响应 ID：{problem.response_id}
                  </p>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: 'var(--surface-strong)',
                        color: 'var(--primary-ink)',
                      }}
                      onClick={() => void handleDelete(problem.id)}
                      disabled={deletingProblemId === problem.id}
                    >
                      {deletingProblemId === problem.id ? '删除中...' : '删除'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div
            className="mt-6 rounded-[1.75rem] border border-dashed p-10 text-center text-sm leading-7"
            style={{
              borderColor: 'var(--line)',
              backgroundColor: 'var(--surface-soft)',
              color: 'var(--muted)',
            }}
          >
            现在还没有错题。先去上传页识别一题再回来。
          </div>
        )}
      </section>
    </AppShell>
  );
}
