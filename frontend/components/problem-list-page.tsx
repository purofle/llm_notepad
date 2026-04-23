'use client';

import { useMemo, useState } from 'react';

import { AppShell } from './app-shell';
import { MathText } from './math-text';
import { deleteProblem, listSavedProblems } from '@/lib/problem-store';
import type { SavedProblem } from '@/lib/types';

export function ProblemListPage() {
  const [problems, setProblems] = useState<SavedProblem[]>(() => listSavedProblems());
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
    <AppShell
      title="错题列表"
      description="这里放已经录进去的错题。"
    >
      <section className={"rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(120,83,32,0.12)] md:p-6"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {subjects.map((subject) => (
              <button
                key={subject}
                type="button"
                className={`rounded-full px-4 py-2 text-sm transition ${
                  subjectFilter === subject
                    ? 'bg-stone-950 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
                onClick={() => setSubjectFilter(subject)}
              >
                {subject}
              </button>
            ))}
          </div>

          <p className="text-sm text-stone-500">
            共 {filteredProblems.length} 题
          </p>
        </div>

        {filteredProblems.length > 0 ? (
          <div className="mt-6 grid gap-4">
            {filteredProblems.map((problem) => (
              <article
                key={problem.id}
                className="grid gap-4 rounded-[1.75rem] border border-stone-200 bg-stone-50 p-4 md:grid-cols-[1.15fr_0.85fr]"
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-950">
                      {problem.subject || '未分类'}
                    </span>
                    <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-medium text-stone-700">
                      {problem.type || '未知题型'}
                    </span>
                    <span className="text-xs text-stone-500">
                      {new Date(problem.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
                      Problem
                    </p>
                    <MathText
                      text={problem.content}
                      className="mt-2 text-sm leading-7 text-stone-800"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {problem.tags.length > 0 ? (
                      problem.tags.map((tag) => (
                        <span
                          key={`${problem.id}-${tag}`}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-200"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-stone-500">暂无标签</span>
                    )}
                  </div>
                </div>

                <div className="space-y-4 rounded-[1.5rem] bg-white p-4">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase">
                      Answer
                    </p>
                    <MathText
                      text={problem.answer}
                      className="mt-2 text-sm leading-7 text-stone-800"
                    />
                  </div>

                  {problem.previewImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={problem.previewImageUrl}
                      alt="错题裁剪图"
                      className="max-h-56 w-full rounded-2xl object-contain ring-1 ring-stone-200"
                    />
                  ) : null}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-red-100 hover:text-red-700"
                      onClick={() => setProblems(deleteProblem(problem.id))}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-10 text-center text-sm leading-7 text-stone-500">
            现在还没有错题。先去上传页识别一题再回来。
          </div>
        )}
      </section>
    </AppShell>
  );
}
