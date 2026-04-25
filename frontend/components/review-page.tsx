'use client';

import axios from 'axios';
import { useEffect, useState } from 'react';

import { AppShell } from './app-shell';
import { MathText } from './math-text';
import {
  fetchReviewRecommendation,
  submitReviewFeedback,
} from '@/lib/review-api';
import type { ReviewRating, ReviewRecommendationResponse } from '@/lib/types';

const RATING_BUTTONS: Array<{
  label: string;
  value: ReviewRating;
  backgroundColor: string;
  color: string;
}> = [
  {
    label: '忘记',
    value: 'forgot',
    backgroundColor: '#f1d4d4',
    color: '#6e3f3f',
  },
  {
    label: '部分学会',
    value: 'hard',
    backgroundColor: '#f4e7cb',
    color: '#6b4e1f',
  },
  {
    label: '完全学会',
    value: 'good',
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-ink)',
  },
  {
    label: '轻松学会',
    value: 'easy',
    backgroundColor: 'var(--primary-deep)',
    color: '#fff8f8',
  },
];

export function ReviewPage() {
  const [recommendation, setRecommendation] = useState<ReviewRecommendationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadRecommendation() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const nextRecommendation = await fetchReviewRecommendation();

        if (!ignore) {
          setRecommendation(nextRecommendation);
        }
      } catch (error) {
        if (!ignore) {
          if (axios.isAxiosError(error)) {
            setErrorMessage(
              error.response?.status
                ? `获取复习推荐失败 (${error.response.status})`
                : error.message || '获取复习推荐失败',
            );
          } else {
            setErrorMessage(error instanceof Error ? error.message : '获取复习推荐失败');
          }
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadRecommendation();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleFeedback(rating: ReviewRating) {
    if (!recommendation?.problem) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const nextRecommendation = await submitReviewFeedback({
        problem_id: recommendation.problem.id,
        rating,
      });
      setRecommendation(nextRecommendation);
      setShowAnswer(false);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(
          typeof error.response?.data?.detail === 'string'
            ? error.response.data.detail
            : error.response?.status
              ? `提交复习结果失败 (${error.response.status})`
              : error.message || '提交复习结果失败',
        );
      } else {
        setErrorMessage(error instanceof Error ? error.message : '提交复习结果失败');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const current = recommendation?.problem ?? null;

  return (
    <AppShell
      title="翻卡记忆"
      description="按翻卡的方式过一遍错题。先自己想，再翻面看答案和知识点。"
    >
      <section className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <aside
          className="rounded-[2rem] p-6"
          style={{
            border: '1px solid var(--line)',
            backgroundColor: 'var(--surface-soft)',
            color: 'var(--foreground)',
            boxShadow: '0 20px 60px rgba(164, 108, 108, 0.14)',
          }}
        >
          <p className="text-xs font-semibold tracking-[0.18em] uppercase">
            Deck Status
          </p>
          <h2 className="mt-3 text-3xl font-semibold">{recommendation?.due_count ?? 0}</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>
            当前到期题数
          </p>

          <div className="mt-6 space-y-3 text-sm" style={{ color: 'var(--muted)' }}>
            <p>正面：题目内容</p>
            <p>背面：答案、知识点、学科信息</p>
            <p>推荐：由后端 SM-2 算法决定</p>
            <p>总题数：{recommendation?.total_count ?? 0}</p>
            <p>
              下次到期：
              {recommendation?.next_due_at
                ? new Date(recommendation.next_due_at).toLocaleString('zh-CN')
                : '暂无'}
            </p>
          </div>
        </aside>

        <div
          className="rounded-[2rem] p-5 md:p-6"
          style={{
            border: '1px solid var(--line)',
            backgroundColor: 'var(--surface)',
            boxShadow: '0 20px 60px rgba(164, 108, 108, 0.14)',
          }}
        >
          {errorMessage ? (
            <div
              className="flex min-h-96 items-center justify-center rounded-[1.75rem] border border-dashed text-center text-sm leading-7"
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
              className="flex min-h-96 items-center justify-center rounded-[1.75rem] border border-dashed text-center text-sm leading-7"
              style={{
                borderColor: 'var(--line)',
                backgroundColor: 'var(--surface-soft)',
                color: 'var(--muted)',
              }}
            >
              正在从后端获取推荐题目。
            </div>
          ) : current ? (
            <>
              <div className="flex items-center justify-between text-sm" style={{ color: 'var(--muted)' }}>
                <span>
                  待复习 {recommendation?.due_count ?? 0} / 共 {recommendation?.total_count ?? 0} 题
                </span>
                <span>{showAnswer ? '答案面' : '题目面'}</span>
              </div>

              <button
                type="button"
                className="mt-4 min-h-[28rem] w-full rounded-[2rem] p-6 text-left transition-colors"
                style={{
                  backgroundColor: showAnswer ? 'var(--primary)' : 'var(--surface-soft)',
                  color: showAnswer ? 'var(--primary-ink)' : 'var(--foreground)',
                }}
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
                    <div
                      className="space-y-4 border-t pt-4 text-sm"
                      style={{
                        borderColor: 'rgba(110, 63, 63, 0.2)',
                        color: 'rgba(110, 63, 63, 0.82)',
                      }}
                    >
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
                  className="rounded-full px-4 py-3 text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'var(--primary-ink)',
                  }}
                  onClick={() => setShowAnswer((value) => !value)}
                >
                  {showAnswer ? '回到题面' : '显示答案'}
                </button>
                {showAnswer
                  ? RATING_BUTTONS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className="rounded-full px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: item.backgroundColor,
                          color: item.color,
                        }}
                        onClick={() => void handleFeedback(item.value)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? '提交中...' : item.label}
                      </button>
                    ))
                  : null}
              </div>
            </>
          ) : (
            <div
              className="flex min-h-96 items-center justify-center rounded-[1.75rem] border border-dashed text-center text-sm leading-7"
              style={{
                borderColor: 'var(--line)',
                backgroundColor: 'var(--surface-soft)',
                color: 'var(--muted)',
              }}
            >
              现在没有到期的卡片。
              {recommendation?.next_due_at
                ? ` 下一张预计在 ${new Date(recommendation.next_due_at).toLocaleString('zh-CN')} 到期。`
                : ' 先去上传一题，再回来复习。'}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
