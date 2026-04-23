import type { Metadata } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';
import React from 'react';

export const metadata: Metadata = {
  title: '赛博错题本',
  description: '上传错题图片、整理错题并用翻卡方式复习',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
