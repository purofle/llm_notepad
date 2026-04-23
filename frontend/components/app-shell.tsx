'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/', label: '上传录入' },
  { href: '/problems', label: '错题列表' },
  { href: '/review', label: '翻卡记忆' },
];

export function AppShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div
      className="min-h-dvh px-4 py-6 sm:px-6 lg:px-10"
      style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
    >
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section
          className="overflow-hidden rounded-4xl p-6 md:p-8"
          style={{
            border: '1px solid var(--line)',
            backgroundColor: 'var(--surface)',
            boxShadow: '0 20px 80px rgba(164, 108, 108, 0.14)',
          }}
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-3">
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--surface-strong)',
                  color: 'var(--primary-ink)',
                }}
              >
                错题整理工具
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {title}
                </h1>
                <p
                  className="max-w-xl text-sm leading-6 sm:text-base"
                  style={{ color: 'var(--muted)' }}
                >
                  {description}
                </p>
              </div>
            </div>

            <nav className="flex flex-wrap gap-2">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
                    style={
                      active
                        ? {
                            backgroundColor: 'var(--primary)',
                            color: 'var(--primary-ink)',
                            boxShadow: '0 10px 24px rgba(216, 134, 134, 0.28)',
                          }
                        : {
                            backgroundColor: 'var(--surface-soft)',
                            color: 'var(--primary-ink)',
                          }
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </section>

        {children}
      </main>
    </div>
  );
}
