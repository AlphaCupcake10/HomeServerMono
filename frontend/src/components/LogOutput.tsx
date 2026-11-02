import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Terminal-style log box that follows new output, unless the user has scrolled up to read.
 * `followKey` should change whenever the content changes (e.g. the fetched log text).
 */
export const LogOutput = ({
  children,
  followKey,
  className,
}: {
  children: ReactNode;
  followKey: unknown;
  className?: string;
}) => {
  const scrollRef = useRef<HTMLPreElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [followKey]);

  return (
    <pre
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
      className={cn(
        'h-[50vh] min-h-64 overflow-auto rounded-md border bg-zinc-950 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-zinc-100',
        className,
      )}
    >
      {children}
    </pre>
  );
};
