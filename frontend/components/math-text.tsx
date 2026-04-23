'use client';

import { BlockMath, InlineMath } from 'react-katex';

type Segment =
  | { type: 'text'; value: string }
  | { type: 'inline-math'; value: string }
  | { type: 'block-math'; value: string };

function parseLine(line: string) {
  const segments: Segment[] = [];
  const pattern = /(\$\$[\s\S]+?\$\$)|(\$[^$\n]+\$)/g;
  let lastIndex = 0;

  for (const match of line.matchAll(pattern)) {
    const matched = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      segments.push({ type: 'text', value: line.slice(lastIndex, start) });
    }

    if (matched.startsWith('$$') && matched.endsWith('$$')) {
      segments.push({
        type: 'block-math',
        value: matched.slice(2, -2).trim(),
      });
    } else if (matched.startsWith('$') && matched.endsWith('$')) {
      segments.push({
        type: 'inline-math',
        value: matched.slice(1, -1).trim(),
      });
    }

    lastIndex = start + matched.length;
  }

  if (lastIndex < line.length) {
    segments.push({ type: 'text', value: line.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', value: line });
  }

  return segments;
}

export function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lines = text.split('\n');

  return (
    <div className={className}>
      {lines.map((line, lineIndex) => (
        <div key={`${lineIndex}-${line}`} className="min-h-[1.75rem]">
          {parseLine(line).map((segment, segmentIndex) => {
            const key = `${lineIndex}-${segmentIndex}`;

            if (segment.type === 'inline-math') {
              return <InlineMath key={key} math={segment.value} />;
            }

            if (segment.type === 'block-math') {
              return (
                <span key={key} className="my-3 block overflow-x-auto">
                  <BlockMath math={segment.value} />
                </span>
              );
            }

            return (
              <span key={key} className="whitespace-pre-wrap">
                {segment.value}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
