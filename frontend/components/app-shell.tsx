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
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,#fff6d8_0%,#fffdf7_38%,#f6efe1_100%)] px-4 py-6 text-stone-950 sm:px-6 lg:px-10">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-4xl border border-white/70 bg-white/80 p-6 shadow-[0_20px_80px_rgba(120,83,32,0.12)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                LLM-Notepad
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {title}
                </h1>
                <p className="max-w-xl text-sm leading-6 text-stone-600 sm:text-base">
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
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-stone-950 text-white shadow-lg'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
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
