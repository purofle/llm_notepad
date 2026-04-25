'use client';

import { useMemo, useState } from 'react';

import { AppShell } from './app-shell';
import { MathText } from './math-text';
import type { ProblemRecordApi } from '@/lib/types';

type ProblemListPageProps = {
  problems: ProblemRecordApi[];
  errorMessage?: string;
};

export function ProblemListPage({
  problems,
  errorMessage = '',
}: ProblemListPageProps) {
  const [subjectFilter, setSubjectFilter] = useState('全部');

  const subjects = useMemo(() => {
    return ['全部', ...new Set(problems.map((item) => item.subject).filter(Boolean))];
  }, [problems]);

  const filteredProblems = useMemo(() => {
    if (subjectFilter === '全部') {
      return problems;
    }

    return problems.filter((item) => item.subject === subjectFilter);
  }, [problems, subjectFilter]);

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
            共 {filteredProblems.length} 题
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
