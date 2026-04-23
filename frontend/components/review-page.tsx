'use client';

import { useMemo, useState } from 'react';

import { AppShell } from './app-shell';
import { MathText } from './math-text';
import { listSavedProblems } from '@/lib/problem-store';
import type { SavedProblem } from '@/lib/types';

export function ReviewPage() {
  const [problems] = useState<SavedProblem[]>(() => listSavedProblems());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const current = useMemo(() => problems[currentIndex] ?? null, [problems, currentIndex]);

  function move(step: number) {
    if (problems.length === 0) {
      return;
    }

    setCurrentIndex((value) => (value + step + problems.length) % problems.length);
    setShowAnswer(false);
  }

  function shuffle() {
    if (problems.length === 0) {
      return;
    }

    const nextIndex = Math.floor(Math.random() * problems.length);
    setCurrentIndex(nextIndex);
    setShowAnswer(false);
  }

  return (
    <AppShell
      title="翻卡记忆"
      description="按翻卡的方式过一遍错题。先自己想，再翻面看答案和知识点。"
    >
      <section className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <aside className="rounded-[2rem] border border-white/70 bg-stone-950 p-6 text-white shadow-[0_20px_60px_rgba(32,26,20,0.22)]">
          <p className="text-xs font-semibold tracking-[0.18em] text-amber-200 uppercase">
            Deck Status
          </p>
          <h2 className="mt-3 text-3xl font-semibold">{problems.length}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-300">现在能翻的题数</p>

            <div className="mt-6 space-y-3 text-sm text-stone-300">
              <p>正面：题目内容</p>
              <p>背面：答案、知识点、学科信息</p>
              <p>数据：存在浏览器本地</p>
            </div>
        </aside>

        <div className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(120,83,32,0.12)] md:p-6">
          {current ? (
            <>
              <div className="flex items-center justify-between text-sm text-stone-500">
                <span>
                  第 {currentIndex + 1} / {problems.length} 题
                </span>
                <span>{showAnswer ? '答案面' : '题目面'}</span>
              </div>

              <button
                type="button"
                className={`mt-4 min-h-[28rem] w-full rounded-[2rem] p-6 text-left transition ${
                  showAnswer
                    ? 'bg-stone-950 text-white'
                    : 'bg-[linear-gradient(135deg,#fff9e8_0%,#fff3cc_100%)] text-stone-900'
                }`}
                onClick={() => setShowAnswer((value) => !value)}
              >
                <div className="flex h-full flex-col justify-between gap-6">
                  <div className="space-y-4">
                    <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-70">
                      {showAnswer ? 'Answer' : 'Question'}
                    </p>

                    <MathText
                      text={showAnswer ? current.answer : current.content}
                      className="text-base leading-8 sm:text-lg"
                    />
                  </div>

                  {showAnswer ? (
                    <div className="space-y-4 border-t border-white/10 pt-4 text-sm text-stone-300">
                      <p>学科：{current.subject || '未分类'}</p>
                      <p>题型：{current.type || '未知题型'}</p>
                      <p>
                        标签：
                        {current.tags.length > 0 ? current.tags.join(' / ') : '暂无'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm opacity-70">点击卡片翻面</p>
                  )}
                </div>
              </button>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-full bg-stone-100 px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-200"
                  onClick={() => move(-1)}
                >
                  上一题
                </button>
                <button
                  type="button"
                  className="rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  onClick={() => setShowAnswer((value) => !value)}
                >
                  {showAnswer ? '回到题面' : '显示答案'}
                </button>
                <button
                  type="button"
                  className="rounded-full bg-amber-300 px-4 py-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-400"
                  onClick={() => move(1)}
                >
                  下一题
                </button>
                <button
                  type="button"
                  className="rounded-full bg-white px-4 py-3 text-sm font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50"
                  onClick={shuffle}
                >
                  随机抽题
                </button>
              </div>
            </>
          ) : (
            <div className="flex min-h-96 items-center justify-center rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 text-center text-sm leading-7 text-stone-500">
              还没有能翻的卡片。先去上传一题，或者去错题列表看看本地有没有数据。
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
